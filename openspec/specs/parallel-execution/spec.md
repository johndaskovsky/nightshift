# parallel-execution Specification

## Purpose
Defines parallel batch dispatch: enabling parallel mode, adaptive batch sizing, batch lifecycle, and row-level parallelism semantics.
## Requirements
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

### Requirement: Adaptive batch sizing
The manager agent SHALL determine batch size adaptively when parallel mode is enabled. The initial batch size SHALL be determined by the `current-batch-size` field in the Shift Configuration section of `manager.md`; if omitted, the default SHALL be 2. The manager SHALL increase batch size on success and decrease on failure. The batch size SHALL NOT exceed the value of `max-batch-size` if that field is present.

#### Scenario: Initial batch size from configuration
- **WHEN** parallel mode is enabled and `current-batch-size: 5` is set in the Shift Configuration section
- **THEN** the first batch dispatched SHALL have a batch size of 5

#### Scenario: Initial batch size default
- **WHEN** parallel mode is enabled and `current-batch-size` is omitted from the Shift Configuration section
- **THEN** the first batch dispatched SHALL have a batch size of 2

#### Scenario: Batch size increases on full success
- **WHEN** all items in a completed batch have status `done` after dev execution
- **THEN** the manager SHALL double the batch size for the next batch

#### Scenario: Batch size capped by max-batch-size on increase
- **WHEN** all items in a completed batch have status `done` after dev execution and doubling the batch size would exceed `max-batch-size`
- **THEN** the manager SHALL set the batch size to `max-batch-size` for the next batch

#### Scenario: Batch size increases without cap
- **WHEN** all items in a completed batch have status `done` after dev execution and `max-batch-size` is omitted
- **THEN** the manager SHALL double the batch size for the next batch with no upper bound

#### Scenario: Batch size decreases on any failure
- **WHEN** one or more items in a completed batch have status `failed` after dev execution
- **THEN** the manager SHALL halve the batch size for the next batch (rounded down)

#### Scenario: Minimum batch size
- **WHEN** the batch size would be reduced below 1
- **THEN** the batch size SHALL remain at 1 (effectively sequential processing with centralized learning)

#### Scenario: Batch size does not exceed remaining items
- **WHEN** the number of remaining `todo` items is less than the current batch size
- **THEN** the manager SHALL dispatch only the remaining items as the final batch

#### Scenario: Manager persists batch size after adjustment
- **WHEN** the manager adjusts the batch size after a completed batch
- **THEN** the manager SHALL write the new batch size to the `current-batch-size` field in the Shift Configuration section of `manager.md`

#### Scenario: Resume uses persisted batch size
- **WHEN** a shift is resumed and `current-batch-size: 8` is set in `manager.md`
- **THEN** the manager SHALL use 8 as the batch size for the next batch

#### Scenario: Invalid current-batch-size value
- **WHEN** `current-batch-size` is set to a non-positive integer or non-numeric value
- **THEN** the manager SHALL treat it as omitted and use the default of 2

#### Scenario: Invalid max-batch-size value
- **WHEN** `max-batch-size` is set to a non-positive integer or non-numeric value
- **THEN** the manager SHALL treat it as omitted (no cap)

#### Scenario: Batch size fields ignored without parallel
- **WHEN** `parallel` is omitted or `false` and `current-batch-size` or `max-batch-size` are present in the Shift Configuration section
- **THEN** the manager SHALL ignore both fields and process rows sequentially (batch size of 1)

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

### Requirement: Row-level parallelism only
The system SHALL only parallelize across rows for a single task. Different tasks within the same row SHALL remain strictly sequential per the task ordering rules.

#### Scenario: Parallel across rows
- **WHEN** parallel mode is enabled for a task with 10 `todo` rows
- **THEN** the manager SHALL dispatch multiple rows concurrently for that task

#### Scenario: Sequential across tasks per row
- **WHEN** a row has tasks "create_page" and "update_spreadsheet" in order
- **THEN** "update_spreadsheet" SHALL NOT begin for that row until "create_page" is `done`, regardless of parallel mode

