## ADDED Requirements

### Requirement: Claude Code installation surface
The system SHALL provide a Claude Code installation surface that scaffolds Nightshift agents, skills, and project settings into the standard Claude Code directory layout (`.claude/`) so that Nightshift is fully usable inside Claude Code without manual file edits.

#### Scenario: Init writes Claude Code directories
- **WHEN** `nightshift init --target=claude` runs in a fresh project
- **THEN** the system SHALL create `.claude/agents/`, `.claude/skills/`, and `.nightshift/archive/`, and SHALL NOT create any `.opencode/` directories

#### Scenario: Both targets coexist
- **WHEN** `nightshift init --target=both` runs in a fresh project
- **THEN** the system SHALL create both `.claude/{agents,skills}/` and `.opencode/{agent,command}/` directory trees

### Requirement: Claude subagent files
The system SHALL write two Claude Code subagent files (`nightshift-manager.md` and `nightshift-dev.md`) into `.claude/agents/` when the install target includes Claude. Each file SHALL use Claude Code subagent frontmatter format (`name`, `description`, `tools`, `model`; optional `mcpServers`, `hooks`, `skills`, `disallowedTools`, `permissionMode`, `memory`, `isolation`, `color`).

#### Scenario: Manager subagent restricts spawnable subagents
- **WHEN** `.claude/agents/nightshift-manager.md` is written
- **THEN** its `tools` frontmatter field SHALL include `Agent(nightshift-dev)` to allowlist only the dev subagent for delegation, plus `Read`, `Write`, `Edit`, `Bash`, `Glob`, and `Grep`

#### Scenario: Dev subagent cannot spawn other subagents
- **WHEN** `.claude/agents/nightshift-dev.md` is written
- **THEN** its `tools` frontmatter field SHALL NOT include the `Agent` tool, ensuring the dev subagent cannot delegate to other subagents

#### Scenario: Dev subagent documents Playwright as user-configured
- **WHEN** `.claude/agents/nightshift-dev.md` is written
- **THEN** the file SHALL include a commented `mcpServers` example showing how to enable Playwright, and SHALL NOT inline a live Playwright MCP server definition

### Requirement: Nightshift skills as Claude Code Skills
The system SHALL write six skill directories under `.claude/skills/` corresponding to the six Nightshift commands: `nightshift-create`, `nightshift-add-task`, `nightshift-update-table`, `nightshift-start`, `nightshift-test-task`, `nightshift-archive`. Each skill directory SHALL contain a `SKILL.md` entrypoint and MAY contain a `scripts/` subdirectory of supporting executables.

#### Scenario: Each skill has a SKILL.md
- **WHEN** Claude target installation completes
- **THEN** every skill directory under `.claude/skills/nightshift-*/` SHALL contain a file named exactly `SKILL.md` with valid YAML frontmatter delimited by `---`

#### Scenario: Skills disable model invocation
- **WHEN** any Nightshift `SKILL.md` is written
- **THEN** its frontmatter SHALL include `disable-model-invocation: true` to prevent Claude from auto-invoking side-effecting workflows

#### Scenario: Skills pre-approve CSV operations
- **WHEN** any Nightshift `SKILL.md` is written
- **THEN** its frontmatter `allowed-tools` field SHALL include `Bash(qsv *)` and `Bash(flock *)` so CSV operations execute without per-call permission prompts while the skill is active

#### Scenario: Start skill uses forked manager subagent
- **WHEN** `.claude/skills/nightshift-start/SKILL.md` is written
- **THEN** its frontmatter SHALL include `context: fork` and `agent: nightshift-manager` so the skill body becomes the manager subagent's task prompt directly

#### Scenario: Skills use shift name argument
- **WHEN** any Nightshift `SKILL.md` body references the shift name
- **THEN** it SHALL use `$ARGUMENTS` or `$0` substitution so the user can invoke `/nightshift-<verb> <shift-name>` and have the name resolve correctly

### Requirement: Bundled scripts use portable paths
The system SHALL reference bundled skill scripts via the `${CLAUDE_SKILL_DIR}` environment variable so that scripts resolve correctly regardless of whether the skill is installed at user, project, or plugin scope.

#### Scenario: Script invocation uses CLAUDE_SKILL_DIR
- **WHEN** a `SKILL.md` invokes a bundled script
- **THEN** the invocation SHALL use the form `${CLAUDE_SKILL_DIR}/scripts/<name>.sh` rather than a relative or absolute path

#### Scenario: Scripts are executable
- **WHEN** a script is bundled under `<skill>/scripts/`
- **THEN** it SHALL be marked executable (mode `0755`) when scaffolded into a target project

### Requirement: Dynamic context injection for live state
The system MAY use Claude Code's `` !`<command>` `` dynamic context injection syntax in skill bodies to inline live shift state (item counts, status summaries) into the prompt before Claude reads it. When used, the injected commands SHALL use `flock -x` exclusive locks to coordinate with concurrent dev agents.

#### Scenario: Pre-flight summary inlines counts
- **WHEN** the user invokes `/nightshift-start <shift-name>`
- **THEN** the rendered skill body SHALL contain pre-computed totals (total items, done count, failed count, todo count) inlined via `` !`flock -x ... qsv ...` `` blocks before the manager subagent receives the prompt

