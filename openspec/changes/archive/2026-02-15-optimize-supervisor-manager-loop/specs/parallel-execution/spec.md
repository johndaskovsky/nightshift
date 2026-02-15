## MODIFIED Requirements

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
The manager agent SHALL follow a defined lifecycle for each batch: dispatch all dev agents, wait for all to complete, collect and apply learnings, then proceed to the next batch.

#### Scenario: Batch collection phase
- **WHEN** all dev agents in a batch have returned results
- **THEN** the manager SHALL collect results from all dev agents before proceeding to the next batch

#### Scenario: Learning application between batches
- **WHEN** the manager has collected results from a completed batch
- **THEN** it SHALL review all dev agent recommendations, synthesize non-contradictory improvements, and apply a single coherent update to the task file's Steps section before dispatching the next batch

### Requirement: Batch state on interrupt
If the shift is interrupted mid-batch, the existing resume logic SHALL handle re-processing based on `table.csv` status values. Items that were being processed by dev agents but did not have their status updated remain `todo` and will be re-dispatched on resume.

#### Scenario: Interrupted batch recovers on resume
- **WHEN** a shift is resumed after an interruption during a parallel batch
- **THEN** all items still in `todo` status SHALL be eligible for dispatch in the next batch

## REMOVED Requirements

### Requirement: QA runs concurrently after batch
**Reason**: The QA agent has been removed from the orchestration flow. The dev agent writes terminal status (`done`/`failed`) directly.
**Migration**: The batch lifecycle ends after dev execution and learning application.

### Requirement: Failed dev items skip QA
**Reason**: Removed along with the QA phase. The dev agent writes `failed` directly on failure.
**Migration**: None required.

### Requirement: QA runs concurrently in parallel mode
**Reason**: Removed along with the QA agent role.
**Migration**: None required.

### Requirement: All batch items marked in_progress before dispatch
**Reason**: The `in_progress` status was specified but never implemented. Items remain `todo` until the dev agent writes `done` or `failed`.
**Migration**: None required — this was never implemented.

### Requirement: Batch dispatch phase
**Reason**: The batch dispatch phase required setting items to `in_progress` before dispatching dev agents. Since `in_progress` is removed, the batch dispatch is simply issuing parallel Task tool calls without a status write step.
**Migration**: The manager dispatches dev agents directly without a pre-dispatch status write.
