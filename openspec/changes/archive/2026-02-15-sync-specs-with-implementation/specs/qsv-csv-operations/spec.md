## MODIFIED Requirements

### Requirement: Cell update operations
The system SHALL update individual cell values in `table.csv` using `flock -x <table_path> qsv edit` with the `-i` (in-place) flag. The column SHALL be specified by name and the row by 0-based index. All cell updates SHALL be wrapped with `flock -x` for exclusive file locking.

#### Scenario: Update a status cell
- **WHEN** any agent needs to set the item at position 2's `create_page` status to `done`
- **THEN** it SHALL execute `flock -x <table_path> qsv edit -i <table_path> create_page 2 done`

#### Scenario: In-place edit creates backup
- **WHEN** `flock -x <table_path> qsv edit -i` modifies `table.csv`
- **THEN** a `table.csv.bak` file SHALL be created automatically by qsv as a backup of the previous state

### Requirement: Bash permission for qsv
The system SHALL allow `qsv*` and `flock*` commands in the bash permission configuration for the manager agent and the dev agent.

#### Scenario: Manager agent bash permissions
- **WHEN** the manager agent's frontmatter defines bash permissions
- **THEN** it SHALL include `"qsv*": allow` and `"flock*": allow` as exceptions to the default deny-all policy

#### Scenario: Dev agent bash permissions
- **WHEN** the dev agent's frontmatter defines bash permissions
- **THEN** it SHALL include `"qsv*": allow` and `"flock*": allow` as exceptions alongside `"mkdir*": allow`

## REMOVED Requirements

### Requirement: Bash permission for qsv (scenarios only)
**Reason**: QA agent was removed from the framework. Global `opencode.jsonc` is no longer managed by Nightshift.
**Migration**: QA agent bash permissions are no longer needed. Global bash permissions are the responsibility of the target project's `opencode.jsonc`.

The following scenarios are removed from "Bash permission for qsv":

#### Scenario: QA agent bash permissions
**Reason**: QA agent no longer exists in the framework.
**Migration**: No migration needed; the QA agent and its permissions have been removed.

#### Scenario: Global bash permissions
**Reason**: Nightshift no longer manages or templates `opencode.jsonc` for target projects. The global config file was removed from this project when the CLI installer model was adopted.
**Migration**: Target projects manage their own `opencode.jsonc` bash permissions.
