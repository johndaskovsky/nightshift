## MODIFIED Requirements

### Requirement: Task validation section
The Validation section SHALL describe criteria the dev agent uses for self-validation of task completion on a single item. Each criterion SHALL be independently verifiable.

#### Scenario: Validation criteria format
- **WHEN** a validation section is read
- **THEN** it SHALL contain one or more checkable criteria as a bulleted list, each describing an observable outcome

#### Scenario: Dev uses validation criteria for self-validation
- **WHEN** the dev agent completes task steps on an item
- **THEN** it SHALL check each validation criterion independently and report pass/fail per criterion as part of self-validation

#### Scenario: All criteria must pass
- **WHEN** the dev agent evaluates validation criteria for an item-task
- **THEN** the item-task SHALL be marked `done` only if ALL criteria pass, otherwise it SHALL be marked `failed`

### Requirement: Task test execution
The system SHALL support running a single task on a single table item for testing purposes, without affecting other items or tasks in the shift.

#### Scenario: Test a task on one row
- **WHEN** a user invokes test-task for task "create_page" on row 5
- **THEN** the system SHALL execute the task steps on row 5 only, run self-validation, and report the result without updating the table status

#### Scenario: Test preserves table state
- **WHEN** a test-task execution completes
- **THEN** the table.csv SHALL NOT be modified (status columns remain unchanged)

### Requirement: Task execution produces observable output
The dev agent SHALL report the results of each step execution so that the manager has visibility into what was done.

#### Scenario: Dev reports step results
- **WHEN** the dev agent completes executing steps for an item
- **THEN** it SHALL return a structured summary including: which steps succeeded, which failed, any captured values (e.g., URLs, IDs), and any error messages

#### Scenario: Failed step halts execution
- **WHEN** a step fails during execution
- **THEN** the dev agent SHALL stop executing remaining steps for that item and report the failure with the step number and error details
