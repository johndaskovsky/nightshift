### Requirement: qsv CLI dependency
The system SHALL require [qsv](https://github.com/dathere/qsv) as the CLI tool for all CSV operations on `table.csv`. qsv SHALL be a required external dependency, installable via `brew install qsv`. The system SHALL NOT operate without qsv.

#### Scenario: qsv is available
- **WHEN** the `qsv` binary is on the system PATH
- **THEN** all CSV operations on `table.csv` SHALL use `flock -x <table_path> qsv` subcommands

#### Scenario: qsv is not available
- **WHEN** the `qsv` binary is not found on the system PATH
- **THEN** the system SHALL display an error with installation instructions (`brew install qsv`) during pre-flight checks and SHALL block shift execution

### Requirement: Cell update operations
The system SHALL update individual cell values in `table.csv` using `flock -x <table_path> qsv edit` with the `-i` (in-place) flag. The column SHALL be specified by name and the row by 0-based index. All cell updates SHALL be wrapped with `flock -x` for exclusive file locking.

#### Scenario: Update a status cell
- **WHEN** any agent needs to set row 3's `create_page` status to `qa`
- **THEN** it SHALL execute `flock -x <table_path> qsv edit -i <table_path> create_page 2 qa`

#### Scenario: In-place edit creates backup
- **WHEN** `flock -x <table_path> qsv edit -i` modifies `table.csv`
- **THEN** a `table.csv.bak` file SHALL be created automatically by qsv as a backup of the previous state

### Requirement: Cell read operations
The system SHALL read individual cell values from `table.csv` by piping `flock -x <table_path> qsv slice` into `qsv select`. The row index SHALL be 0-based (excluding the header row), requiring a conversion from Nightshift's 1-based `row` column: `qsv_index = row_number - 1`. All read operations SHALL be wrapped with `flock -x` for consistent reads.

#### Scenario: Read a single cell value
- **WHEN** any agent needs the `create_page` status for row 3
- **THEN** it SHALL execute `flock -x <table_path> qsv slice --index 2 <table_path> | qsv select create_page` (index 2 because row 3 maps to 0-based index 2)

#### Scenario: Read an entire row
- **WHEN** any agent needs all metadata for row 5
- **THEN** it SHALL execute `flock -x <table_path> qsv slice --index 4 <table_path>`

#### Scenario: Read a column across all rows
- **WHEN** any agent needs all values from the `create_page` column
- **THEN** it SHALL execute `flock -x <table_path> qsv select row,create_page <table_path>`

### Requirement: Row counting
The system SHALL count data rows in `table.csv` using `flock -x <table_path> qsv count`, which excludes the header row.

#### Scenario: Count all items
- **WHEN** any agent needs the total number of items in the shift
- **THEN** it SHALL execute `flock -x <table_path> qsv count <table_path>` to get the row count

### Requirement: Row filtering by status
The system SHALL filter rows by column value using `flock -x <table_path> qsv search` with the `--exact` and `--select` flags.

#### Scenario: Find all todo items for a task
- **WHEN** any agent needs to identify items with status `todo` for task `create_page`
- **THEN** it SHALL execute `flock -x <table_path> qsv search --exact todo --select create_page <table_path>`

#### Scenario: Find all non-done items
- **WHEN** any agent needs to find items that are not yet complete
- **THEN** it SHALL execute `flock -x <table_path> qsv search --exact done --select create_page --invert-match <table_path>`

#### Scenario: Quick existence check
- **WHEN** any agent needs to check whether any item has status `failed`
- **THEN** it SHALL execute `flock -x <table_path> qsv search --exact failed --select create_page --quick <table_path>` and inspect the exit code (0 = found, non-zero = not found)

#### Scenario: Count items matching a status
- **WHEN** any agent needs to count how many items have status `done`
- **THEN** it SHALL execute `flock -x <table_path> qsv search --exact done --select create_page <table_path> | qsv count`

### Requirement: Column addition
The system SHALL add new columns to `table.csv` using `flock -x <table_path> qsv enum` with `--constant` and `--new-column` flags.

#### Scenario: Add a task status column
- **WHEN** a new task `qa_check` is added to a shift
- **THEN** the system SHALL execute `flock -x <table_path> qsv enum --constant todo --new-column qa_check <table_path>` and write the output back to `table.csv`

### Requirement: Row appending
The system SHALL append rows to `table.csv` using `flock -x <table_path> qsv cat rows`.

#### Scenario: Append new items
- **WHEN** new items are added to a shift
- **THEN** the system SHALL construct a temporary CSV with matching headers and the new rows, then execute `flock -x <table_path> qsv cat rows <table_path> newrows.csv` and write the output back to `table.csv`

### Requirement: Header inspection
The system SHALL inspect column names in `table.csv` using `flock -x <table_path> qsv headers`.

#### Scenario: List all column names
- **WHEN** the system needs to enumerate columns in the table
- **THEN** it SHALL execute `flock -x <table_path> qsv headers --just-names <table_path>`

#### Scenario: Count columns
- **WHEN** the system needs the number of columns
- **THEN** it SHALL execute `flock -x <table_path> qsv headers --just-count <table_path>`

### Requirement: Table display
The system SHALL display `table.csv` contents in human-readable format using `flock -x <table_path> qsv table`.

#### Scenario: Pretty-print table for user
- **WHEN** a command needs to show the table to the user (e.g., during pre-flight summary or after updates)
- **THEN** it SHALL execute `flock -x <table_path> qsv table <table_path>` to produce an aligned, readable output

### Requirement: Bash permission for qsv
The system SHALL allow `qsv*` and `flock*` commands in the bash permission configuration for the manager agent, the dev agent, the QA agent, and the global OpenCode permissions.

#### Scenario: Manager agent bash permissions
- **WHEN** the manager agent's frontmatter defines bash permissions
- **THEN** it SHALL include `"qsv*": allow` and `"flock*": allow` as exceptions to the default deny-all policy

#### Scenario: Dev agent bash permissions
- **WHEN** the dev agent's frontmatter defines bash permissions
- **THEN** it SHALL include `"qsv*": allow` and `"flock*": allow` as exceptions alongside `"mkdir*": allow`

#### Scenario: QA agent bash permissions
- **WHEN** the QA agent's frontmatter defines bash permissions
- **THEN** it SHALL include `"qsv*": allow` and `"flock*": allow` as exceptions to the default deny-all policy

#### Scenario: Global bash permissions
- **WHEN** the global `opencode.jsonc` defines bash permissions
- **THEN** it SHALL include `"qsv*": "allow"` and `"flock*": "allow"` in the bash permission block
