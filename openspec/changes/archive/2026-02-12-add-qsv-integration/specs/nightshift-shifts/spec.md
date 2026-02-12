## MODIFIED Requirements

### Requirement: Table file format
The system SHALL use `table.csv` as the canonical data store for shift items. The CSV SHALL conform to RFC 4180 standard formatting to ensure compatibility with `qsv` and other CSV tools. The CSV SHALL contain a `row` column, metadata columns for item context, and one status column per task defined in the shift.

#### Scenario: Table structure with tasks
- **WHEN** a shift has tasks "create-page" and "update-spreadsheet"
- **THEN** `table.csv` SHALL contain columns `row`, any item metadata columns, `create-page` (status), and `update-spreadsheet` (status)

#### Scenario: Row numbering
- **WHEN** items are added to the table
- **THEN** the `row` column SHALL contain sequential integers starting from 1

#### Scenario: Initial status values
- **WHEN** a new table is created with items
- **THEN** all task status columns SHALL be initialized to `todo`

#### Scenario: RFC 4180 compliance
- **WHEN** `table.csv` is created or modified
- **THEN** the file SHALL conform to RFC 4180 CSV formatting: comma-delimited, optional double-quote escaping, CRLF or LF line endings, with a required header row

### Requirement: Shift resumability
The system SHALL support resuming interrupted shifts by querying `table.csv` status columns using `qsv search` to determine remaining work.

#### Scenario: Resume after interruption
- **WHEN** a shift is started and `qsv search --exact todo --select <task-column>` returns matching rows
- **THEN** the system SHALL process those items, skipping items with status `done`

#### Scenario: Detect in-progress items on resume
- **WHEN** a shift is resumed and `qsv search --exact in_progress --select <task-column>` or `qsv search --exact qa --select <task-column>` returns matching rows
- **THEN** the system SHALL treat those items as needing re-processing (reset to `todo` using `qsv edit -i`) since the previous execution was interrupted
