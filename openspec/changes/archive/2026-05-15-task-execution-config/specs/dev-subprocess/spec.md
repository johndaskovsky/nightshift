## ADDED Requirements

### Requirement: NIGHTSHIFT_WORKSPACE_ROOT environment variable
The dispatch helper SHALL export `NIGHTSHIFT_WORKSPACE_ROOT` as the absolute path of the Nightshift workspace root before exec'ing each `claude -p` subprocess. The do-task skill SHALL read this env var to locate `.nightshift/<shift>/manager.md`, `<task-name>.md`, `.env`, and `table.csv`, instead of deriving them from `pwd` (which may now point at a different repo or a worktree thereof).

#### Scenario: Helper sets the env var
- **WHEN** `dispatch-batch.sh` spawns a dev subprocess
- **THEN** the subprocess SHALL see `NIGHTSHIFT_WORKSPACE_ROOT` set to the absolute path of the workspace from which the manager invoked the helper

#### Scenario: Skill reads the env var for workspace paths
- **WHEN** the `/nightshift-do-task` skill starts
- **THEN** it SHALL read `$NIGHTSHIFT_WORKSPACE_ROOT` first and use that absolute path as the base for every `.nightshift/<shift>/...` reference, regardless of its own cwd

#### Scenario: Fallback to pwd when env var is unset
- **WHEN** the skill is invoked directly (e.g., a user manually runs `claude -p "/nightshift-do-task ..."` without going through the helper) and `NIGHTSHIFT_WORKSPACE_ROOT` is not set
- **THEN** the skill SHALL fall back to `pwd` as the workspace root, preserving pre-3.1 behavior

### Requirement: Workspace-trust pre-flight check
When any item in the next batch has `worktree: true`, the manager SHALL probe each unique resolved `working_dir` value for Claude Code workspace trust before dispatching. The probe consists of running `claude --worktree probe-trust-<random-suffix> -p "exit"` with a short timeout from the target directory; if the invocation fails with the workspace-trust prompt, the directory is treated as untrusted. If any directories are untrusted, the manager SHALL abort the shift with a clear remediation message and SHALL NOT dispatch any items in the batch.

#### Scenario: Probe succeeds for trusted directories
- **WHEN** the manager probes a `working_dir` that has previously had workspace trust accepted (i.e., is present in `~/.claude.json`'s trust state)
- **THEN** the probe SHALL exit cleanly and the manager SHALL proceed to dispatch

#### Scenario: Probe fails for untrusted directory
- **WHEN** the manager probes a `working_dir` that has not had workspace trust accepted
- **THEN** the manager SHALL record the directory as untrusted, collect any other untrusted directories from the same probe pass, and emit a remediation message listing all untrusted directories and the shell command to fix them: `for d in <dir1> <dir2> ...; do (cd "$d" && claude); done`

#### Scenario: Probe skipped when worktree is not used
- **WHEN** no items in the batch have `worktree: true`
- **THEN** the manager SHALL NOT perform the trust probe (working_dir alone does not require trust acceptance)

### Requirement: Worktree naming schema
The dispatch helper SHALL construct worktree names following the schema `ns-<shift-name>-<item-id>-<task-name>-<YYYYMMDDHHMMSS>` and pass that name as the `--worktree` argument to `claude -p`. Names SHALL be unique per attempt (different items, retries, and shifts produce different names).

#### Scenario: Worktree name uniqueness
- **WHEN** two items in the same batch both use `worktree: true`
- **THEN** their `--worktree` arguments SHALL differ by item-id (and also by timestamp if dispatch is not strictly simultaneous), producing distinct worktree directories and branches

#### Scenario: Retry produces a new worktree name
- **WHEN** an item is retried (e.g., after a self-validation failure on the first attempt)
- **THEN** the retry's worktree name SHALL include a different timestamp than the prior attempt, so the prior attempt's worktree (if preserved) is not overwritten

### Requirement: Worktree cleanup policy
After each dev subprocess exits, the dispatch helper SHALL attempt cleanup of any worktree it created. Cleanup SHALL use `git worktree remove <path>` without `--force`, so worktrees that contain uncommitted state are preserved for inspection.

#### Scenario: Clean exit removes the worktree
- **WHEN** a dev subprocess that used `--worktree` exits with status `done` and left the worktree clean (no uncommitted changes)
- **THEN** the dispatch helper SHALL run `git worktree remove <worktree-path>` from the `working_dir`, removing the worktree directory; the worktree's branch (`worktree-<name>`) SHALL be preserved (Claude Code's default behavior; `git worktree remove` does not delete the branch)

