## ADDED Requirements

### Requirement: qsv CLI dependency
The system SHALL use [qsv](https://github.com/dathere/qsv) as the recommended CLI tool for all CSV operations on `table.csv`. qsv SHALL be an optional but strongly recommended external dependency, installable via `brew install qsv`.

#### Scenario: qsv is available
- **WHEN** the `qsv` binary is on the system PATH
- **THEN** all CSV operations on `table.csv` SHALL use qsv subcommands instead of Read/Write tool patterns

#### Scenario: qsv is not available
- **WHEN** the `qsv` binary is not found on the system PATH
- **THEN** the system SHALL display a warning with installation instructions (`brew install qsv`) during pre-flight checks but SHALL NOT block shift execution

### Requirement: Cell read operations
The system SHALL read individual cell values from `table.csv` by piping `qsv slice` into `qsv select`. The row index SHALL be 0-based (excluding the header row), requiring a conversion from Nightshift's 1-based `row` column: `qsv_index = row_number - 1`.

#### Scenario: Read a single cell value
- **WHEN** the manager needs the `create-page` status for row 3
- **THEN** it SHALL execute `qsv slice --index 2 table.csv | qsv select create-page` (index 2 because row 3 maps to 0-based index 2)

#### Scenario: Read an entire row
- **WHEN** the manager needs all metadata for row 5
- **THEN** it SHALL execute `qsv slice --index 4 table.csv`

#### Scenario: Read a column across all rows
- **WHEN** the manager needs all values from the `create-page` column
- **THEN** it SHALL execute `qsv select row,create-page table.csv`

### Requirement: Cell update operations
The system SHALL update individual cell values in `table.csv` using `qsv edit` with the `-i` (in-place) flag. The column SHALL be specified by name and the row by 0-based index.

#### Scenario: Update a status cell
- **WHEN** the manager needs to set row 3's `create-page` status to `in_progress`
- **THEN** it SHALL execute `qsv edit -i table.csv create-page 2 in_progress`

#### Scenario: In-place edit creates backup
- **WHEN** `qsv edit -i` modifies `table.csv`
- **THEN** a `table.csv.bak` file SHALL be created automatically by qsv as a backup of the previous state

### Requirement: Row counting
The system SHALL count data rows in `table.csv` using `qsv count`, which excludes the header row.

#### Scenario: Count all items
- **WHEN** the manager needs the total number of items in the shift
- **THEN** it SHALL execute `qsv count table.csv` to get the row count

### Requirement: Row filtering by status
The system SHALL filter rows by column value using `qsv search` with the `--exact` and `--select` flags.

#### Scenario: Find all todo items for a task
- **WHEN** the manager needs to identify items with status `todo` for task `create-page`
- **THEN** it SHALL execute `qsv search --exact todo --select create-page table.csv`

#### Scenario: Find all non-done items
- **WHEN** the manager needs to find items that are not yet complete
- **THEN** it SHALL execute `qsv search --exact done --select create-page --invert-match table.csv`

#### Scenario: Quick existence check
- **WHEN** the manager needs to check whether any item has status `failed`
- **THEN** it SHALL execute `qsv search --exact failed --select create-page --quick table.csv` and inspect the exit code (0 = found, non-zero = not found)

#### Scenario: Count items matching a status
- **WHEN** the manager needs to count how many items have status `done`
- **THEN** it SHALL execute `qsv search --exact done --select create-page table.csv | qsv count`

### Requirement: Column addition
The system SHALL add new columns to `table.csv` using `qsv enum` with `--constant` and `--new-column` flags.

#### Scenario: Add a task status column
- **WHEN** a new task `qa-check` is added to a shift
- **THEN** the system SHALL execute `qsv enum --constant todo --new-column qa-check table.csv` and write the output back to `table.csv`

### Requirement: Row appending
The system SHALL append rows to `table.csv` using `qsv cat rows`.

#### Scenario: Append new items
- **WHEN** new items are added to a shift
- **THEN** the system SHALL construct a temporary CSV with matching headers and the new rows, then execute `qsv cat rows table.csv newrows.csv` and write the output back to `table.csv`

### Requirement: Header inspection
The system SHALL inspect column names in `table.csv` using `qsv headers`.

#### Scenario: List all column names
- **WHEN** the system needs to enumerate columns in the table
- **THEN** it SHALL execute `qsv headers --just-names table.csv`

#### Scenario: Count columns
- **WHEN** the system needs the number of columns
- **THEN** it SHALL execute `qsv headers --just-count table.csv`

### Requirement: Table display
The system SHALL display `table.csv` contents in human-readable format using `qsv table`.

#### Scenario: Pretty-print table for user
- **WHEN** a command needs to show the table to the user (e.g., during pre-flight summary or after updates)
- **THEN** it SHALL execute `qsv table table.csv` to produce an aligned, readable output

### Requirement: Bash permission for qsv
The system SHALL allow `qsv*` commands in the bash permission configuration for both the manager agent and the global OpenCode permissions.

#### Scenario: Manager agent bash permissions
- **WHEN** the manager agent's frontmatter defines bash permissions
- **THEN** it SHALL include `"qsv*": allow` as an exception to the default deny-all policy

#### Scenario: Global bash permissions
- **WHEN** the global `opencode.jsonc` defines bash permissions
- **THEN** it SHALL include `"qsv*": "allow"` in the bash permission block
