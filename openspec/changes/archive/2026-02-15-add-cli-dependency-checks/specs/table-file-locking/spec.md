## MODIFIED Requirements

### Requirement: flock CLI dependency
The system SHALL require [flock](https://github.com/discoteq/flock) as an external CLI dependency for exclusive file locking on `table.csv`. `flock` SHALL be installable via `brew install flock`.

#### Scenario: flock is available
- **WHEN** the `flock` binary is on the system PATH
- **THEN** all `qsv` operations on `table.csv` SHALL be prefixed with `flock -x <table_path>` to acquire an exclusive lock before executing

#### Scenario: flock is not available
- **WHEN** the `flock` binary is not found on the system PATH
- **THEN** the CLI installer (`nightshift init` and `nightshift update`) SHALL have warned the user with installation instructions (`brew install flock`) during setup, and agent bash commands that invoke `flock` SHALL fail with system-level errors
