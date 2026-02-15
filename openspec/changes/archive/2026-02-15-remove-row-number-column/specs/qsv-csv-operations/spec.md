## MODIFIED Requirements

### Requirement: Cell read operations
The system SHALL read individual cell values from `table.csv` by piping `flock -x <table_path> qsv slice` into `qsv select`. The row index SHALL be 0-based (excluding the header row), corresponding directly to the item's physical position in the CSV. All read operations SHALL be wrapped with `flock -x` for consistent reads.

#### Scenario: Read a single cell value
- **WHEN** any agent needs the `create_page` status for the item at position 2 (0-based)
- **THEN** it SHALL execute `flock -x <table_path> qsv slice --index 2 <table_path> | qsv select create_page`

#### Scenario: Read an entire row
- **WHEN** any agent needs all metadata for the item at position 4 (0-based)
- **THEN** it SHALL execute `flock -x <table_path> qsv slice --index 4 <table_path>`

#### Scenario: Read a column across all rows
- **WHEN** any agent needs all values from the `create_page` column
- **THEN** it SHALL execute `flock -x <table_path> qsv select create_page <table_path>`

### Requirement: Cell update operations
The system SHALL update individual cell values in `table.csv` using `flock -x <table_path> qsv edit` with the `-i` (in-place) flag. The column SHALL be specified by name and the row by 0-based index. All cell updates SHALL be wrapped with `flock -x` for exclusive file locking.

#### Scenario: Update a status cell
- **WHEN** any agent needs to set the item at position 2's `create_page` status to `qa`
- **THEN** it SHALL execute `flock -x <table_path> qsv edit -i <table_path> create_page 2 qa`

#### Scenario: In-place edit creates backup
- **WHEN** `flock -x <table_path> qsv edit -i` modifies `table.csv`
- **THEN** a `table.csv.bak` file SHALL be created automatically by qsv as a backup of the previous state

## REMOVED Requirements

### Requirement: Row index conversion formula
**Reason**: The `qsv_index = row_number - 1` conversion existed solely to bridge the 1-based `row` column and qsv's 0-based positional indexing. With the `row` column removed, agents use 0-based positional indices directly, eliminating the conversion step.
**Migration**: Replace all instances of `qsv_index = row_number - 1` with direct use of 0-based positional indices. The qsv index IS the item's position.
