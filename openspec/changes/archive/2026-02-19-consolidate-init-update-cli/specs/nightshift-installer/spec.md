## MODIFIED Requirements

### Requirement: CLI entry point
The system SHALL provide a `nightshift` CLI binary installed globally via npm (`npm install -g @johndaskovsky/nightshift`) that exposes the `init` subcommand via the `commander` library.

#### Scenario: CLI is invocable after global install
- **WHEN** a user runs `npm install -g @johndaskovsky/nightshift`
- **THEN** the `nightshift` command SHALL be available on the system PATH and print usage help when invoked with `--help`

#### Scenario: Version flag
- **WHEN** a user runs `nightshift --version`
- **THEN** the CLI SHALL print the version from `package.json` and exit with code 0

#### Scenario: Unknown command
- **WHEN** a user runs `nightshift foo` where `foo` is not a registered subcommand
- **THEN** the CLI SHALL print an error message and display available commands

### Requirement: Init command summary output
The system SHALL display a summary of all actions performed after `nightshift init` completes. The summary SHALL include a dependencies section that actively verifies whether `qsv` and `flock` are installed and displays their status with install instructions for any that are missing.

#### Scenario: First-run init displays summary with next steps
- **WHEN** `nightshift init` completes without errors in a directory that has not been previously initialized
- **THEN** the system SHALL print a banner "Initializing Nightshift...", a list of created files, a `--- Dependencies ---` section showing the availability of `qsv` and `flock` (with install instructions for any that are missing), and a `--- Next Steps ---` section suggesting the user open OpenCode and run `/nightshift-create`

#### Scenario: Re-run init displays update summary
- **WHEN** `nightshift init` completes without errors in a directory that has been previously initialized
- **THEN** the system SHALL print a banner "Updating Nightshift files...", a list of updated files, a `--- Dependencies ---` section showing the availability of `qsv` and `flock` (with install instructions for any that are missing), and an "Update complete." message

#### Scenario: Init with errors displays partial summary
- **WHEN** `nightshift init` encounters a non-fatal error (e.g., file write fails due to permissions)
- **THEN** the system SHALL complete all other steps, print the summary with a warning about the failed step, and exit with a non-zero exit code

### Requirement: Init command is idempotent
The system SHALL produce identical file content when `nightshift init` is run multiple times in succession.

#### Scenario: Consecutive inits produce same output
- **WHEN** a user runs `nightshift init` twice with no changes to templates between runs
- **THEN** the generated files SHALL be byte-identical after both runs

#### Scenario: Init does not touch shift data
- **WHEN** a user runs `nightshift init` and `.nightshift/` contains active shift directories with `table.csv` data
- **THEN** the system SHALL NOT read, modify, or delete any files inside shift directories under `.nightshift/`

### Requirement: Non-interactive mode
The system SHALL accept no flags beyond the standard `--help` and `--version` flags. The `init` command SHALL operate non-interactively with no confirmation prompts.

#### Scenario: Init runs without prompts
- **WHEN** a user runs `nightshift init`
- **THEN** the system SHALL proceed with all operations without prompting for user input

### Requirement: Templates are resolvable at runtime
The system SHALL resolve the templates directory relative to the installed package location (not the current working directory) when the CLI executes `init`.

#### Scenario: Templates resolved during init
- **WHEN** the CLI executes `init`
- **THEN** the system SHALL resolve the templates directory relative to the installed package location

## ADDED Requirements

### Requirement: First-run detection
The system SHALL detect whether Nightshift has been previously initialized in the target directory by checking for the existence of `.opencode/agent/nightshift-manager.md`. This detection SHALL be used solely for adjusting CLI output messaging and SHALL NOT affect the scaffolding behavior (files are always overwritten).

#### Scenario: Fresh directory detected as first run
- **WHEN** `nightshift init` runs in a directory where `.opencode/agent/nightshift-manager.md` does not exist
- **THEN** the system SHALL use first-run messaging: banner "Initializing Nightshift...", spinner text "Creating directories..." / "Writing agent files..." / "Writing command files...", and a `--- Next Steps ---` footer

#### Scenario: Previously initialized directory detected as re-run
- **WHEN** `nightshift init` runs in a directory where `.opencode/agent/nightshift-manager.md` already exists
- **THEN** the system SHALL use re-run messaging: banner "Updating Nightshift files...", spinner text "Ensuring directories..." / "Updating agent files..." / "Updating command files...", and an "Update complete." footer

## REMOVED Requirements

### Requirement: Update command regenerates framework files
**Reason**: The `update` command is functionally identical to `init`. Both call the same scaffolder functions and produce identical results. Consolidating to a single `init` command eliminates code duplication and a misleading API surface.
**Migration**: Replace `nightshift update` with `nightshift init` in all scripts, CI pipelines, and documentation.

### Requirement: Update command is idempotent
**Reason**: Folded into the modified "Init command is idempotent" requirement above. The idempotency guarantee now applies to `init` (which handles both first-run and re-run cases).
**Migration**: No action required. `nightshift init` provides the same idempotency guarantee.

### Requirement: Update command summary output
**Reason**: Folded into the modified "Init command summary output" requirement. The init command now displays contextually appropriate messaging based on first-run detection.
**Migration**: No action required. `nightshift init` on a previously initialized directory displays the same "Updating..." messaging that `nightshift update` used to show.
