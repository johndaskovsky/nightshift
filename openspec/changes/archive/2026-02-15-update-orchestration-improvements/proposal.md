## Why

The current orchestration model has several reliability and observability gaps. The manager does not report progress back to the command thread, making long shifts opaque. Context compaction mid-shift can silently corrupt manager state with no recovery mechanism. The `in_progress` status exists only as a transient marker that must be reset on resume, adding complexity without value. Step recommendations from failed dev processes can introduce bad learnings into task definitions. CSV operations on `table.csv` are unprotected against concurrent access, which is a real risk in parallel mode when multiple processes read/write the same file. The manager is also a bottleneck for state transitions -- it must wait for each agent to return, then write the status update, creating unnecessary serialization. These issues compound in production shifts and need to be addressed together.

## What Changes

- **Manager batch progress reporting**: After each batch, the manager reports `Progress: M/N` (completed/total) back to the `nightshift-start` command thread. If the manager subagent was compacted during the batch, it also reports `Compacted: true`.
- **Compaction recovery in nightshift-start**: The main thread of `nightshift-start` monitors for `Compacted: true` in the manager's report. When detected, it stops the compacted manager subagent and starts a fresh one to continue the shift, preventing degraded behavior from accumulated context loss.
- **BREAKING: Remove `in_progress` from the state machine**: The status value `in_progress` is eliminated. The state machine becomes `todo -> qa -> done | failed`. The `todo` state is assigned directly to dev for processing. The `qa` state is assigned directly to QA for verification.
- **BREAKING: Decentralized state management**: The manager is no longer the sole writer of item-task status in `table.csv`. Instead, dev and QA agents update their own row state directly using `flock`-protected `qsv` commands. The dev agent sets the status to `qa` on success or `failed` on failure. The QA agent sets the status to `done` on success or `failed` on failure. The manager no longer writes status transitions -- it reads status to determine what to delegate and applies step recommendations, but state ownership moves to the executing agents. This eliminates the manager as a serialization bottleneck and simplifies the orchestration loop. The manager no longer resets stale statuses on resume since there are no transient states to recover from.
- **Conditional step recommendation incorporation**: The manager only applies step improvement recommendations from dev processes that completed successfully (`overall_status: "SUCCESS"`). Recommendations from failed processes are discarded to prevent bad learnings from propagating.
- **New template variable `{SHIFT:TABLE}`**: Adds a new shift placeholder that resolves to the full path of the shift's `table.csv` file (e.g., `.nightshift/my-batch-job/table.csv`). Useful for tasks that need to reference the table directly.
- **BREAKING: `qsv` is a required dependency**: `qsv` moves from "optional but strongly recommended" to required. Nightshift will not operate without it. Pre-flight checks will fail with an error (not a warning) if `qsv` is not installed.
- **BREAKING: `flock` is a required dependency**: All `qsv` operations on `table.csv` must be wrapped with `flock -x {table_path}` to ensure exclusive file locking. This prevents concurrent access corruption in parallel mode. `flock` is installed via `brew install flock` from [discoteq/flock](https://github.com/discoteq/flock).
- **README updates**: The README is updated to reflect the new state machine, required dependencies (qsv and flock with installation instructions), removal of `in_progress`, and the `{SHIFT:TABLE}` template variable.

## Capabilities

### New Capabilities

- `table-file-locking`: File locking mechanism using `flock` for exclusive access to `table.csv` during all `qsv` operations, preventing concurrent access corruption in parallel mode.

### Modified Capabilities

- `nightshift-agents`: Manager batch progress reporting, compaction detection, conditional recommendation incorporation, removal of `in_progress` status handling. Decentralized state management: dev agent writes `qa` or `failed` status directly; QA agent writes `done` or `failed` status directly; manager no longer writes status transitions. Dev and QA agents gain `qsv*` and `flock*` bash permissions for table writes.
- `nightshift-commands`: `nightshift-start` command monitors for compaction and restarts manager; pre-flight checks require qsv and flock (error instead of warning).
- `nightshift-shifts`: State machine changes from 5 states to 4 (remove `in_progress`). Valid transitions updated. Resume logic simplified (no stale state recovery needed).
- `nightshift-tasks`: Steps section may reference `{SHIFT:TABLE}` placeholder.
- `task-template-variables`: New `{SHIFT:TABLE}` placeholder resolving to the full path of the shift's `table.csv`.
- `qsv-csv-operations`: qsv becomes required (not optional). All qsv commands on `table.csv` are prepended with `flock -x {table_path}` for exclusive locking. Dev and QA agents gain qsv bash permissions for direct status writes.
- `parallel-execution`: Batch lifecycle updated to remove `in_progress` status setting. Dev and QA agents handle their own state transitions, simplifying the batch collection phase.
- `nightshift-installer`: README template updates for new dependencies, state machine, and template variables.

## Impact

- **Agent templates** (`templates/agents/nightshift-manager.md`, `templates/agents/nightshift-dev.md`, `templates/agents/nightshift-qa.md`): Manager no longer writes status transitions; reads state for delegation and applies recommendations only. Dev agent gains bash permissions (`qsv*`, `flock*`) and writes its own status (`qa` or `failed`). QA agent gains bash permissions (`qsv*`, `flock*`) and writes its own status (`done` or `failed`). Dev agent placeholder resolution for `{SHIFT:TABLE}`. Manager progress reporting and recommendation filtering.
- **Command templates** (`templates/commands/nightshift-start.md`): Compaction monitoring loop, pre-flight dependency checks (qsv + flock required).
- **All commands using qsv**: Every qsv invocation across all agents and commands must be wrapped with `flock -x` for table locking.
- **Specs**: 8 existing specs require delta updates. 1 new spec for file locking.
- **README.md**: State machine diagram, prerequisites, template variables section, execution details.
- **AGENTS.md**: State machine reference, permissions table footnotes, dependency list.
- **External dependencies**: `qsv` (required), `flock` via `brew install flock` from [discoteq/flock](https://github.com/discoteq/flock) (required).
- **Breaking changes**: Shifts created with prior versions that have `in_progress` statuses in `table.csv` will need those values manually updated to `todo` before running with the new version.
