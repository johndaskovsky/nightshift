## MODIFIED Requirements

### Requirement: Init command generates agent files
The system SHALL write the three Nightshift agent definition files from bundled templates during `nightshift init`. The bundled templates SHALL reflect the current agent permission model, including `qsv*` and `flock*` bash permissions for the dev and QA agents and `flock*` bash permissions for the manager agent.

#### Scenario: Agent files are written
- **WHEN** `nightshift init` completes successfully
- **THEN** the following files SHALL exist with content matching the bundled templates: `.opencode/agent/nightshift-manager.md`, `.opencode/agent/nightshift-dev.md`, `.opencode/agent/nightshift-qa.md`

#### Scenario: Agent files overwrite previous Nightshift agents
- **WHEN** `nightshift init` runs and `.opencode/agent/nightshift-manager.md` already exists from a prior installation
- **THEN** the system SHALL overwrite it with the current template version

### Requirement: Update command regenerates framework files
The system SHALL provide a `nightshift update` command that regenerates all framework-managed files from the current CLI version's templates. The regenerated templates SHALL include current agent permissions (including `qsv*` and `flock*` bash permissions for dev, QA, and manager agents), the updated state machine (4 states: `todo`, `qa`, `done`, `failed`), and `flock`-prefixed `qsv` commands.

#### Scenario: Update overwrites agent files
- **WHEN** a user runs `nightshift update`
- **THEN** the system SHALL overwrite all three agent files in `.opencode/agent/` with the current bundled templates

#### Scenario: Update overwrites command files
- **WHEN** a user runs `nightshift update`
- **THEN** the system SHALL overwrite all six command files in `.opencode/command/` with the current bundled templates

### Requirement: Template bundling
The system SHALL bundle all Nightshift agent and command templates inside the npm package under a `templates/` directory. The bundled templates SHALL reflect the current framework state, including the 4-state state machine (`todo`, `qa`, `done`, `failed`), decentralized state management (dev and QA agents write their own status), `flock`-prefixed `qsv` commands, `{SHIFT:TABLE}` template variable support, and required `qsv` and `flock` dependencies.

#### Scenario: Templates directory structure
- **WHEN** the npm package is inspected
- **THEN** `templates/` SHALL contain `agents/nightshift-manager.md`, `agents/nightshift-dev.md`, `agents/nightshift-qa.md`, `commands/nightshift-create.md`, `commands/nightshift-start.md`, `commands/nightshift-archive.md`, `commands/nightshift-add-task.md`, `commands/nightshift-test-task.md`, and `commands/nightshift-update-table.md`

#### Scenario: Templates are resolvable at runtime
- **WHEN** the CLI executes `init` or `update`
- **THEN** the system SHALL resolve the templates directory relative to the installed package location (not the current working directory)

### Requirement: Init command summary output
The system SHALL display a summary of all actions performed after `nightshift init` completes. The summary SHALL include a note about required dependencies (`qsv` and `flock`) that must be installed separately.

#### Scenario: Successful init displays summary
- **WHEN** `nightshift init` completes without errors
- **THEN** the system SHALL print a list of created/updated files, a note that `qsv` and `flock` are required dependencies (with installation instructions), and a next-steps message suggesting the user open OpenCode and run `/nightshift-create`

#### Scenario: Init with errors displays partial summary
- **WHEN** `nightshift init` encounters a non-fatal error (e.g., file write fails due to permissions)
- **THEN** the system SHALL complete all other steps, print the summary with a warning about the failed step, and exit with a non-zero exit code
