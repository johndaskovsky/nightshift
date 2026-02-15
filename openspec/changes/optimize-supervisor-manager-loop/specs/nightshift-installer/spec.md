## MODIFIED Requirements

### Requirement: Init command generates agent files
The system SHALL write the two Nightshift agent definition files from bundled templates during `nightshift init`.

#### Scenario: Agent files are written
- **WHEN** `nightshift init` completes successfully
- **THEN** the following files SHALL exist with content matching the bundled templates: `.opencode/agent/nightshift-manager.md`, `.opencode/agent/nightshift-dev.md`

#### Scenario: Agent files overwrite previous Nightshift agents
- **WHEN** `nightshift init` runs and `.opencode/agent/nightshift-manager.md` already exists from a prior installation
- **THEN** the system SHALL overwrite it with the current template version

### Requirement: Update command regenerates framework files
The system SHALL provide a `nightshift update` command that regenerates all framework-managed files from the current CLI version's templates.

#### Scenario: Update overwrites agent files
- **WHEN** a user runs `nightshift update`
- **THEN** the system SHALL overwrite both agent files in `.opencode/agent/` with the current bundled templates

#### Scenario: Update overwrites command files
- **WHEN** a user runs `nightshift update`
- **THEN** the system SHALL overwrite all six command files in `.opencode/command/` with the current bundled templates

### Requirement: Template bundling
The system SHALL bundle all Nightshift agent and command templates inside the npm package under a `templates/` directory.

#### Scenario: Templates directory structure
- **WHEN** the npm package is inspected
- **THEN** `templates/` SHALL contain `agents/nightshift-manager.md`, `agents/nightshift-dev.md`, `commands/nightshift-create.md`, `commands/nightshift-start.md`, `commands/nightshift-archive.md`, `commands/nightshift-add-task.md`, `commands/nightshift-test-task.md`, and `commands/nightshift-update-table.md`

#### Scenario: Templates are resolvable at runtime
- **WHEN** the CLI executes `init` or `update`
- **THEN** the system SHALL resolve the templates directory relative to the installed package location (not the current working directory)
