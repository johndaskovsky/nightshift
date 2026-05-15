## MODIFIED Requirements

### Requirement: Parallel dispatch mode
The manager agent SHALL support a parallel dispatch mode in which multiple table rows are processed concurrently for a single task. Parallel mode SHALL be enabled by setting `parallel: true` in the Shift Configuration section of `manager.md`. When parallel mode is not enabled (omitted or `false`), the manager SHALL process one row at a time (batch size fixed at 1).

#### Scenario: Parallel mode enabled
- **WHEN** `manager.md` contains `parallel: true` in the Shift Configuration section
- **THEN** the manager SHALL dispatch multiple dev subprocesses concurrently for different rows of the same task, using adaptive batch sizing

#### Scenario: Parallel mode disabled (default)
- **WHEN** `manager.md` does not contain `parallel: true` (omitted or set to `false`)
- **THEN** the manager SHALL process one row at a time, equivalent to a fixed batch size of 1

#### Scenario: Parallel dispatch uses dispatch-batch.sh
- **WHEN** the manager dispatches a batch of N rows
- **THEN** it SHALL invoke `${CLAUDE_SKILL_DIR}/scripts/dispatch-batch.sh` with a JSON manifest containing all N items; the helper SHALL spawn N concurrent `claude -p` subprocesses (one per item), wait for all to exit, and emit a single JSON result document for the manager to parse

#### Scenario: Same helper for serial and parallel
- **WHEN** the manager dispatches a single-item batch (sequential mode, or the final batch of a parallel shift)
- **THEN** it SHALL invoke the same `dispatch-batch.sh` helper with a one-item manifest, so there is a single dispatch code path for both modes

### Requirement: Batch lifecycle
The manager agent SHALL follow a defined lifecycle for each batch: dispatch all dev subprocesses (via `dispatch-batch.sh`), wait for the helper to return its consolidated result JSON, collect and apply learnings, then proceed to the next batch.

#### Scenario: Batch collection phase
- **WHEN** the `dispatch-batch.sh` helper returns its JSON result document for a completed batch
- **THEN** the manager SHALL parse the document, extract per-item status and recommendations, and reconcile against `table.csv` (which the dev subprocesses have already written their own statuses to) before proceeding

#### Scenario: Learning application between batches
- **WHEN** the manager has collected results from a completed batch
- **THEN** it SHALL review all dev recommendations, synthesize non-contradictory improvements, and apply a single coherent update to the task file's Steps section before dispatching the next batch

### Requirement: Batch state on interrupt
If the shift is interrupted mid-batch, the existing resume logic SHALL handle re-processing based on `table.csv` status values. Items whose dev subprocesses did not write a status before interruption remain `todo` and will be re-dispatched on resume.

#### Scenario: Interrupted batch recovers on resume
- **WHEN** a shift is resumed after an interruption during a parallel batch
- **THEN** all items still in `todo` status SHALL be eligible for dispatch in the next batch (even if a dev subprocess's log file exists from the interrupted run — the log is informational; `table.csv` is the source of truth)
