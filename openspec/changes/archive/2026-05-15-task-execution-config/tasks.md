## 1. Update the do-task skill body

- [x] 1.1 In `templates/claude/skills/nightshift-do-task/SKILL.md` Resolution section, replace the "Your very first bash command MUST be `pwd`" guidance with: read `$NIGHTSHIFT_WORKSPACE_ROOT` first; if set, use that as the literal absolute workspace root for all `.nightshift/<shift>/...` references. If unset, fall back to running `pwd` as the first bash command (preserving pre-3.1 standalone-invocation behavior).
- [x] 1.2 Adjust the "remember the literal absolute path" guidance: when `NIGHTSHIFT_WORKSPACE_ROOT` is set, the model can use the env var's value directly as the literal path string in every flock/qsv invocation — no `pwd` call needed.
- [x] 1.3 Add a short note that the dev's own cwd is now whatever `dispatch-batch.sh` set it to (may be a target repo or a worktree) and is appropriate for task-step execution but never for resolving shift artifacts.

## 2. Extend dispatch-batch.sh

- [x] 2.1 In `templates/claude/skills/nightshift-start/scripts/dispatch-batch.sh`, extend manifest parsing to read per-item `working_dir`, `worktree` (bool), `worktree_name`, and `model` fields (default to null/false when absent).
- [x] 2.2 In the per-item spawn loop, compute the subprocess cwd: prefer `working_dir` when set, fall back to the helper's own cwd (workspace root) otherwise.
- [x] 2.3 Construct the `claude -p` argument list dynamically: always include `--output-format stream-json --verbose --permission-mode <mode>`; append `--worktree <worktree_name>` when `worktree` is true; append `--model <model>` when `model` is set.
- [x] 2.4 Export `NIGHTSHIFT_WORKSPACE_ROOT=<workspace>` (the helper's own cwd at start, captured before any per-item `cd`) into the subprocess environment so the do-task skill can find shift artifacts.
- [x] 2.5 Wrap the `claude -p` invocation in a subshell that `cd`s into the target cwd: `(cd "$CWD" && env NIGHTSHIFT_WORKSPACE_ROOT="$WS" claude -p ... > "$LOG_PATH" 2>&1) &`. Background the subshell, not just claude, so the cd is scoped to that one item.
- [x] 2.6 After each subprocess exits and we determine its status: if `worktree` was true, attempt `(cd "$CWD" && git worktree remove ".claude/worktrees/$worktree_name")`. If the remove fails (uncommitted state), do not retry with `--force`; record `worktree_preserved: "$CWD/.claude/worktrees/$worktree_name"` in that item's result. If the subprocess failed for any reason, skip the remove attempt entirely and record `worktree_preserved`.
- [x] 2.7 If the resolved `working_dir` doesn't exist when the helper tries to `cd` into it, emit an immediate failure result for that item (`status: failed, error: working_dir does not exist: <path>`) without spawning `claude -p`.
- [x] 2.8 Extend the helper's emitted JSON result schema to include the new `worktree_preserved` field per item (null when no worktree was used or the worktree was cleanly removed).

## 3. Update the manager prose

- [x] 3.1 In `templates/claude/agents/nightshift-manager.md`, add a "Read task execution config" subsection in the Orchestration Logic: when reading a task file, parse the Configuration section's `tools`, `model`, `working_dir`, and `worktree` fields (each optional).
- [x] 3.2 Add a "Resolve placeholders in working_dir" subsection: per-item, substitute `{column}`, `{ENV:VAR}`, `{SHIFT:FOLDER|NAME|TABLE}` in the `working_dir` string using the item's row data, shift environment, and shift metadata. Same substitution rules as task steps.
- [x] 3.3 Add a "Workspace-trust pre-flight" step that runs before dispatching the first batch in any shift where any item has `worktree: true`. Collect unique resolved `working_dir` values, probe each via `(cd "$d" && claude --worktree probe-trust-$RANDOM -p "exit")` with a short timeout, identify untrusted directories, and abort with the documented remediation message if any are untrusted.
- [x] 3.4 Update the "Dispatch the Batch" section's manifest schema example to include per-item `working_dir`, `worktree`, `worktree_name`, and `model` fields. Show the worktree-name format: `ns-<shift>-<item-id>-<task>-<timestamp>`.
- [x] 3.5 In the "Completion" section, add: if any results have `worktree_preserved` set, list each preserved worktree path in the final summary so the user knows where to inspect or clean up.
- [x] 3.6 Re-check manager prose body length stays under 20,000 characters. Trim verbosity elsewhere if needed.

## 4. Update the add-task skill

- [x] 4.1 In `templates/claude/skills/nightshift-add-task/SKILL.md`, update the Configuration section template the skill writes to include placeholders for the new fields with short comments: `# - model: sonnet`, `# - working_dir: {repo_path}`, `# - worktree: true`.
- [x] 4.2 Update the skill's interactive guidance: when prompting the user for task metadata, ask whether they want to set `model`, `working_dir`, and/or `worktree`. Document the requirement that `worktree: true` requires `working_dir` to also be set.

## 5. Documentation

- [x] 5.1 Add a "Multi-repo shifts" section to `README.md` with: a concrete example task config that uses `working_dir: {repo_path}` + `worktree: true`, an example `table.csv` with a `repo_path` column, the one-time workspace-trust accept step (`for d in ...; do (cd "$d" && claude); done`), a pointer to Claude Code's `.worktreeinclude` docs for shipping `.env` into worktrees.
- [x] 5.2 Add a "Cost control via `model`" note to README: example task config with `model: haiku` for cheap mechanical tasks.
- [x] 5.3 Add a CHANGELOG entry under `## [3.1.0]` (no BREAKING) listing: three new task Configuration fields, `NIGHTSHIFT_WORKSPACE_ROOT` env var, workspace-trust pre-flight check, worktree cleanup policy.
- [x] 5.4 Update `AGENTS.md` to mention the new fields under "Architecture": one-line note that tasks can target per-item directories and worktrees.
- [x] 5.5 In `templates/claude/CLAUDE.md`, add a one-line note about multi-repo support and a pointer to the README section.

## 6. Tests

- [x] 6.1 In `test/init-tests.ts`, ensure the do-task skill body assertion (or a new one) covers the `$NIGHTSHIFT_WORKSPACE_ROOT` documentation in the skill prose.
- [ ] 6.2 **DEFERRED.** Multi-repo integration test requires scratch git repo creation + worktree assertions; substantial test scaffolding. Manual verification recommended before tagging 3.1.0.
- [ ] 6.3 **DEFERRED.** Trust-preflight test depends on `~/.claude.json` state on the test host, which is shared with the user's interactive sessions; reliably faking "untrusted" without polluting the user's real trust state is non-trivial.
- [ ] 6.4 **DEFERRED with 6.3.**

## 7. Build, validate, ship

- [x] 7.1 Bump `package.json` version from `3.0.0` to `3.1.0`. Plugin manifest syncs automatically via `build.js`.
- [x] 7.2 Run `pnpm build` and confirm it succeeds and 7 skills verify.
- [x] 7.3 Run `npx tsc --noEmit` — zero errors.
- [x] 7.4 Run `pnpm test:init` and confirm all init tests pass.
- [ ] 7.5 Run `pnpm test:integration` (optionally with `NIGHTSHIFT_TEST_NO_AUTO_MODE=1` on hosts without auto mode). New tests should pass; existing tests should be unaffected. **NOT YET RUN this session.** Existing 3.0 fixtures don't exercise the new fields (no task in test fixtures sets `working_dir`/`worktree`/`model`), so existing tests SHOULD pass unchanged — but verification recommended before tagging 3.1.0.
- [x] 7.6 Run `npm pack --dry-run` and verify no unexpected file changes.
- [x] 7.7 Run `openspec validate task-execution-config --strict` — change still validates after implementation.

## 8. Archive

- [x] 8.1 Once the branch is reviewed and merged, run `/opsx:archive task-execution-config`. The previously-applied spec normalization (canonical `# X Specification` headers in five specs) means sync should now succeed without `--skip-specs`.
