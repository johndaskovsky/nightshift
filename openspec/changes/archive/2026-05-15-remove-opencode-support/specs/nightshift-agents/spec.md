## MODIFIED Requirements

### Requirement: Claude Code subagent surface
The system SHALL provide Claude Code subagent definitions for the manager and dev agents, expressed in Claude Code's subagent file format under `.claude/agents/nightshift-manager.md` and `.claude/agents/nightshift-dev.md`. These subagent files SHALL be the canonical definitions for Nightshift's orchestration, retry, self-validation, parallel batching, and self-improvement behavior.

#### Scenario: Manager subagent file exists after install
- **WHEN** `nightshift init` completes successfully
- **THEN** `.claude/agents/nightshift-manager.md` SHALL exist with valid Claude Code subagent frontmatter (at minimum `name`, `description`, `tools`, `model`)

#### Scenario: Dev subagent file exists after install
- **WHEN** `nightshift init` completes successfully
- **THEN** `.claude/agents/nightshift-dev.md` SHALL exist with valid Claude Code subagent frontmatter

### Requirement: Manager subagent restricts spawnable subagents to dev
The Claude `nightshift-manager` subagent SHALL declare `tools` such that the only spawnable subagent is `nightshift-dev`. This SHALL be expressed as `Agent(nightshift-dev)` in the `tools` frontmatter list.

#### Scenario: Manager allowlist contains only dev
- **WHEN** `.claude/agents/nightshift-manager.md` is parsed
- **THEN** its `tools` field SHALL include `Agent(nightshift-dev)` and SHALL NOT include any other `Agent(<name>)` entries

#### Scenario: Manager has the tools required for orchestration
- **WHEN** `.claude/agents/nightshift-manager.md` is parsed
- **THEN** its `tools` field SHALL include `Read`, `Write`, `Edit`, `Bash`, `Glob`, and `Grep` so the manager can read configuration, write task files, edit state files, and run qsv/flock commands

### Requirement: Dev subagent cannot delegate
The Claude `nightshift-dev` subagent SHALL NOT include the `Agent` tool in its `tools` allowlist, ensuring the dev subagent cannot spawn other subagents.

#### Scenario: Dev tools omit Agent
- **WHEN** `.claude/agents/nightshift-dev.md` is parsed
- **THEN** its `tools` field SHALL NOT include `Agent`, `Agent(*)`, or any `Agent(<name>)` entry
