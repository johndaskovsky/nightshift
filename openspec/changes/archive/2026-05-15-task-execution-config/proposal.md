## Why

Nightshift today assumes every task executes against the same project — the directory where the user ran `/nightshift-start`. To use Nightshift for cross-repo batch work (e.g., "run this refactor across 20 of my repos", "open a PR in each of these projects", "regenerate the README in every microservice"), we need three task-level knobs that control how each dev subprocess is launched:

1. **`working_dir`** — change directory before invoking `claude -p`, optionally per-item via a `table.csv` column placeholder. Without this, every dev subprocess runs from the workspace root and tasks have to hand-craft path prefixes for everything.
2. **`worktree`** — run inside a git worktree of the target repo so concurrent items don't clobber each other and so the dev's changes are quarantined on a feature branch. Backed by Claude Code's native `--worktree` flag (see https://code.claude.com/docs/en/worktrees).
3. **`model`** — pick a specific model per task (`haiku` for cheap mechanical work, `opus` for complex reasoning). Today the `model:` field in task `## Configuration` is documented but informational; this change makes it active.

These three knobs share one infrastructure piece: the do-task skill must know where the workspace is when its own cwd is no longer the workspace. We pass that via `NIGHTSHIFT_WORKSPACE_ROOT`.

The bulk of this work is small surgery on existing components — manager prose, the dispatch helper, and the do-task skill. There are no new architectural concepts; just three new fields in the task `## Configuration` section, resolved per-item, threaded through to the subprocess launch.

## What Changes

- **Extend the task `## Configuration` grammar** with three optional fields: `model:`, `working_dir:`, and `worktree:`. Each is documented in `/nightshift-add-task` and `/nightshift-do-task` so task authors discover them.
- **`model: <name>`** — when set, the manager passes `--model <name>` to `claude -p` for this task. Accepted values mirror Claude Code's `--model` flag (`haiku`, `sonnet`, `opus`, full model IDs).
- **`working_dir: <path-or-placeholder>`** — when set, the dispatch helper `cd`s into the resolved path before invoking `claude -p`. The value supports the same placeholder syntax as task steps (`{column_name}`, `{ENV:VAR}`, `{SHIFT:FOLDER|NAME|TABLE}`). The most common usage is `working_dir: {repo_path}` paired with a `repo_path` column in `table.csv`. If the resolved path doesn't exist or isn't a directory, the dispatcher marks the item `failed` with a clear error and does not retry.
- **`worktree: true`** — when set (and only when `working_dir` is also set), the dispatch helper appends `--worktree <unique-name>` to the `claude -p` invocation. Claude Code creates a worktree under `<working_dir>/.claude/worktrees/<unique-name>/` on a branch `worktree-<unique-name>`. The worktree name follows a deterministic schema (`ns-<shift>-<item>-<task>-<timestamp>`) for grep-ability and uniqueness across retries.
- **Workspace-trust pre-flight** — before dispatching the first batch in a shift that uses `worktree: true`, the manager probes each unique `working_dir` value with a no-op `claude -p` invocation. If any directory hasn't had workspace trust accepted (a Claude Code prerequisite for `--worktree`), the manager surfaces a clear "run `claude` once in these directories first" error and aborts cleanly without dispatching anything. The check is skipped when `worktree: false` (or omitted).
- **Worktree cleanup** — after each dev subprocess exits, the dispatch helper runs `git worktree remove .claude/worktrees/<name>` (without `--force`) inside the working_dir. If the dev left uncommitted changes (refused removal), the worktree is preserved and its path is included in the result entry so the manager and the user can inspect later. The branch (`worktree-<name>`) is preserved regardless, so any committed work survives.
- **`NIGHTSHIFT_WORKSPACE_ROOT` env var** — the dispatch helper exports the absolute workspace root before `exec`ing `claude -p`, so the do-task skill can locate `.nightshift/<shift>/manager.md`, `<task>.md`, and `table.csv` even when its own cwd is a different repo or a worktree thereof. The do-task skill body's "capture pwd at start" instruction is replaced with "read `$NIGHTSHIFT_WORKSPACE_ROOT` and use that for shift artifacts".
- **Manager manifest extension** — the JSON manifest passed to `dispatch-batch.sh` gains per-item `working_dir`, `worktree`, `worktree_name`, and `model` fields, all resolved (placeholders substituted) by the manager. The helper consumes them; no further substitution at the helper level.
- **Documentation** — `README.md` gains a "Multi-repo shifts" section showing the `working_dir` + worktree pattern, the workspace-trust prereq, and the `.worktreeinclude` mechanism for shipping `.env` into worktrees. `/nightshift-add-task` skill updates to mention the new fields when guiding authors. CHANGELOG entry under a new 3.1.0 (additive — no BREAKING).

## Capabilities

### New Capabilities

None. All work fits in existing capabilities.

### Modified Capabilities

- `nightshift-tasks`: Adds requirements for the three new Configuration fields (`model`, `working_dir`, `worktree`), placeholder resolution in `working_dir`, and the rule that `worktree: true` requires `working_dir` to also be set.
- `dev-subprocess`: Adds requirements for `NIGHTSHIFT_WORKSPACE_ROOT` env-var contract, the workspace-trust pre-flight check, worktree-name schema, worktree cleanup policy, and the `--model` pass-through. The existing parallel-dispatch contract is extended with per-item `working_dir`/`worktree`/`model` fields in the manifest.
- `nightshift-agents`: Manager prose gains the per-item field resolution (substitute placeholders in `working_dir`), the workspace-trust pre-flight step, and the new manifest fields. The existing orchestration contract (state machine, retry budget, recommendations) is unchanged.
- `nightshift-commands`: The `/nightshift-do-task` skill reads `NIGHTSHIFT_WORKSPACE_ROOT` for shift-artifact paths. The `/nightshift-add-task` skill mentions the new Configuration fields when guiding authors.

## Impact

- **No BREAKING changes.** All three fields are optional. Tasks without them behave exactly as today (subprocess runs from workspace root, no worktree, default model). Major version stays at 3.x; this is a **3.1.0** release.
- **First-time worktree usage in each repo requires a one-time interactive `claude` to accept workspace trust.** Documented; the pre-flight check makes the failure mode friendly. Users not using `worktree: true` aren't affected.
- **Dispatch-batch.sh becomes a few dozen lines longer** but no structural rewrite — same input/output shape (JSON manifest in, consolidated JSON out), just more fields per item.
- **Do-task skill body changes the workspace-root capture** from `pwd` to `$NIGHTSHIFT_WORKSPACE_ROOT`. Backwards-compatible if the env var is set, which the dispatch helper always does. If a user invokes `/nightshift-do-task` directly (without the helper), the skill falls back to `pwd` for the workspace root.
- **Per-repo trust state lives in `~/.claude.json`** — Claude Code's runtime state file. We don't touch it; we just probe it. Users who reset `~/.claude.json` have to re-accept trust per repo.
- **Per-task model selection enables cost optimization** for shifts with hundreds of items — a mechanical task using `haiku` runs ~5× cheaper than `sonnet`.
- **MCP inheritance unchanged** — every dev subprocess still inherits the user's top-level MCP configuration regardless of cwd or worktree state.
- **Logs unchanged** — still written to `.nightshift/<shift>/logs/<item-id>-<task>-<timestamp>.jsonl` in the workspace, not the worktree. Tail-able mid-shift as before.
- **Resume semantics unchanged** — the manager's interrupt/resume logic operates on `table.csv` status, which is unaffected by working_dir/worktree/model.
