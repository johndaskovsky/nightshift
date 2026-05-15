## ADDED Requirements

### Requirement: Init removes stale nightshift-dev subagent
The system SHALL detect and clean up the legacy `.claude/agents/nightshift-dev.md` subagent file (from Nightshift 2.x installs) when `nightshift init` runs in a project that previously had 2.x scaffolded.

#### Scenario: Unmodified stale file silently removed
- **WHEN** `nightshift init` runs and `.claude/agents/nightshift-dev.md` exists with content matching a known 2.x template hash (or trivially matching the 2.x bundled template)
- **THEN** the file SHALL be deleted silently and the action SHALL appear in the init summary as `removed: .claude/agents/nightshift-dev.md (legacy)`

#### Scenario: User-modified stale file renamed with backup
- **WHEN** `nightshift init` runs and `.claude/agents/nightshift-dev.md` exists with content that does not match a known 2.x template
- **THEN** the file SHALL be renamed to `.claude/agents/nightshift-dev.md.bak.<ISO-timestamp>`, a warning SHALL be surfaced in the init summary explaining the rename, and the warning SHALL point the user at the migration notes in CHANGELOG.md

## MODIFIED Requirements

### Requirement: Init writes Claude agent files
The system SHALL write one Claude Code subagent file from bundled templates: `.claude/agents/nightshift-manager.md`. The dev role is no longer a subagent in 3.x — there SHALL NOT be a `.claude/agents/nightshift-dev.md` file written by init.

#### Scenario: Claude manager subagent written
- **WHEN** `nightshift init` completes successfully
- **THEN** `.claude/agents/nightshift-manager.md` SHALL exist with content matching the bundled `templates/claude/agents/nightshift-manager.md`

#### Scenario: No dev subagent written
- **WHEN** `nightshift init` completes successfully
- **THEN** `.claude/agents/nightshift-dev.md` SHALL NOT be written

#### Scenario: Manager file overwritten on re-run
- **WHEN** `nightshift init` runs and `.claude/agents/nightshift-manager.md` already exists from a prior installation
- **THEN** the system SHALL overwrite it with the current template version

### Requirement: Init writes Claude skill directories
The system SHALL write seven skill directories under `.claude/skills/`, each containing a `SKILL.md` and (where applicable) a `scripts/` subdirectory of executables. The seven skills are: `nightshift-create`, `nightshift-add-task`, `nightshift-update-table`, `nightshift-start`, `nightshift-test-task`, `nightshift-archive`, and `nightshift-do-task`.

#### Scenario: Skill directories written
- **WHEN** `nightshift init` completes successfully
- **THEN** the directories `.claude/skills/nightshift-create/`, `.claude/skills/nightshift-add-task/`, `.claude/skills/nightshift-update-table/`, `.claude/skills/nightshift-start/`, `.claude/skills/nightshift-test-task/`, `.claude/skills/nightshift-archive/`, and `.claude/skills/nightshift-do-task/` SHALL each contain a `SKILL.md`

#### Scenario: Dispatch helper installed alongside start skill
- **WHEN** `nightshift init` completes successfully
- **THEN** `.claude/skills/nightshift-start/scripts/dispatch-batch.sh` SHALL exist with mode `0755`

#### Scenario: Skill scripts marked executable
- **WHEN** the system writes a script file under `.claude/skills/<skill-name>/scripts/`
- **THEN** the file SHALL be set to mode `0755` (executable)

#### Scenario: Skill files overwritten on re-run
- **WHEN** `nightshift init` runs and `.claude/skills/nightshift-start/SKILL.md` already exists from a prior installation
- **THEN** the system SHALL overwrite it with the current template version

### Requirement: Template bundling
The system SHALL bundle all Nightshift agent, skill, and Claude Code project-file templates inside the npm package under `templates/claude/`.

#### Scenario: Templates directory structure
- **WHEN** the npm package is inspected
- **THEN** `templates/claude/` SHALL contain `agents/nightshift-manager.md`, `skills/nightshift-create/SKILL.md`, `skills/nightshift-add-task/SKILL.md`, `skills/nightshift-update-table/SKILL.md`, `skills/nightshift-start/SKILL.md`, `skills/nightshift-start/scripts/dispatch-batch.sh`, `skills/nightshift-test-task/SKILL.md`, `skills/nightshift-archive/SKILL.md`, `skills/nightshift-do-task/SKILL.md`, plus per-skill `scripts/` subdirectories where applicable, a `CLAUDE.md` template, and a `settings.json` template fragment. `templates/claude/` SHALL NOT contain `agents/nightshift-dev.md`.

#### Scenario: Templates are resolvable at runtime
- **WHEN** the CLI executes `init`
- **THEN** the system SHALL resolve the templates directory relative to the installed package location (not the current working directory)
