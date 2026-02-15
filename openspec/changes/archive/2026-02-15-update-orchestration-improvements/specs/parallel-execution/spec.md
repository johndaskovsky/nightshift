## MODIFIED Requirements

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

### Requirement: Batch lifecycle
The manager agent SHALL follow a defined lifecycle for each batch: dispatch all dev agents, wait for all to complete, collect and apply learnings from successful dev agents only, then dispatch QA for items that dev agents marked as `qa`, then proceed to the next batch.

#### Scenario: Batch dispatch phase
- **WHEN** the manager begins a new batch
- **THEN** it SHALL dispatch dev agents for all batch items concurrently, with each dev agent responsible for writing its own status transition upon completion

#### Scenario: Batch collection phase
- **WHEN** all dev agents in a batch have returned results
- **THEN** the manager SHALL collect results from all dev agents and read the updated statuses from `table.csv` to determine which items are now `qa` (successful) and which are `failed`

#### Scenario: Learning application between batches
- **WHEN** the manager has collected results from a completed batch
- **THEN** it SHALL review recommendations only from dev agents whose `overall_status` is `SUCCESS`, synthesize non-contradictory improvements, and apply a single coherent update to the task file's Steps section before dispatching the next batch

#### Scenario: QA runs concurrently after batch
- **WHEN** dev agents in a batch have written `qa` status for successful items
- **THEN** the manager SHALL dispatch QA agents for all `qa` items concurrently via parallel Task tool calls in a single message, with each QA agent responsible for writing its own status transition (`done` or `failed`)

#### Scenario: Failed dev items skip QA
- **WHEN** a dev agent in a batch writes `failed` status for an item
- **THEN** the manager SHALL NOT dispatch QA for that item

### Requirement: Batch state on interrupt
The manager agent SHALL dispatch dev agents for batch items without setting a transient status first. Items remain `todo` until the dev agent completes and writes `qa` or `failed`. If the shift is interrupted mid-batch, interrupted items remain `todo` and will be re-processed on resume.

#### Scenario: Items remain todo during dev execution
- **WHEN** the manager dispatches a batch of N items to dev agents
- **THEN** items SHALL retain their `todo` status until each dev agent completes and writes its own status transition

#### Scenario: Interrupted batch recovers on resume
- **WHEN** a shift is resumed after an interruption during a parallel batch
- **THEN** any items still in `todo` status SHALL be available for re-processing, and any items already transitioned to `qa` by completed dev agents SHALL be dispatched to QA

## REMOVED Requirements

### Requirement: Batch lifecycle
**Reason:** Replaced by updated requirement with the same name that removes `in_progress` status setting and shifts state-write responsibility to dev and QA agents.
**Migration:** Remove all `qsv edit -i ... in_progress` calls from the manager's batch dispatch phase. Remove all `qsv edit -i ... qa` and `qsv edit -i ... done/failed` calls from the manager's post-QA phase. Dev and QA agents handle their own status writes.

### Requirement: Batch state on interrupt
**Reason:** Replaced by updated requirement with the same name that eliminates the `in_progress` claim mechanism. Items remain `todo` during dev execution instead of being marked `in_progress`.
**Migration:** Remove the `in_progress` marking before batch dispatch. Stale-state recovery is no longer needed since there are no transient states.
