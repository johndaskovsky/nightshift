## MODIFIED Requirements

### Requirement: Claude subagent files
The system SHALL write ONE Claude Code subagent file (`nightshift-manager.md`) into `.claude/agents/` when `nightshift init` runs. The file SHALL use Claude Code subagent frontmatter format (`name`, `description`, `tools`, `model`; optional `mcpServers`, `hooks`, `skills`, `disallowedTools`, `permissionMode`, `memory`, `isolation`, `color`). The dev role SHALL NOT have a subagent file — dev work runs as a top-level `claude -p` subprocess.

#### Scenario: Manager subagent omits Agent tool
- **WHEN** `.claude/agents/nightshift-manager.md` is written
- **THEN** its `tools` frontmatter field SHALL NOT include `Agent` (no subagent delegation); SHALL include `Read`, `Write`, `Edit`, `Bash`, `Glob`, and `Grep` to support orchestration and subprocess dispatch

#### Scenario: Manager subagent allows claude CLI invocations
- **WHEN** `.claude/settings.json` is written by `nightshift init`
- **THEN** `permissions.allow` SHALL include `Bash(claude *)` so the manager can spawn `claude -p` subprocesses without permission prompts

#### Scenario: No nightshift-dev subagent file is written
- **WHEN** `nightshift init` completes
- **THEN** `.claude/agents/nightshift-dev.md` SHALL NOT be present in the install (and SHALL be cleaned up by init if found from a prior 2.x install — see installer spec)

### Requirement: Nightshift skills as Claude Code Skills
The system SHALL write seven skill directories under `.claude/skills/` corresponding to the six user-facing Nightshift commands plus the internal `nightshift-do-task` skill: `nightshift-create`, `nightshift-add-task`, `nightshift-update-table`, `nightshift-start`, `nightshift-test-task`, `nightshift-archive`, and `nightshift-do-task`. Each skill directory SHALL contain a `SKILL.md` entrypoint and MAY contain a `scripts/` subdirectory of supporting executables.

#### Scenario: Each skill has a SKILL.md
- **WHEN** install completes
- **THEN** every skill directory under `.claude/skills/nightshift-*/` SHALL contain a file named exactly `SKILL.md` with valid YAML frontmatter delimited by `---`

#### Scenario: Skills disable model invocation
- **WHEN** any Nightshift `SKILL.md` is written
- **THEN** its frontmatter SHALL include `disable-model-invocation: true` to prevent Claude from auto-invoking side-effecting workflows

#### Scenario: Skills pre-approve CSV operations
- **WHEN** a Nightshift `SKILL.md` is written
- **THEN** its frontmatter `allowed-tools` field SHALL include `Bash(qsv *)` and `Bash(flock *)` (for skills that perform CSV operations) so those operations execute without per-call permission prompts while the skill is active

#### Scenario: Start skill uses forked manager subagent
- **WHEN** `.claude/skills/nightshift-start/SKILL.md` is written
- **THEN** its frontmatter SHALL include `context: fork` and `agent: nightshift-manager` so the skill body becomes the manager subagent's task prompt directly

#### Scenario: Do-task skill is top-level
- **WHEN** `.claude/skills/nightshift-do-task/SKILL.md` is written
- **THEN** its frontmatter SHALL NOT include `context: fork` — the skill runs in the calling top-level session (which, for manager-spawned subprocesses, is the fresh `claude -p` session that inherits user MCPs)

#### Scenario: Skills use shift name argument
- **WHEN** any Nightshift `SKILL.md` body references the shift name
- **THEN** it SHALL use `$ARGUMENTS` or `$0` substitution so the user can invoke `/nightshift-<verb> <shift-name>` (or, for `do-task`, `/nightshift-do-task <shift> <task> <id>`) and have arguments resolve correctly

### Requirement: Bundled scripts use portable paths
The system SHALL reference bundled skill scripts via the `${CLAUDE_SKILL_DIR}` environment variable so that scripts resolve correctly regardless of whether the skill is installed at user, project, or plugin scope. This SHALL include `dispatch-batch.sh` (the parallel dispatch helper) installed under `.claude/skills/nightshift-start/scripts/`.

#### Scenario: Script invocation uses CLAUDE_SKILL_DIR
- **WHEN** a `SKILL.md` invokes a bundled script
- **THEN** the invocation SHALL use the form `${CLAUDE_SKILL_DIR}/scripts/<name>.sh` rather than a relative or absolute path

#### Scenario: Scripts are executable
- **WHEN** a script is bundled under `<skill>/scripts/`
- **THEN** it SHALL be marked executable (mode `0755`) when scaffolded into a target project

#### Scenario: Dispatch helper is portable
- **WHEN** the manager invokes the parallel dispatch helper
- **THEN** it SHALL use `${CLAUDE_SKILL_DIR}/scripts/dispatch-batch.sh` so the call resolves identically whether Nightshift was installed via the CLI, via the Claude Code Plugin, or at the user level

