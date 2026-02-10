## ADDED Requirements

### Requirement: Create shift command
The system SHALL provide a `/nightshift-create` command that scaffolds a new shift with a manager file, an empty table, and optionally one or more initial task files.

#### Scenario: Create shift with name only
- **WHEN** user runs `/nightshift-create my-batch-job`
- **THEN** the system SHALL create `.nightshift/my-batch-job/` containing `manager.md` with default template and an empty `table.csv` with only the `row` column

#### Scenario: Create shift interactively
- **WHEN** user runs `/nightshift-create` without a name
- **THEN** the system SHALL prompt the user to describe what the shift will do and derive a kebab-case name from their description

#### Scenario: Shift name already exists
- **WHEN** user runs `/nightshift-create my-batch-job` and `.nightshift/my-batch-job/` already exists
- **THEN** the system SHALL report that the shift already exists and suggest using `/nightshift-start` to resume it

### Requirement: Start shift command
The system SHALL provide a `/nightshift-start` command that begins or resumes execution of a shift by invoking the manager agent.

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

### Requirement: Archive shift command
The system SHALL provide a `/nightshift-archive` command that moves a completed shift to the archive directory with a date prefix.

#### Scenario: Archive a shift
- **WHEN** user runs `/nightshift-archive my-batch-job`
- **THEN** the system SHALL move `.nightshift/my-batch-job/` to `.nightshift/archive/YYYY-MM-DD-my-batch-job/` using the current date

#### Scenario: Archive with incomplete items warns
- **WHEN** user runs `/nightshift-archive my-batch-job` and the table contains items not in `done` status
- **THEN** the system SHALL warn the user about incomplete items and prompt for confirmation before archiving

#### Scenario: No shift name prompts selection
- **WHEN** user runs `/nightshift-archive` without a name
- **THEN** the system SHALL list available shifts and prompt the user to select one

### Requirement: Add task command
The system SHALL provide a `/nightshift-add-task` command that adds a new task file to an existing shift and updates the table with a new status column.

#### Scenario: Add task to shift
- **WHEN** user runs `/nightshift-add-task my-batch-job` and provides task details
- **THEN** the system SHALL create a new task file in `.nightshift/my-batch-job/`, add a corresponding status column to `table.csv` initialized to `todo` for all rows, and update `manager.md` task order

#### Scenario: Add task interactively
- **WHEN** user runs `/nightshift-add-task` without specifying a shift
- **THEN** the system SHALL prompt for shift selection and then guide the user through defining the task's configuration, steps, and validation sections

#### Scenario: Task name conflicts with existing task
- **WHEN** a task is added with a name that matches an existing task file
- **THEN** the system SHALL report the conflict and suggest a different name

### Requirement: Test task command
The system SHALL provide a `/nightshift-test-task` command that executes a single task on a single table row for testing without modifying table state.

#### Scenario: Test specific task and row
- **WHEN** user runs `/nightshift-test-task my-batch-job` and specifies task "create-page" and row 3
- **THEN** the system SHALL execute the task steps on row 3, run QA validation, and display the full results without updating table.csv

#### Scenario: Test prompts for task and row
- **WHEN** user runs `/nightshift-test-task my-batch-job` without specifying task or row
- **THEN** the system SHALL list available tasks and prompt for task selection, then prompt for row number

#### Scenario: Test reports detailed results
- **WHEN** a test-task execution completes
- **THEN** the system SHALL display: each step's outcome (pass/fail), any captured values, each validation criterion result, and an overall pass/fail summary

### Requirement: Update table command
The system SHALL provide a `/nightshift-update-table` command that supports bulk modifications to the shift table.

#### Scenario: Add rows from data source
- **WHEN** user runs `/nightshift-update-table my-batch-job` and provides new item data
- **THEN** the system SHALL append new rows to `table.csv` with sequential row numbers continuing from the last row, and all task status columns set to `todo`

#### Scenario: Modify metadata columns
- **WHEN** user requests updating a metadata column across multiple rows
- **THEN** the system SHALL update the specified column values while preserving all status columns

#### Scenario: Reset failed items
- **WHEN** user requests resetting failed items for a specific task
- **THEN** the system SHALL change all `failed` status values to `todo` for the specified task column only

#### Scenario: Confirm destructive changes
- **WHEN** a table update would modify status columns or remove rows
- **THEN** the system SHALL display a summary of changes and prompt for confirmation before applying
