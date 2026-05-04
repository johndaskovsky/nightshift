## ADDED Requirements

### Requirement: Claude Code subagent surface
The system SHALL provide Claude Code subagent definitions for the manager and dev agents, expressed in Claude Code's subagent file format under `.claude/agents/nightshift-manager.md` and `.claude/agents/nightshift-dev.md`. The subagent semantics — orchestration, retry, self-validation, parallel batching, self-improvement — SHALL be identical to the OpenCode agents.

#### Scenario: Manager subagent file exists after Claude install
- **WHEN** `nightshift init --target=claude` completes successfully
- **THEN** `.claude/agents/nightshift-manager.md` SHALL exist with valid Claude Code subagent frontmatter (at minimum `name`, `description`, `tools`, `model`)

#### Scenario: Dev subagent file exists after Claude install
- **WHEN** `nightshift init --target=claude` completes successfully
- **THEN** `.claude/agents/nightshift-dev.md` SHALL exist with valid Claude Code subagent frontmatter

#### Scenario: Subagents preserve OpenCode orchestration semantics
- **WHEN** the manager Claude subagent processes a shift
- **THEN** it SHALL follow the same item-selection algorithm, sequential/parallel mode rules, retry budget, and self-improvement behavior as the OpenCode manager agent

### Requirement: Manager subagent restricts spawnable subagents to dev
The Claude `nightshift-manager` subagent SHALL declare `tools` such that the only spawnable subagent is `nightshift-dev`. This SHALL be expressed as `Agent(nightshift-dev)` in the `tools` frontmatter list, mirroring the OpenCode manager's `permission.task: { nightshift-dev: allow, "*": deny }`.

#### Scenario: Manager allowlist contains only dev
- **WHEN** `.claude/agents/nightshift-manager.md` is parsed
- **THEN** its `tools` field SHALL include `Agent(nightshift-dev)` and SHALL NOT include any other `Agent(<name>)` entries

#### Scenario: Manager has the tools required for orchestration
- **WHEN** `.claude/agents/nightshift-manager.md` is parsed
- **THEN** its `tools` field SHALL include `Read`, `Write`, `Edit`, `Bash`, `Glob`, and `Grep` so the manager can read configuration, write task files, edit state files, and run qsv/flock commands

### Requirement: Dev subagent cannot delegate
The Claude `nightshift-dev` subagent SHALL NOT include the `Agent` tool in its `tools` allowlist, ensuring the dev subagent cannot spawn other subagents. This mirrors the OpenCode dev's `permission.task: { "*": deny }`.

#### Scenario: Dev tools omit Agent
- **WHEN** `.claude/agents/nightshift-dev.md` is parsed
- **THEN** its `tools` field SHALL NOT include `Agent`, `Agent(*)`, or any `Agent(<name>)` entry

### Requirement: Dev subagent documents Playwright as user-configured
The Claude `nightshift-dev` subagent file SHALL include a commented-out `mcpServers` example showing how to enable a Playwright MCP server scoped to the dev subagent, but SHALL NOT inline a live Playwright MCP server definition. Users who want browser automation SHALL uncomment the example or configure their own MCP server.

#### Scenario: Dev file shows commented Playwright example
- **WHEN** `.claude/agents/nightshift-dev.md` is read as text
- **THEN** the file SHALL contain a commented-out YAML block under `mcpServers` showing the inline Playwright server definition (`type: stdio`, `command: npx`, `args: ["-y", "@playwright/mcp@latest"]`)

#### Scenario: Dev frontmatter omits live Playwright server
- **WHEN** `.claude/agents/nightshift-dev.md` is parsed as YAML
- **THEN** its parsed frontmatter SHALL NOT contain an active `mcpServers` entry for Playwright

### Requirement: Manager subagent body fits Claude Code re-attach budget
The system SHALL keep the prose body (frontmatter excluded) of `.claude/agents/nightshift-manager.md` under 5,000 tokens so that the manager's instructions survive Claude Code's auto-compaction event during long shifts. The build or test process SHALL verify this constraint.

#### Scenario: Manager body within budget
- **WHEN** the Claude target template `templates/claude/agents/nightshift-manager.md` is built and tested
- **THEN** the body content (everything after the closing `---` of the frontmatter) SHALL measure under 5,000 tokens (estimated as fewer than 20,000 characters as a conservative proxy)

### Requirement: Subagent model defaults
The system SHALL default the Claude `nightshift-manager` subagent to `model: sonnet` for orchestration intelligence and the Claude `nightshift-dev` subagent to `model: inherit` so that users may select a faster model (e.g., haiku) at the session level when desired.

#### Scenario: Manager defaults to sonnet
- **WHEN** `.claude/agents/nightshift-manager.md` is parsed
- **THEN** its `model` frontmatter field SHALL be `sonnet`

#### Scenario: Dev defaults to inherit
- **WHEN** `.claude/agents/nightshift-dev.md` is parsed
- **THEN** its `model` frontmatter field SHALL be `inherit` (or omitted, which defaults to `inherit`)
