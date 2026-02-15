## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Row numbering
**Reason**: The `row` column stored redundant positional information. All qsv operations use 0-based positional indices, and the system enforces no row reordering, making physical CSV position sufficient.
**Migration**: Remove the `row` column from new tables. Existing tables with a `row` column continue to work (qsv ignores unused columns). Agents use 0-based positional indices directly instead of converting from 1-based row numbers.
