## ADDED Requirements

### Requirement: Shift directory structure
The system SHALL store shifts in a `.nightshift/` directory at the repository root. Each shift SHALL be a subdirectory containing a `manager.md`, `table.csv`, and one or more task files.

#### Scenario: New shift directory layout
- **WHEN** a shift named "create-promo-examples" is created
- **THEN** the directory `.nightshift/create-promo-examples/` SHALL exist containing at minimum `manager.md` and `table.csv`

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
The system SHALL use `manager.md` as the shift execution manifest. The file SHALL contain a Shift Configuration section, a Task Order section, and a Progress section.

#### Scenario: Manager file structure
- **WHEN** a manager.md file is read
- **THEN** it SHALL contain a `## Shift Configuration` section with `name` and `created` fields, a `## Task Order` section with a numbered list of task names, and a `## Progress` section with `Total items`, `Completed`, `Failed`, and `Remaining` counts

#### Scenario: Task order references valid task files
- **WHEN** the Task Order section lists task name "create-page"
- **THEN** a corresponding file `create-page.md` SHALL exist in the shift directory

### Requirement: Table file format
The system SHALL use `table.csv` as the canonical data store for shift items. The CSV SHALL contain a `row` column, metadata columns for item context, and one status column per task defined in the shift.

#### Scenario: Table structure with tasks
- **WHEN** a shift has tasks "create-page" and "update-spreadsheet"
- **THEN** `table.csv` SHALL contain columns `row`, any item metadata columns, `create-page` (status), and `update-spreadsheet` (status)

#### Scenario: Row numbering
- **WHEN** items are added to the table
- **THEN** the `row` column SHALL contain sequential integers starting from 1

#### Scenario: Initial status values
- **WHEN** a new table is created with items
- **THEN** all task status columns SHALL be initialized to `todo`

### Requirement: Table status values
The system SHALL track item-task status using exactly five values: `todo`, `in_progress`, `qa`, `done`, `failed`.

#### Scenario: Valid status transitions
- **WHEN** an item-task status is updated
- **THEN** it SHALL follow the transition path: `todo` → `in_progress` → `qa` → `done`, or `todo` → `in_progress` → `qa` → `failed`, or `failed` → `todo` (for re-queuing)

#### Scenario: Invalid status value rejected
- **WHEN** a status update attempts to set a value other than `todo`, `in_progress`, `qa`, `done`, or `failed`
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
The system SHALL support resuming interrupted shifts by reading the table.csv status columns to determine remaining work.

#### Scenario: Resume after interruption
- **WHEN** a shift is started and the table contains items with status `todo` or `failed`
- **THEN** the system SHALL process those items, skipping items with status `done`

#### Scenario: Detect in-progress items on resume
- **WHEN** a shift is resumed and items have status `in_progress` or `qa`
- **THEN** the system SHALL treat those items as needing re-processing (reset to `todo`) since the previous execution was interrupted
