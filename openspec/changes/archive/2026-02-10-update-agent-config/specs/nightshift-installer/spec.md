## REMOVED Requirements

### Requirement: Init command merges opencode.jsonc
**Reason**: Nightshift no longer manages `opencode.jsonc`. Agent definitions live exclusively in markdown frontmatter files. Global permissions (bash allowlist, edit, webfetch) are project-level OpenCode settings that users configure directly.
**Migration**: Users who need specific global permissions in `opencode.jsonc` should configure them manually. Stale Nightshift agent entries from prior installations can be removed from `opencode.jsonc` by hand.

## MODIFIED Requirements

### Requirement: Update command regenerates framework files
The system SHALL provide a `nightshift update` command that regenerates all framework-managed files from the current CLI version's templates.

#### Scenario: Update overwrites agent files
- **WHEN** a user runs `nightshift update`
- **THEN** the system SHALL overwrite all three agent files in `.opencode/agent/` with the current bundled templates

#### Scenario: Update overwrites command files
- **WHEN** a user runs `nightshift update`
- **THEN** the system SHALL overwrite all six command files in `.opencode/command/` with the current bundled templates

### Requirement: Template bundling
The system SHALL bundle all Nightshift agent and command templates inside the npm package under a `templates/` directory.

#### Scenario: Templates directory structure
- **WHEN** the npm package is inspected
- **THEN** `templates/` SHALL contain `agents/nightshift-manager.md`, `agents/nightshift-dev.md`, `agents/nightshift-qa.md`, `commands/nightshift-create.md`, `commands/nightshift-start.md`, `commands/nightshift-archive.md`, `commands/nightshift-add-task.md`, `commands/nightshift-test-task.md`, and `commands/nightshift-update-table.md`

#### Scenario: Templates are resolvable at runtime
- **WHEN** the CLI executes `init` or `update`
- **THEN** the system SHALL resolve the templates directory relative to the installed package location (not the current working directory)