### Requirement: Project-level settings.json scaffolding
The system SHALL create or merge a `.claude/settings.json` file when the install target includes Claude. The file SHALL include `permissions.allow` entries for `Bash(qsv *)` and `Bash(flock *)` so that subagent CSV operations (which execute outside skill scope) avoid permission prompts.

#### Scenario: settings.json created when absent
- **WHEN** `nightshift init --target=claude` runs and `.claude/settings.json` does not exist
- **THEN** the system SHALL create the file with `{ "permissions": { "allow": ["Bash(qsv *)", "Bash(flock *)"] } }`

#### Scenario: settings.json merged when present
- **WHEN** `nightshift init --target=claude` runs and `.claude/settings.json` exists with user-authored content
- **THEN** the system SHALL parse the file as JSON, ensure `Bash(qsv *)` and `Bash(flock *)` are present in `permissions.allow` (preserving existing entries and other top-level keys), and write the result back with stable key order

#### Scenario: Malformed settings.json halts init
- **WHEN** `nightshift init --target=claude` runs and `.claude/settings.json` exists but contains invalid JSON
- **THEN** the system SHALL abort the merge with a clear error message naming the file and SHALL NOT overwrite the file

### Requirement: CLAUDE.md scaffolding
The system SHALL create or update a project-level `CLAUDE.md` when the install target includes Claude. The Nightshift-managed content SHALL be wrapped in marker comments so the installer can update its own section without disturbing user-authored content.

#### Scenario: CLAUDE.md created when absent
- **WHEN** `nightshift init --target=claude` runs and `CLAUDE.md` does not exist
- **THEN** the system SHALL create `CLAUDE.md` containing a Nightshift section delimited by `<!-- nightshift:start -->` and `<!-- nightshift:end -->` markers

#### Scenario: CLAUDE.md section replaced when markers present
- **WHEN** `nightshift init --target=claude` runs and `CLAUDE.md` exists with both Nightshift markers
- **THEN** the system SHALL replace only the content between the markers, preserving all other content in the file

#### Scenario: CLAUDE.md section appended when markers absent
- **WHEN** `nightshift init --target=claude` runs and `CLAUDE.md` exists but does not contain the Nightshift markers
- **THEN** the system SHALL append a new Nightshift section (with markers) to the end of the file and print a warning to the user

### Requirement: Claude Code Plugin manifest
The system SHALL include a Claude Code Plugin manifest (`.claude-plugin/plugin.json`) at the npm package root so that users can install Nightshift via Claude Code's plugin discovery mechanism without running the CLI installer. The plugin SHALL bundle the Claude agents and skills.

#### Scenario: Plugin manifest published with package
- **WHEN** the npm package is published
- **THEN** the published artifact SHALL contain `.claude-plugin/plugin.json`, `agents/nightshift-manager.md`, `agents/nightshift-dev.md`, and `skills/nightshift-*/SKILL.md` (with bundled scripts) at the package root

#### Scenario: Plugin manifest declares Nightshift identity
- **WHEN** `plugin.json` is read by Claude Code
- **THEN** it SHALL declare `name: "nightshift"`, the package version, an author, and references to the bundled `agents` and `skills` directories

### Requirement: Plugin and CLI install coexistence detection
The system SHALL detect when both a Claude Code Plugin install and a CLI `nightshift init --target=claude` install are present in the same project, and SHALL warn the user about the duplication.

#### Scenario: Duplicate install warning
- **WHEN** `nightshift init --target=claude` runs in a project where the Nightshift plugin is also enabled (detected via the presence of a Nightshift plugin reference in Claude settings or by skill name collision)
- **THEN** the system SHALL print a warning explaining that project-scoped skills override plugin skills and recommending the user choose one install pathway

### Requirement: Manager subagent fits Claude Code re-attach budget
The system SHALL ensure the Claude Code `nightshift-manager` subagent system prompt (frontmatter excluded) is small enough to fit within Claude Code's per-skill auto-compaction re-attach budget of 5,000 tokens.

#### Scenario: Manager prompt under budget
- **WHEN** the Claude `nightshift-manager.md` template is built
- **THEN** the prose body SHALL be under 5,000 tokens (verified by a build-time or test-time character/token check) so that the manager's instructions survive auto-compaction during long shifts

### Requirement: Manager and dev orchestration semantics preserved
The system SHALL preserve the orchestration contract between manager and dev across runtimes: state machine (`todo` → `done` | `failed`), retry budget (3 total attempts per item), self-validation, parallel batch sizing, self-improvement loop, and `disable-self-improvement` flag SHALL behave identically whether the shift runs under OpenCode or Claude Code.

#### Scenario: Same shift runs identically across runtimes
- **WHEN** an identical shift directory (`manager.md`, `table.csv`, task files) is processed under OpenCode and under Claude Code
- **THEN** the resulting `table.csv` status transitions, retry counts, and self-improvement edits SHALL be equivalent (modulo non-determinism in agent decisions)
