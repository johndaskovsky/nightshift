## ADDED Requirements

### Requirement: Parallel dispatch mode
The manager agent SHALL support a parallel dispatch mode in which multiple table rows are processed concurrently for a single task. Parallel mode SHALL be enabled by setting `parallel: true` in the Shift Configuration section of `manager.md`. When parallel mode is not enabled (omitted or `false`), the manager SHALL process one row at a time (batch size fixed at 1).

#### Scenario: Parallel mode enabled
- **WHEN** `manager.md` contains `parallel: true` in the Shift Configuration section
- **THEN** the manager SHALL dispatch multiple dev agents concurrently for different rows of the same task, using adaptive batch sizing

#### Scenario: Parallel mode disabled (default)
- **WHEN** `manager.md` does not contain `parallel: true` (omitted or set to `false`)
- **THEN** the manager SHALL process one row at a time, equivalent to a fixed batch size of 1

#### Scenario: Parallel dispatch uses Task tool concurrency
- **WHEN** the manager dispatches a batch of N rows
- **THEN** it SHALL issue N parallel Task tool calls in a single message, one per row, each invoking the nightshift-dev agent

### Requirement: Adaptive batch sizing
The manager agent SHALL determine batch size adaptively when parallel mode is enabled. The initial batch size SHALL be 2. The manager SHALL increase batch size on success and decrease on failure.

#### Scenario: Initial batch size
- **WHEN** parallel mode is enabled and the first batch is dispatched
- **THEN** the batch size SHALL be 2

#### Scenario: Batch size increases on full success
- **WHEN** all items in a completed batch have status `done` after QA
- **THEN** the manager SHALL double the batch size for the next batch

#### Scenario: Batch size decreases on any failure
- **WHEN** one or more items in a completed batch have status `failed` (after dev or QA)
- **THEN** the manager SHALL halve the batch size for the next batch (rounded down)

#### Scenario: Minimum batch size
- **WHEN** the batch size would be reduced below 1
- **THEN** the batch size SHALL remain at 1 (effectively sequential processing with centralized learning)

#### Scenario: Batch size does not exceed remaining items
- **WHEN** the number of remaining `todo` items is less than the current batch size
- **THEN** the manager SHALL dispatch only the remaining items as the final batch

### Requirement: Batch lifecycle
The manager agent SHALL follow a defined lifecycle for each batch: dispatch all dev agents, wait for all to complete, collect and apply learnings, run QA sequentially on successful items, then proceed to the next batch.

#### Scenario: Batch dispatch phase
- **WHEN** the manager begins a new batch
- **THEN** it SHALL set all batch items to `in_progress` in `table.csv`, then dispatch dev agents for all batch items concurrently

#### Scenario: Batch collection phase
- **WHEN** all dev agents in a batch have returned results
- **THEN** the manager SHALL collect results from all dev agents before proceeding to QA or the next batch

#### Scenario: Learning application between batches
- **WHEN** the manager has collected results from a completed batch
- **THEN** it SHALL review all dev agent recommendations, synthesize non-contradictory improvements, and apply a single coherent update to the task file's Steps section before dispatching the next batch

#### Scenario: QA runs sequentially after batch
- **WHEN** dev agents in a batch return successful results
- **THEN** the manager SHALL run QA sequentially on each successful item (one at a time), updating statuses to `done` or `failed` after each QA result

#### Scenario: Failed dev items skip QA
- **WHEN** a dev agent in a batch returns a failure result
- **THEN** the manager SHALL set that item's status to `failed` and SHALL NOT dispatch QA for that item

### Requirement: Batch state on interrupt
The manager agent SHALL set all batch items to `in_progress` before dispatching dev agents. If the shift is interrupted mid-batch, the existing stale status recovery logic SHALL handle re-processing.

#### Scenario: All batch items marked in_progress before dispatch
- **WHEN** the manager dispatches a batch of N items
- **THEN** all N items SHALL have status `in_progress` in `table.csv` before any dev agent is invoked

#### Scenario: Interrupted batch recovers on resume
- **WHEN** a shift is resumed after an interruption during a parallel batch
- **THEN** all `in_progress` items SHALL be reset to `todo` by the existing stale status recovery logic, and the entire batch SHALL be re-dispatched

### Requirement: Row-level parallelism only
The system SHALL only parallelize across rows for a single task. Different tasks within the same row SHALL remain strictly sequential per the task ordering rules.

#### Scenario: Parallel across rows
- **WHEN** parallel mode is enabled for a task with 10 `todo` rows
- **THEN** the manager SHALL dispatch multiple rows concurrently for that task

#### Scenario: Sequential across tasks per row
- **WHEN** a row has tasks "create-page" and "update-spreadsheet" in order
- **THEN** "update-spreadsheet" SHALL NOT begin for that row until "create-page" is `done`, regardless of parallel mode

#### Scenario: QA remains sequential
- **WHEN** a batch of dev agents completes
- **THEN** the manager SHALL run QA on successful items one at a time, not in parallel
