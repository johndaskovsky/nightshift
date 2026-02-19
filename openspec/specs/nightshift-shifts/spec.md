## ADDED Requirements

### Requirement: Shift directory structure
The system SHALL store shifts in a `.nightshift/` directory at the repository root. Each shift SHALL be a subdirectory containing a `manager.md`, `table.csv`, one or more task files, and an optional `.env` file for environment variables. The `.env` file SHALL be excluded from version control.

#### Scenario: New shift directory layout
- **WHEN** a shift named "create-promo-examples" is created
- **THEN** the directory `.nightshift/create-promo-examples/` SHALL exist containing at minimum `manager.md` and `table.csv`

#### Scenario: Shift directory with .env file
- **WHEN** a user creates a `.env` file in `.nightshift/create-promo-examples/`
- **THEN** the file SHALL be recognized as the shift's environment variable source and SHALL be excluded from version control by the `.gitignore` pattern

#### Scenario: Archive directory exists
- **WHEN** the `.nightshift/` directory is initialized
- **THEN** a `.nightshift/archive/` subdirectory SHALL exist for storing completed shifts

### Requirement: Shift naming convention
The system SHALL require shift names to be kebab-case identifiers (lowercase letters, numbers, and hyphens only).

#### Scenario: Valid shift name
- **WHEN** a shift is created with name "process-client-pages"
- **THEN** the shift SHALL be created successfully

#### Scenario: Invalid shift name rejected
- **WHEN** a shift is created with name "Process Client Pages" or "process_client_pages"
- **THEN** the system SHALL reject the name and report that kebab-case is required

### Requirement: Manager file format
The system SHALL use `manager.md` as the shift execution manifest. The file SHALL contain a Shift Configuration section and a Task Order section. The Shift Configuration section SHALL support an optional `parallel` field, an optional `current-batch-size` field, an optional `max-batch-size` field, and an optional `disable-self-improvement` field. The `current-batch-size` and `max-batch-size` fields SHALL only be meaningful when `parallel: true` is set.

#### Scenario: Manager file structure
- **WHEN** a manager.md file is read
- **THEN** it SHALL contain a `## Shift Configuration` section with `name` and `created` fields (and optionally `parallel`, `current-batch-size`, `max-batch-size`, and `disable-self-improvement`), and a `## Task Order` section with a numbered list of task names

#### Scenario: Task order references valid task files
- **WHEN** the Task Order section lists task name "create_page"
- **THEN** a corresponding file `create_page.md` SHALL exist in the shift directory

#### Scenario: Parallel field enabled
- **WHEN** a manager.md file contains `parallel: true` in the Shift Configuration section
- **THEN** the manager agent SHALL use adaptive batch sizing to process multiple rows concurrently for each task

#### Scenario: Parallel field omitted
- **WHEN** a manager.md file does not contain a `parallel` field in the Shift Configuration section
- **THEN** the manager agent SHALL process rows sequentially (batch size of 1)

#### Scenario: Parallel field set to false
- **WHEN** a manager.md file contains `parallel: false` in the Shift Configuration section
- **THEN** the manager agent SHALL process rows sequentially, equivalent to omitting the field

#### Scenario: Current-batch-size field present with parallel
- **WHEN** a manager.md file contains `parallel: true` and `current-batch-size: 4` in the Shift Configuration section
- **THEN** the manager agent SHALL use 4 as the initial batch size for adaptive batch sizing

#### Scenario: Current-batch-size field absent with parallel
- **WHEN** a manager.md file contains `parallel: true` but does not contain a `current-batch-size` field
- **THEN** the manager agent SHALL use the default initial batch size of 2

#### Scenario: Max-batch-size field present with parallel
- **WHEN** a manager.md file contains `parallel: true` and `max-batch-size: 10` in the Shift Configuration section
- **THEN** the manager agent SHALL not allow the adaptive batch size to exceed 10

#### Scenario: Max-batch-size field absent with parallel
- **WHEN** a manager.md file contains `parallel: true` but does not contain a `max-batch-size` field
- **THEN** the manager agent SHALL allow the adaptive batch size to grow without an upper bound

#### Scenario: Batch size fields without parallel
- **WHEN** a manager.md file contains `current-batch-size` or `max-batch-size` but does not contain `parallel: true`
- **THEN** the fields SHALL be ignored and the manager agent SHALL process rows sequentially

#### Scenario: Manager updates current-batch-size during execution
- **WHEN** the manager agent adjusts the batch size after completing a batch
- **THEN** it SHALL update the `current-batch-size` field in the Shift Configuration section of `manager.md` to reflect the new batch size

#### Scenario: Disable-self-improvement field present
- **WHEN** a manager.md file contains `disable-self-improvement: true` in the Shift Configuration section
- **THEN** the manager agent SHALL skip the Apply Step Improvements step and pass the flag to dev agents so they skip the Identify Recommendations step

#### Scenario: Disable-self-improvement field absent
- **WHEN** a manager.md file does not contain a `disable-self-improvement` field
- **THEN** the manager agent SHALL run the self-improvement cycle as normal (default behavior)

### Requirement: Table file format
The system SHALL use `table.csv` as the canonical data store for shift items. The CSV SHALL conform to RFC 4180 standard formatting to ensure compatibility with `qsv` and other CSV tools. The CSV SHALL contain metadata columns for item context and one status column per task defined in the shift.

#### Scenario: Table structure with tasks
- **WHEN** a shift has tasks "create_page" and "update_spreadsheet"
- **THEN** `table.csv` SHALL contain any item metadata columns, `create_page` (status), and `update_spreadsheet` (status)

#### Scenario: Initial status values
- **WHEN** a new table is created with items
- **THEN** all task status columns SHALL be initialized to `todo`

#### Scenario: RFC 4180 compliance
- **WHEN** `table.csv` is created or modified
- **THEN** the file SHALL conform to RFC 4180 CSV formatting: comma-delimited, optional double-quote escaping, CRLF or LF line endings, with a required header row

### Requirement: Table status values
The system SHALL track item-task status using exactly three values: `todo`, `done`, `failed`.

#### Scenario: Valid status transitions
- **WHEN** an item-task status is updated
- **THEN** it SHALL follow the transition path: `todo` → `done`, or `todo` → `failed`, or `failed` → `todo` (for re-queuing)

#### Scenario: Invalid status value rejected
- **WHEN** a status update attempts to set a value other than `todo`, `done`, or `failed`
- **THEN** the system SHALL reject the update

### Requirement: Shift archival
The system SHALL support archiving completed shifts by moving them from `.nightshift/<name>/` to `.nightshift/archive/<date>-<name>/` where date is in ISO YYYY-MM-DD format.

#### Scenario: Archive a completed shift
- **WHEN** shift "create-promo-examples" is archived on 2026-02-08
- **THEN** the directory SHALL be moved to `.nightshift/archive/2026-02-08-create-promo-examples/`

#### Scenario: Archive preserves all files
- **WHEN** a shift is archived
- **THEN** all files (manager.md, table.csv, task files) SHALL be preserved in the archive location

#### Scenario: Duplicate archive name
- **WHEN** an archive target `.nightshift/archive/2026-02-08-create-promo-examples/` already exists
- **THEN** the system SHALL report an error and not overwrite the existing archive

### Requirement: Shift resumability
The system SHALL support resuming interrupted shifts by querying `table.csv` status columns using `qsv search` to determine remaining work.

#### Scenario: Resume after interruption
- **WHEN** a shift is started and `qsv search --exact todo --select <task-column>` returns matching rows
- **THEN** the system SHALL process those items, skipping items with status `done`
