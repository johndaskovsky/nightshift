## MODIFIED Requirements

### Requirement: Init command summary output
The system SHALL display a summary of all actions performed after `nightshift init` completes. The summary SHALL include a dependencies section that actively verifies whether `qsv` and `flock` are installed and displays their status with install instructions for any that are missing.

#### Scenario: Successful init displays summary
- **WHEN** `nightshift init` completes without errors
- **THEN** the system SHALL print a list of created/updated files, a `--- Dependencies ---` section showing the availability of `qsv` and `flock` (with install instructions for any that are missing), and a next-steps message suggesting the user open OpenCode and run `/nightshift-create`

#### Scenario: Init with errors displays partial summary
- **WHEN** `nightshift init` encounters a non-fatal error (e.g., file write fails due to permissions)
- **THEN** the system SHALL complete all other steps, print the summary with a warning about the failed step, and exit with a non-zero exit code

## ADDED Requirements

### Requirement: Update command summary output
The system SHALL display a summary of all actions performed after `nightshift update` completes. The summary SHALL include a dependencies section that actively verifies whether `qsv` and `flock` are installed and displays their status with install instructions for any that are missing.

#### Scenario: Successful update displays summary with dependencies
- **WHEN** `nightshift update` completes without errors
- **THEN** the system SHALL print a list of updated files and a `--- Dependencies ---` section showing the availability of `qsv` and `flock` (with install instructions for any that are missing)
