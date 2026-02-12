## MODIFIED Requirements

### Requirement: Start shift command
The system SHALL provide a `/nightshift-start` command that begins or resumes execution of a shift by invoking the manager agent. The command SHALL perform a pre-flight check for qsv availability.

#### Scenario: Start a new shift
- **WHEN** user runs `/nightshift-start my-batch-job` and all table statuses are `todo`
- **THEN** the system SHALL invoke the nightshift-manager agent to begin processing items from the first row and first task

#### Scenario: Resume an interrupted shift
- **WHEN** user runs `/nightshift-start my-batch-job` and the table contains a mix of `done`, `todo`, and `failed` statuses
- **THEN** the system SHALL invoke the nightshift-manager agent, which SHALL skip `done` items and process remaining `todo` and re-queued items

#### Scenario: Start without shift name prompts selection
- **WHEN** user runs `/nightshift-start` without a name and multiple active shifts exist
- **THEN** the system SHALL list available shifts and prompt the user to select one

#### Scenario: All items complete
- **WHEN** user runs `/nightshift-start my-batch-job` and all item-task statuses are `done`
- **THEN** the system SHALL report that the shift is complete and suggest archiving with `/nightshift-archive`

#### Scenario: Pre-flight qsv check passes
- **WHEN** `/nightshift-start` runs pre-flight checks and `qsv --version` succeeds
- **THEN** the system SHALL include the qsv version in the pre-flight summary and proceed normally

#### Scenario: Pre-flight qsv check fails
- **WHEN** `/nightshift-start` runs pre-flight checks and `qsv --version` fails (command not found)
- **THEN** the system SHALL display a warning that qsv is not installed, recommend `brew install qsv`, and proceed with shift execution without blocking

#### Scenario: Pre-flight reads table status with qsv
- **WHEN** `/nightshift-start` performs pre-flight checks and qsv is available
- **THEN** it SHALL use `qsv count`, `qsv search`, and `qsv table` to read and display the table summary instead of reading the full file with the Read tool

### Requirement: Add task command
The system SHALL provide a `/nightshift-add-task` command that adds a new task file to an existing shift and updates the table with a new status column. The column addition SHALL use `qsv enum`.

#### Scenario: Add task to shift
- **WHEN** user runs `/nightshift-add-task my-batch-job` and provides task details
- **THEN** the system SHALL create a new task file in `.nightshift/my-batch-job/`, add a corresponding status column to `table.csv` using `qsv enum --constant todo --new-column <task-name>` initialized to `todo` for all rows, and update `manager.md` task order

#### Scenario: Add task interactively
- **WHEN** user runs `/nightshift-add-task` without specifying a shift
- **THEN** the system SHALL prompt for shift selection and then guide the user through defining the task's configuration, steps, and validation sections

#### Scenario: Task name conflicts with existing task
- **WHEN** a task is added with a name that matches an existing task file
- **THEN** the system SHALL report the conflict and suggest a different name

### Requirement: Update table command
The system SHALL provide a `/nightshift-update-table` command that supports bulk modifications to the shift table. Row appending SHALL use `qsv cat rows`.

#### Scenario: Add rows from data source
- **WHEN** user runs `/nightshift-update-table my-batch-job` and provides new item data
- **THEN** the system SHALL construct a temporary CSV with the new rows and append them to `table.csv` using `qsv cat rows`, with sequential row numbers continuing from the last row and all task status columns set to `todo`

#### Scenario: Modify metadata columns
- **WHEN** user requests updating a metadata column across multiple rows
- **THEN** the system SHALL use `qsv edit -i` for individual cell updates or construct the updated CSV and write it back, while preserving all status columns

#### Scenario: Reset failed items
- **WHEN** user requests resetting failed items for a specific task
- **THEN** the system SHALL identify failed rows using `qsv search --exact failed --select <task-column>` and update each to `todo` using `qsv edit -i`

#### Scenario: Confirm destructive changes
- **WHEN** a table update would modify status columns or remove rows
- **THEN** the system SHALL display a summary of changes and prompt for confirmation before applying

### Requirement: Archive shift command
The system SHALL provide a `/nightshift-archive` command that moves a completed shift to the archive directory with a date prefix. The status check SHALL use `qsv search`.

#### Scenario: Archive a shift
- **WHEN** user runs `/nightshift-archive my-batch-job`
- **THEN** the system SHALL move `.nightshift/my-batch-job/` to `.nightshift/archive/YYYY-MM-DD-my-batch-job/` using the current date

#### Scenario: Archive with incomplete items warns
- **WHEN** user runs `/nightshift-archive my-batch-job` and `qsv search --exact done --invert-match` finds rows with non-done statuses in any task column
- **THEN** the system SHALL warn the user about incomplete items and prompt for confirmation before archiving

#### Scenario: No shift name prompts selection
- **WHEN** user runs `/nightshift-archive` without a name
- **THEN** the system SHALL list available shifts and prompt the user to select one

### Requirement: Test task command
The system SHALL provide a `/nightshift-test-task` command that executes a single task on a single table row for testing without modifying table state. Row data SHALL be read using `qsv slice` and `qsv select`.

#### Scenario: Test specific task and row
- **WHEN** user runs `/nightshift-test-task my-batch-job` and specifies task "create-page" and row 3
- **THEN** the system SHALL extract row 3's data using `qsv slice --index 2 table.csv`, execute the task steps, run QA validation, and display the full results without updating table.csv

#### Scenario: Test prompts for task and row
- **WHEN** user runs `/nightshift-test-task my-batch-job` without specifying task or row
- **THEN** the system SHALL use `qsv headers --just-names` to list available task columns and prompt for task selection, then use `qsv count` to determine valid row range and prompt for row number

#### Scenario: Test reports detailed results
- **WHEN** a test-task execution completes
- **THEN** the system SHALL display: each step's outcome (pass/fail), any captured values, each validation criterion result, and an overall pass/fail summary
