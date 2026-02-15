## MODIFIED Requirements

### Requirement: qsv CLI dependency
The system SHALL require [qsv](https://github.com/dathere/qsv) as the CLI tool for all CSV operations on `table.csv`. qsv SHALL be a required external dependency, installable via `brew install qsv`. The system SHALL NOT operate without qsv.

#### Scenario: qsv is available
- **WHEN** the `qsv` binary is on the system PATH
- **THEN** all CSV operations on `table.csv` SHALL use `flock -x <table_path> qsv` subcommands

#### Scenario: qsv is not available
- **WHEN** the `qsv` binary is not found on the system PATH
- **THEN** the CLI installer (`nightshift init` and `nightshift update`) SHALL have warned the user with installation instructions (`brew install qsv`) during setup, and agent bash commands that invoke `qsv` SHALL fail with system-level errors