#### Scenario: Uncommitted state preserves worktree
- **WHEN** a dev subprocess exits but the worktree contains uncommitted changes or untracked files
- **THEN** `git worktree remove` SHALL fail (without `--force`), the worktree SHALL be preserved, and the helper SHALL include `worktree_preserved: <path>` in that item's result entry

#### Scenario: Failed subprocess preserves worktree
- **WHEN** a dev subprocess exits with status `failed` (any cause: validation failure, classifier abort, crash, timeout)
- **THEN** the dispatch helper SHALL NOT attempt `git worktree remove` and SHALL set `worktree_preserved: <path>` in the result entry, leaving the worktree intact for user inspection

### Requirement: --model flag passthrough
When a task configuration sets `model: <name>`, the dispatch helper SHALL append `--model <name>` to the `claude -p` invocation for every item executing that task.

#### Scenario: Model flag appears in invocation
- **WHEN** a task has `model: haiku` and an item executes that task
- **THEN** the `claude -p` invocation for that item SHALL include `--model haiku`

#### Scenario: Model field omitted
- **WHEN** a task omits the `model` field
- **THEN** the `claude -p` invocation SHALL NOT include `--model` (the user's Claude Code default applies)

## MODIFIED Requirements

### Requirement: Parallel dispatch via bundled helper script
The system SHALL provide a bundled `dispatch-batch.sh` helper script that the manager uses for both serial (single-item) and parallel (multi-item) dispatch. The script SHALL be installed alongside the `nightshift-start` skill at `.claude/skills/nightshift-start/scripts/dispatch-batch.sh`. The manifest passed to the helper SHALL include per-item `working_dir`, `worktree`, `worktree_name`, and `model` fields in addition to the existing `item_id` and `task` fields.

#### Scenario: Script accepts JSON manifest with execution-config fields
- **WHEN** the manager invokes `${CLAUDE_SKILL_DIR}/scripts/dispatch-batch.sh` with a manifest of the form `{"shift": "...", "items": [{"item_id": "1", "task": "<task>", "working_dir": "<resolved-path-or-null>", "worktree": true|false, "worktree_name": "<name-or-null>", "model": "<name-or-null>"}, ...], "permission_mode": "...", "log_dir": "...", "read_only": false}`
- **THEN** the script SHALL honor each item's per-item fields: `cd` into `working_dir` (when set) before invoking `claude -p`, append `--worktree <name>` when `worktree` is true, and append `--model <name>` when `model` is set

#### Scenario: Script emits JSON result array including worktree state
- **WHEN** all spawned dev subprocesses have exited
- **THEN** the script SHALL emit a single JSON document to stdout: `{"results": [{"item_id": "...", "exit_code": <n>, "status": "done|failed", "attempts": <n>, "recommendations": "...", "error": ..., "log_path": "...", "worktree_preserved": "<path>"|null}, ...]}` parsed by the manager; the `worktree_preserved` field is non-null only when a worktree was created and could not be cleanly removed

#### Scenario: Script preserves order
- **WHEN** the script processes a batch
- **THEN** the order of items in the result array SHALL match the order of items in the input manifest

#### Scenario: Script handles non-zero exit codes
- **WHEN** a spawned `claude -p` exits with a non-zero code
- **THEN** the corresponding result entry SHALL contain `exit_code: <non-zero>` and `status: failed`, and the result entry's `recommendations` SHALL be derived from the log if available

#### Scenario: Script is executable
- **WHEN** `nightshift init` writes `dispatch-batch.sh` from the bundled template
- **THEN** the file SHALL be marked executable (mode `0755`)
