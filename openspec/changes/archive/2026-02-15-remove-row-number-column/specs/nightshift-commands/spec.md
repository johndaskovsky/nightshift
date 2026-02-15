## MODIFIED Requirements

### Requirement: Create shift command
The system SHALL provide a `/nightshift-create` command that scaffolds a new shift with a manager file, an empty table, and optionally one or more initial task files.

#### Scenario: Create shift with name only
- **WHEN** user runs `/nightshift-create my-batch-job`
- **THEN** the system SHALL create `.nightshift/my-batch-job/` containing `manager.md` with default template and an empty `table.csv` with no columns (header row added when tasks are defined)

#### Scenario: Create shift interactively
- **WHEN** user runs `/nightshift-create` without a name
- **THEN** the system SHALL prompt the user to describe what the shift will do and derive a kebab-case name from their description

#### Scenario: Shift name already exists
- **WHEN** user runs `/nightshift-create my-batch-job` and `.nightshift/my-batch-job/` already exists
- **THEN** the system SHALL report that the shift already exists and suggest using `/nightshift-start` to resume it

### Requirement: Test task command
The system SHALL provide a `/nightshift-test-task` command that executes a single task on a single table row for testing without modifying table state. Row data SHALL be read using `qsv slice` and `qsv select`.

#### Scenario: Test specific task and item
- **WHEN** user runs `/nightshift-test-task my-batch-job` and specifies task "create_page" and item 3 (1-based display label)
- **THEN** the system SHALL extract the item's data using `qsv slice --index 2 table.csv` (converting 1-based display label to 0-based qsv index), execute the task steps, run self-validation, and display the full results without updating table.csv

#### Scenario: Test prompts for task and item
- **WHEN** user runs `/nightshift-test-task my-batch-job` without specifying task or item
- **THEN** the system SHALL use `qsv headers --just-names` to list available task columns and prompt for task selection, then use `qsv count` to determine the valid item range and prompt for an item number (displayed as 1-based)

#### Scenario: Test reports detailed results
- **WHEN** a test-task execution completes
- **THEN** the system SHALL display: each step's outcome (pass/fail), any captured values, each validation criterion result, and an overall pass/fail summary

### Requirement: Update table command
The system SHALL provide a `/nightshift-update-table` command that supports bulk modifications to the shift table. Row appending SHALL use `qsv cat rows`.

#### Scenario: Add rows from data source
- **WHEN** user runs `/nightshift-update-table my-batch-job` and provides new item data
- **THEN** the system SHALL construct a temporary CSV with the new rows and append them to `table.csv` using `qsv cat rows`, with all task status columns set to `todo`

#### Scenario: Modify metadata columns
- **WHEN** user requests updating a metadata column across multiple rows
- **THEN** the system SHALL use `qsv edit -i` for individual cell updates or construct the updated CSV and write it back, while preserving all status columns

#### Scenario: Reset failed items
- **WHEN** user requests resetting failed items for a specific task
- **THEN** the system SHALL identify failed rows using `qsv search --exact failed --select <task-column>` and update each to `todo` using `qsv edit -i`

#### Scenario: Confirm destructive changes
- **WHEN** a table update would modify status columns or remove rows
- **THEN** the system SHALL display a summary of changes and prompt for confirmation before applying
