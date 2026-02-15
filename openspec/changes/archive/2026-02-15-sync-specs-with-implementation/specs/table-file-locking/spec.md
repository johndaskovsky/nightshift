## MODIFIED Requirements

### Requirement: Exclusive file locking for all qsv table operations
The system SHALL wrap every `qsv` command that operates on `table.csv` with `flock -x <table_path>` to acquire an exclusive file lock. This applies to all agents (manager, dev) and all commands that use `qsv` on the shift table.

#### Scenario: Status write with lock
- **WHEN** the dev agent updates an item-task status in `table.csv`
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

## REMOVED Requirements

### Requirement: QA agent bash permissions for table locking
**Reason**: QA agent was removed from the framework. Dev agent self-validates and writes its own status (`done` or `failed`) directly to `table.csv`.
**Migration**: No migration needed; the QA agent and its permissions have been removed entirely.
