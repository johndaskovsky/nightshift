## MODIFIED Requirements

### Requirement: Init command summary output
The system SHALL display a summary of all actions performed after `nightshift init` completes. The summary SHALL include the `.nightshift/.gitignore` file alongside agent and command files, and a dependencies section that actively verifies whether `qsv` and `flock` are installed and displays their status with install instructions for any that are missing.

#### Scenario: Successful init displays summary
- **WHEN** `nightshift init` completes without errors
- **THEN** the system SHALL print a list of created/updated files (including `.nightshift/.gitignore`), a `--- Dependencies ---` section showing the availability of `qsv` and `flock` (with install instructions for any that are missing), and a next-steps message suggesting the user open OpenCode and run `/nightshift-create`

#### Scenario: Init with errors displays partial summary
- **WHEN** `nightshift init` encounters a non-fatal error (e.g., file write fails due to permissions)
- **THEN** the system SHALL complete all other steps, print the summary with a warning about the failed step, and exit with a non-zero exit code

### Requirement: Update command regenerates framework files
The system SHALL provide a `nightshift update` command that regenerates all framework-managed files from the current CLI version's templates, including the `.nightshift/.gitignore` file.

#### Scenario: Update overwrites agent files
- **WHEN** a user runs `nightshift update`
- **THEN** the system SHALL overwrite both agent files in `.opencode/agent/` with the current bundled templates

#### Scenario: Update overwrites command files
- **WHEN** a user runs `nightshift update`
- **THEN** the system SHALL overwrite all six command files in `.opencode/command/` with the current bundled templates

#### Scenario: Update writes .gitignore
- **WHEN** a user runs `nightshift update`
- **THEN** the system SHALL write `.nightshift/.gitignore` with the current framework-managed ignore patterns

### Requirement: Update command summary output
The system SHALL display a summary of all actions performed after `nightshift update` completes. The summary SHALL include the `.nightshift/.gitignore` file alongside agent and command files, and a dependencies section that actively verifies whether `qsv` and `flock` are installed and displays their status with install instructions for any that are missing.

#### Scenario: Successful update displays summary with dependencies
- **WHEN** `nightshift update` completes without errors
- **THEN** the system SHALL print a list of updated files (including `.nightshift/.gitignore`) and a `--- Dependencies ---` section showing the availability of `qsv` and `flock` (with install instructions for any that are missing)

### Requirement: Update command is idempotent
The system SHALL produce identical results when `nightshift update` is run multiple times in succession, including the `.nightshift/.gitignore` file.

#### Scenario: Consecutive updates produce same output
- **WHEN** a user runs `nightshift update` twice with no changes to templates between runs
- **THEN** the generated files (including `.nightshift/.gitignore`) SHALL be byte-identical after both runs

#### Scenario: Update does not touch shift data
- **WHEN** a user runs `nightshift update` and `.nightshift/` contains active shift directories with `table.csv` data
- **THEN** the system SHALL NOT read, modify, or delete any files inside `.nightshift/` other than the `.gitignore` file
