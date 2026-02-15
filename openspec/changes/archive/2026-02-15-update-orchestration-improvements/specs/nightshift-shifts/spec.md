## MODIFIED Requirements

### Requirement: Table status values
The system SHALL track item-task status using exactly four values: `todo`, `qa`, `done`, `failed`.

#### Scenario: Valid status transitions
- **WHEN** an item-task status is updated
- **THEN** it SHALL follow the transition path: `todo` -> `qa` -> `done`, or `todo` -> `qa` -> `failed`, or `todo` -> `failed`, or `failed` -> `todo` (for re-queuing)

#### Scenario: Invalid status value rejected
- **WHEN** a status update attempts to set a value other than `todo`, `qa`, `done`, or `failed`
- **THEN** the system SHALL reject the update

#### Scenario: Dev agent writes todo to qa transition
- **WHEN** the dev agent completes successful execution of a task on an item
- **THEN** it SHALL write the status transition from `todo` to `qa` in `table.csv`

#### Scenario: Dev agent writes todo to failed transition
- **WHEN** the dev agent fails execution of a task on an item (after exhausting retries)
- **THEN** it SHALL write the status transition from `todo` to `failed` in `table.csv`

#### Scenario: QA agent writes qa to done transition
- **WHEN** the QA agent passes all validation criteria for an item-task
- **THEN** it SHALL write the status transition from `qa` to `done` in `table.csv`

#### Scenario: QA agent writes qa to failed transition
- **WHEN** the QA agent fails any validation criterion for an item-task
- **THEN** it SHALL write the status transition from `qa` to `failed` in `table.csv`

### Requirement: Shift resumability
The system SHALL support resuming interrupted shifts by querying `table.csv` status columns using `flock -x <table_path> qsv search` to determine remaining work. There are no transient states to recover from -- items are either `todo` (available for processing), `qa` (awaiting QA verification), `done`, or `failed`.

#### Scenario: Resume after interruption
- **WHEN** a shift is started and `flock -x <table_path> qsv search --exact todo --select <task-column> <table_path>` returns matching rows
- **THEN** the system SHALL process those items, skipping items with status `done`

#### Scenario: Resume with qa items
- **WHEN** a shift is resumed and `flock -x <table_path> qsv search --exact qa --select <task-column> <table_path>` returns matching rows
- **THEN** the system SHALL dispatch QA agents for those items, as the `qa` status indicates the dev agent completed successfully but QA verification was not yet performed or was interrupted

## REMOVED Requirements

### Requirement: Table status values
**Reason:** Replaced by updated requirement with the same name that removes `in_progress` from the valid status set. The state machine is simplified from 5 states to 4 states.
**Migration:** Any existing `table.csv` files with `in_progress` values SHALL have those values manually updated to `todo` before running with the new version.

### Requirement: Shift resumability
**Reason:** Replaced by updated requirement with the same name that removes stale-state recovery logic. The `in_progress` status no longer exists, so there are no transient states to reset. The `qa` status is now a durable state that SHALL NOT be reset on resume.
**Migration:** Remove the logic that resets `in_progress` and `qa` statuses to `todo` on startup. Items in `qa` state should be dispatched to QA, not reset.
