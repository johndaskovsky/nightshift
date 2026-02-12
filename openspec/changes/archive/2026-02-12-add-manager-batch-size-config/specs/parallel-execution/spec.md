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
- **WHEN** all items in a completed batch have status `done` after QA
- **THEN** the manager SHALL double the batch size for the next batch

#### Scenario: Batch size capped by max-batch-size on increase
- **WHEN** all items in a completed batch have status `done` after QA and doubling the batch size would exceed `max-batch-size`
- **THEN** the manager SHALL set the batch size to `max-batch-size` for the next batch

#### Scenario: Batch size increases without cap
- **WHEN** all items in a completed batch have status `done` after QA and `max-batch-size` is omitted
- **THEN** the manager SHALL double the batch size for the next batch with no upper bound

#### Scenario: Batch size decreases on any failure
- **WHEN** one or more items in a completed batch have status `failed` (after dev or QA)
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
