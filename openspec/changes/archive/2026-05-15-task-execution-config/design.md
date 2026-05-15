## Context

After Nightshift 3.0 (subprocess-based dev), every dev process runs from the workspace root, uses whatever model `claude -p` defaults to, and operates on the workspace directly. For multi-repo batch workflows — running a task once per repo across N different repositories — this is inadequate. Three knobs are needed: which directory to run from, whether to isolate that run in a git worktree, and which model to use.

Claude Code provides a native `--worktree` flag that handles git mechanics, branch naming, `.worktreeinclude` for shipping gitignored files (like `.env`), PR-based worktrees, and base-branch resolution. We leverage it directly rather than calling `git worktree add` ourselves.

The do-task skill is the constraint that shaped this design. Today it captures `pwd` as the workspace root and uses absolute paths derived from that for shift artifacts. When `working_dir` is set, the subprocess's cwd is no longer the workspace; the skill needs a different way to find shift artifacts.

## Goals / Non-Goals

**Goals:**

- Per-item working directory selection via `working_dir: {column}` in task config — the primary multi-repo enabler.
- Per-task git worktree isolation via `worktree: true` — clean branches, no clobbering, easy review.
- Per-task model selection via `model: <name>` — cost control.
- Backwards-compatible: tasks without these fields behave exactly as today. No 3.x → 4.x version bump.
- Use Claude Code's native `--worktree` flag instead of inventing our own git worktree management.
- Fail fast on misconfiguration (nonexistent `working_dir`, missing workspace trust) with clear errors.
- Preserve all existing semantics: state machine, retry budget, parallel batching, self-improvement, MCP inheritance.

**Non-Goals:**

- Auto-commit / auto-push from worktrees. Tasks that want to push do so via their own step instructions; the safety boundary will note that `worktree: true` + push is allowed (since the worktree is isolated).
- Cross-filesystem worktrees. Git's standard limitations apply.
- Programmatic workspace-trust acceptance. We don't write to `~/.claude.json`; we only probe it. The one-time accept is a documented prerequisite.
- Custom worktree base branches per item via task config. Users set `worktree.baseRef` in their Claude Code settings if they want local HEAD instead of `origin/HEAD`. We document this and move on.
- A `.nightshift worktree prune` housekeeping command. Users who accumulate stuck worktrees run `git worktree list` and clean up. Could revisit if the workflow needs it.

## Decisions

### 1. Use native `--worktree`, not manual `git worktree add`

`claude -p --worktree <name>` handles branch creation, `.worktreeinclude` copying, base-ref resolution via settings, and PR-based worktree variants for free. Manual git invocations would duplicate this and lose future improvements.

**Alternatives considered:**

- *Manual `git worktree add -b ...` in the dispatch helper.* Rejected. More code, less integrated, can't take advantage of `.worktreeinclude`, ignores the user's `worktree.baseRef` preference.

**Trade-offs we accept:**

