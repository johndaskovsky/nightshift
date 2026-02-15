## ADDED Requirements

### Requirement: flock CLI dependency
The system SHALL require [flock](https://github.com/discoteq/flock) as an external CLI dependency for exclusive file locking on `table.csv`. `flock` SHALL be installable via `brew install flock`.

#### Scenario: flock is available
- **WHEN** the `flock` binary is on the system PATH
- **THEN** all `qsv` operations on `table.csv` SHALL be prefixed with `flock -x <table_path>` to acquire an exclusive lock before executing

#### Scenario: flock is not available
- **WHEN** the `flock` binary is not found on the system PATH during pre-flight checks
- **THEN** the system SHALL display an error with installation instructions (`brew install flock`) and SHALL NOT proceed with shift execution

### Requirement: Exclusive file locking for all qsv table operations
The system SHALL wrap every `qsv` command that operates on `table.csv` with `flock -x <table_path>` to acquire an exclusive file lock. This applies to all agents (manager, dev, QA) and all commands that use `qsv` on the shift table.

#### Scenario: Status write with lock
- **WHEN** a dev or QA agent updates an item-task status in `table.csv`
- **THEN** the command SHALL be executed as `flock -x <table_path> qsv edit -i <table_path> <column> <index> <value>`

#### Scenario: Status read with lock
- **WHEN** any agent reads from `table.csv` using `qsv` (search, count, slice, select, headers, table)
- **THEN** the command SHALL be executed as `flock -x <table_path> qsv <subcommand> <table_path> [args]`

#### Scenario: Lock scope is per-command
- **WHEN** a `flock -x` prefixed `qsv` command executes
- **THEN** the exclusive lock SHALL be held only for the duration of that single `qsv` command and released immediately upon completion

#### Scenario: Lock file is the table itself
- **WHEN** `flock -x` is used for table locking
- **THEN** the lock target SHALL be the `table.csv` file path itself, not a separate `.lock` file

#### Scenario: Concurrent agents blocked by lock
- **WHEN** two agents attempt to write to `table.csv` simultaneously
- **THEN** the second agent's `flock -x` SHALL block until the first agent's lock is released, ensuring serialized writes

### Requirement: Dev agent bash permissions for table locking
The dev agent SHALL have `flock*` and `qsv*` commands allowed in its bash permission configuration for writing item-task status to `table.csv`.

#### Scenario: Dev agent can execute flock commands
- **WHEN** the dev agent needs to update its item-task status in `table.csv`
- **THEN** it SHALL execute `flock -x <table_path> qsv edit -i <table_path> <column> <index> <value>` without permission denial

#### Scenario: Dev agent can execute qsv commands
- **WHEN** the dev agent needs to read from or write to `table.csv`
- **THEN** it SHALL execute `qsv` subcommands via the Bash tool without permission denial

### Requirement: QA agent bash permissions for table locking
The QA agent SHALL have `flock*` and `qsv*` commands allowed in its bash permission configuration for writing item-task status to `table.csv`.

#### Scenario: QA agent can execute flock commands
- **WHEN** the QA agent needs to update its item-task status in `table.csv`
- **THEN** it SHALL execute `flock -x <table_path> qsv edit -i <table_path> <column> <index> <value>` without permission denial

#### Scenario: QA agent can execute qsv commands
- **WHEN** the QA agent needs to read from or write to `table.csv`
- **THEN** it SHALL execute `qsv` subcommands via the Bash tool without permission denial

### Requirement: Manager agent bash permissions for flock
The manager agent SHALL have `flock*` commands allowed in its bash permission configuration, in addition to the existing `qsv*` permission, to ensure consistent reads with exclusive locking.

#### Scenario: Manager can execute flock-prefixed qsv commands
- **WHEN** the manager agent reads from `table.csv` using `qsv`
- **THEN** it SHALL execute `flock -x <table_path> qsv <subcommand> <table_path> [args]` without permission denial