- Branch name is forced to `worktree-<name>` (Claude Code's convention). Acceptable.
- Cleanup in `-p` mode is our responsibility. `git worktree remove` handles it.
- Workspace trust prereq applies on first use per repo. Mitigated by the pre-flight check (see decision 4).

### 2. `worktree: true` requires `working_dir` to also be set

The worktree is created inside `<cwd>/.claude/worktrees/<name>/`. If `working_dir` is omitted, the worktree gets created inside the workspace itself — which works mechanically but is rarely what the user wants, and complicates cleanup. We require explicit pairing.

If a task sets `worktree: true` without `working_dir`, the manager surfaces a configuration error during pre-flight and refuses to dispatch.

### 3. Worktree naming: `ns-<shift>-<item>-<task>-<timestamp>`

Deterministic, unique per attempt (timestamp), grep-able by prefix (`worktree-ns-*` or `git branch | grep '^worktree-ns-'`). Long but predictable.

**Alternatives considered:**

- *Random UUID:* harder to correlate to shift/item from a branch list. Rejected.
- *No timestamp suffix:* retries collide with leftover dirs/branches from prior attempts. Rejected.
- *Sequential counter:* requires per-shift state; complicates parallelism. Rejected.

### 4. Workspace-trust pre-flight check in the manager

Before dispatching the first batch in any shift where any item has `worktree: true`, the manager:

1. Collects the set of unique resolved `working_dir` values across all items.
2. For each: spawns `claude --worktree probe-trust-<random-suffix> -p "exit"` with a short timeout. Suffix is random to avoid colliding with a pre-existing probe worktree.
3. If the invocation errors with the trust prompt (string match on the documented error message), records the directory as "not trusted".
4. If any directories are not trusted, surfaces a `## Trust Required` block listing them and the exact command to fix (`for d in ...; do (cd "$d" && claude); done`). Manager exits without dispatching; user re-runs after accepting trust.

The probe is cheap (single `exit`, sub-second per repo). We don't probe when `worktree: false` because non-worktree subprocesses don't need trust.

**Failure modes considered:**

- Probe times out: treat as untrusted, surface the same prompt.
- Probe succeeds but creates a stray worktree: the probe name is unique per shift start; cleanup happens via the standard post-exit `git worktree remove`.

### 5. Workspace root via `NIGHTSHIFT_WORKSPACE_ROOT` env var

The dispatch helper exports the absolute workspace path before the `claude -p` exec. The do-task skill body now reads this env var to locate `.nightshift/<shift>/manager.md`, `<task>.md`, `.env`, and `table.csv`.

**Alternatives considered:**

- *Pass workspace root as a 4th positional argument to `/nightshift-do-task`.* Conflicts with the existing `--read-only` 4th-positional convention; requires positional reordering. Rejected.
- *Ancestor walk for `.nightshift/`.* Fragile; could discover the wrong workspace if the user has nested `.nightshift/` directories. Rejected.
- *Marker file inside the workspace passed by path.* Similar fragility. Rejected.

**Fallback when env var is unset:** the skill falls back to `pwd` (preserving 3.0 behavior for users who invoke `/nightshift-do-task` directly without the helper). Documented as a non-recommended path; integration tests cover the env-var path.

### 6. Field resolution happens in the manager, not the helper

The manager substitutes `{column}`, `{ENV:VAR}`, `{SHIFT:*}` placeholders in `working_dir` (and any other future placeholder-bearing config fields) per item, then writes the fully-resolved value to the JSON manifest. The dispatch helper receives literal values and does no substitution.

**Why:** keeps the helper a thin bash glue layer; centralizes substitution logic in the manager (which already does substitution for task steps); means failures during substitution surface in the manager's prose (better error messages) rather than the helper.

### 7. Cleanup policy: remove on clean exit, preserve otherwise

After each dev subprocess exits, the helper attempts `git worktree remove <path>` (no `--force`). Three outcomes:

| Subprocess outcome | Worktree state after task | `git worktree remove` result | Helper action |
|---|---|---|---|
| Success, clean tree | clean | success | done |
| Success, committed work | clean (work is on branch) | success | done |
| Success, uncommitted state | dirty | error: "contains modified or untracked files" | preserve worktree, set `worktree_preserved: <path>` in result |
| Failure (any cause) | possibly dirty | (not attempted) | preserve worktree, set `worktree_preserved: <path>` in result |

The manager's final shift summary lists any preserved worktrees so the user knows where to look. The branch (`worktree-<name>`) is never deleted by us — committed work always survives.

**Why no `--force`:** users who care about the dev's work-in-progress on a failing item shouldn't lose it. They can `git worktree remove --force` manually after inspection.

### 8. `--model` is a per-task field, not per-item

A `model: <name>` field in the task `## Configuration` applies to every item executing that task. No per-item override via column placeholder.

**Why:** model selection is fundamentally a task-shape decision (this task is simple → haiku; this task needs reasoning → opus), not an item-shape decision. If per-item model selection turns out to be useful, we can add it as `model: {column}` later — same placeholder syntax, additive.

### 9. Manager prose budget impact

Adding three resolved fields to the per-item manifest construction adds ~30 lines to the manager prose. Current body is 10.9K chars (well under the 20K budget). Headroom remains for future per-task knobs.

### 10. Documentation: where each piece is described

- `README.md` — user-facing how-to under a new "Multi-repo shifts" section
- `templates/claude/skills/nightshift-add-task/SKILL.md` — author-facing field reference when the user creates a task
- `templates/claude/skills/nightshift-do-task/SKILL.md` — internal contract: read `NIGHTSHIFT_WORKSPACE_ROOT`, accept new field semantics
- `templates/claude/agents/nightshift-manager.md` — orchestration: resolution, manifest construction, pre-flight check
- `templates/claude/skills/nightshift-start/scripts/dispatch-batch.sh` — flag passthrough, cleanup
- `openspec/specs/dev-subprocess/spec.md` — formal requirements (after sync)
- `openspec/specs/nightshift-tasks/spec.md` — task-config field grammar

## Risks / Trade-offs

- **[Risk] First-time trust dialog blocks shifts.** → Pre-flight check + clear error message + documented one-time `for d in <dirs>; do (cd "$d" && claude); done` recipe.
- **[Risk] Worktree creation fails for unrelated reasons** (FS boundaries, disk full, locked .git). → Surface the raw `claude --worktree` error in the subprocess's log; mark item failed; manager proceeds. Same handling as any other subprocess failure.
- **[Risk] Concurrent worktree creation on the same repo races.** → Git's worktree machinery handles concurrent adds. Branch names are unique-per-attempt (timestamp). Path names are unique-per-attempt. No collision possible.
- **[Risk] Stale `worktree-ns-*` branches accumulate.** → Branches are preserved by design (so committed work isn't lost). Document `git branch -D worktree-ns-<shift>-*` cleanup recipe. Could add `/nightshift-prune` later.
- **[Risk] `.claude/worktrees/` ends up tracked in a repo without `.gitignore` entry.** → Initial worktree creation pollutes the user's main checkout if they `git status` from there. Mitigation: add a one-time check in the manager's pre-flight that warns if `.claude/worktrees/` isn't gitignored in any target repo.
- **[Risk] Setting `worktree.baseRef: "head"` in user settings affects every Nightshift dispatch.** → That's the user's choice; we document the trade-off. Default is `"fresh"` (branch from `origin/HEAD`).
- **[Risk] `working_dir` substitution failures surface late.** → Manager substitutes once per item before manifest construction. If a referenced column doesn't exist, manager fails fast for that item with a clear error and marks the row failed without dispatching. No retry.
- **[Trade-off] No per-item `model` override.** Acknowledged in decision 8. Additive future change if needed.
- **[Trade-off] We don't auto-prune accumulated worktree branches.** → Manual `git branch -D` recipe. Users who run a lot of shifts may accumulate many branches; document the cleanup pattern in README.

## Migration Plan

This is a minor version bump (3.0 → 3.1).

1. Implement on a single feature branch (`task-execution-config`).
2. Bump `package.json` version to `3.1.0`. Plugin manifest syncs automatically.
3. Add CHANGELOG entry under `## [3.1.0]`. No BREAKING heading.
4. Run init suite + integration suite. Add new tests for: trust pre-flight failure, working_dir resolution, worktree cleanup, model passthrough.
5. Tag and publish 3.1.0.

**No data migration.** Tasks without the new fields work identically. Users who upgrade can adopt the fields at their own pace.

## Open Questions

- **Should the pre-flight check warn or refuse when `.claude/worktrees/` isn't gitignored in a target repo?** Refusing is stricter but more annoying; warning is friendlier but easier to ignore. Default proposal: warn once per shift, don't refuse. Revisit if it leads to dirty checkouts in practice.
- **Should the manager record the resolved `working_dir` and `worktree_name` somewhere durable for resume?** Currently both are recomputed each batch from task config + table.csv. If a user changes `repo_path` for an item between batches (e.g., via `/nightshift-update-table`), the next batch picks up the new value. That seems correct. No durable record needed.
- **Should `working_dir` accept relative paths (relative to workspace root) or only absolute?** Both work mechanically; relative is shorter (`{repo_path}` resolving to `../sibling-repo`). Default proposal: accept both. Document that absolute paths are recommended for clarity.
- **Should `model:` validate the value against a known list?** Claude Code's `--model` rejects unknown values, so the failure is caught at subprocess launch. We don't add a separate validator. The dev process fails with a clear error if the model is unsupported.
