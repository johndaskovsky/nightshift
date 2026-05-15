## MODIFIED Requirements

### Requirement: Manager agent role
The system SHALL define a `nightshift-manager` subagent that orchestrates shift execution. The manager SHALL read `manager.md`, `table.csv`, and the shift's `.env` file (if present), determine which items need processing, and dispatch work to dev subprocesses via the Bash tool (`claude -p "/nightshift-do-task ..."`). The manager SHALL pass environment variable key-value pairs to the dev subprocess as part of the invocation context. The manager SHALL be responsible for applying step improvements to task files based on dev subprocess recommendations, unless `disable-self-improvement: true` is set in the Shift Configuration section of `manager.md`. The manager SHALL use `qsv` CLI commands for all CSV operations on `table.csv`. The manager SHALL process all remaining items autonomously within a single session, returning to the supervisor only when all work is complete.

#### Scenario: Manager reads shift state
- **WHEN** the manager agent is invoked for a shift
- **THEN** it SHALL read `manager.md` for task order, parallel configuration, and the `disable-self-improvement` flag; query `table.csv` using `qsv` commands for item statuses; and read `.env` for environment variables (if the file exists) before making any dispatch decisions

#### Scenario: Manager dispatches dev subprocess
- **WHEN** the manager identifies an item-task with status `todo`
- **THEN** it SHALL invoke `${CLAUDE_SKILL_DIR}/scripts/dispatch-batch.sh` with a JSON manifest containing the shift name, the item id(s), the task name, the resolved `permission_mode`, and the log directory; the helper SHALL spawn one `claude -p "/nightshift-do-task <shift> <task> <id>" --output-format stream-json --permission-mode <mode>` subprocess per item

#### Scenario: Manager handles dev failure after retries
- **WHEN** a dev subprocess returns a result with `status: failed` and the item has exhausted its retry budget
- **THEN** the manager SHALL log the `error` field from the parsed result event and proceed to the next item or batch

#### Scenario: Manager applies step improvements
- **WHEN** the manager parses dev results containing a `recommendations` field that is not "None" AND `disable-self-improvement` is not `true`
- **THEN** the manager SHALL review the recommendations, synthesize non-contradictory improvements, and apply a single coherent update to the Steps section of the task file before dispatching the next item or batch

#### Scenario: Manager skips step improvements when flag is set
- **WHEN** the manager receives results from dev subprocesses AND `disable-self-improvement: true` is set in `manager.md`
- **THEN** the manager SHALL skip the Apply Step Improvements step entirely and proceed to the next item or batch without reading or acting on the `recommendations` field

#### Scenario: Manager deduplicates recommendations from parallel batch
- **WHEN** the manager receives recommendations from multiple concurrent dev subprocesses in a parallel batch AND `disable-self-improvement` is not `true`
- **THEN** it SHALL identify common patterns, deduplicate similar suggestions, resolve contradictions, and apply one unified update to the Steps section

#### Scenario: Manager yields to supervisor on completion
- **WHEN** the manager has processed all items and no `todo` items remain across any task column
- **THEN** the manager SHALL derive final counts from `table.csv` using `qsv search` and `qsv count` operations and output a completion summary to the supervisor

### Requirement: Decentralized status writes
The dev subprocess SHALL write its own status transitions to `table.csv` using `flock -x` prefixed `qsv edit -i` commands. The manager SHALL NOT write status transitions — it reads `table.csv` for status information and writes only to `manager.md` (configuration and task order) and task files (step improvements).

#### Scenario: Dev writes status on success
- **WHEN** the dev subprocess successfully completes execution and self-validation
- **THEN** it SHALL write `done` status to `table.csv` using `flock -x <table_path> qsv edit -i <table_path> <task_column> <qsv_index> done`

#### Scenario: Dev writes status on failure
- **WHEN** the dev subprocess fails after exhausting retries
- **THEN** it SHALL write `failed` status to `table.csv` using `flock -x <table_path> qsv edit -i <table_path> <task_column> <qsv_index> failed`

### Requirement: Dev agent role
The system SHALL execute dev work as a top-level Claude Code subprocess invoked via `claude -p "/nightshift-do-task <shift> <task> <id>"` rather than as a subagent. The dev subprocess SHALL receive the task steps (via the `nightshift-do-task` skill's resolution logic), item metadata, shift metadata, environment variables (if a `.env` file exists), tool configuration (from the task file's Configuration section), the table path, the task column name, the 0-based qsv positional index, and the `disable-self-improvement` flag state via the skill's argument resolution. After execution, the dev SHALL run self-validation against the Validation criteria, retry up to 2 times if self-validation fails (refining its approach in-memory across retries), report step improvement recommendations in its final result event unless `disable-self-improvement` is active (in which case it SHALL emit `recommendations: None`), and write its own status transition to `table.csv` using `flock -x <table_path> qsv edit -i`.

#### Scenario: Dev executes task steps
- **WHEN** the dev subprocess is invoked for task "create_page" on item id 4
- **THEN** it SHALL follow the Steps section of the task file, substituting `{column_name}` placeholders with values from the item's metadata columns, `{ENV:VAR_NAME}` placeholders with values from the shift's `.env` file, and `{SHIFT:FOLDER}`, `{SHIFT:NAME}`, and `{SHIFT:TABLE}` placeholders with the shift directory path, shift name, and table file path respectively

#### Scenario: Dev writes done status on success
- **WHEN** the dev subprocess completes execution with self-validation passing AND the `--read-only` flag is not set
- **THEN** it SHALL write the item-task status to `done` in `table.csv` using `flock -x <table_path> qsv edit -i <table_path> <task_column> <qsv_index> done`

#### Scenario: Dev writes failed status on failure
- **WHEN** the dev subprocess exhausts retries AND the `--read-only` flag is not set
- **THEN** it SHALL write the item-task status to `failed` in `table.csv`

#### Scenario: Dev has scoped tool access
- **WHEN** the dev subprocess is invoked for a task whose Configuration section lists `tools: playwright, google_workspace`
- **THEN** the skill body SHALL declare its required tools (or the manager SHALL pass them via `--allowedTools`) such that the listed tools plus the dev's default tool set are available

#### Scenario: Dev inherits user-level MCPs
- **WHEN** the dev subprocess starts under `claude -p`
- **THEN** it SHALL have access to every MCP server the user has configured at the user level, without those MCPs being declared in any Nightshift-shipped file

#### Scenario: Dev returns structured results
- **WHEN** the dev subprocess completes execution
- **THEN** its final `result` event in the stream-json log SHALL contain: status (`done|failed`), attempts count, error details (if failed), self-validation results, and step improvement recommendations (or `recommendations: None` if `disable-self-improvement` is active)

#### Scenario: Dev processes one item at a time
- **WHEN** a dev subprocess is invoked
- **THEN** it SHALL process exactly one item (one table row) per invocation, operating with a fresh top-level Claude session

#### Scenario: Dev reports recommendations instead of editing task file
- **WHEN** the dev subprocess completes step execution and identifies potential improvements to the steps AND `disable-self-improvement` is not active
- **THEN** it SHALL include the improvements as `recommendations` in its result event and SHALL NOT directly edit the Steps section of the task file

#### Scenario: Dev skips recommendations when flag is set
- **WHEN** the dev subprocess is invoked with `disable-self-improvement` active
- **THEN** it SHALL NOT run the Identify Recommendations step and SHALL emit `recommendations: None` in its result event

### Requirement: Fresh context per item
Each dev subprocess invocation SHALL operate with a fresh top-level Claude Code session containing only the task instructions and current item metadata — not the full shift history or other item results.

#### Scenario: Dev gets clean context
- **WHEN** the manager dispatches an item with id 9 to a dev subprocess
- **THEN** the dev SHALL receive only: the task file content (via the do-task skill's resolution), that item's metadata from table.csv (via the skill's row lookup), the shift's environment variables, and any task-specific configuration — not results from other items

### Requirement: Manager agent qsv and flock bash permissions
The manager subagent SHALL declare its `tools` such that `Bash(qsv *)`, `Bash(flock *)`, and `Bash(claude *)` are pre-approved. The `Bash(claude *)` allow is required so the manager can spawn dev subprocesses without permission prompts.

#### Scenario: Manager can execute flock-prefixed qsv commands
- **WHEN** the manager agent needs to read `table.csv`
- **THEN** it SHALL execute `flock -x <table_path> qsv` subcommands via the Bash tool without permission denial

#### Scenario: Manager can execute claude CLI subprocesses
- **WHEN** the manager needs to dispatch dev work
- **THEN** it SHALL execute `claude -p ...` (directly or via `dispatch-batch.sh`) via the Bash tool without permission denial

#### Scenario: Manager cannot execute non-allowed bash commands
- **WHEN** the manager agent attempts to run a bash command that does not match the `qsv*`, `flock*`, or `claude*` patterns
- **THEN** the command SHALL be denied by the permission policy

### Requirement: Claude Code subagent surface
The system SHALL provide one Claude Code subagent definition: `nightshift-manager`, at `.claude/agents/nightshift-manager.md`. The dev role SHALL NOT have a corresponding subagent file; dev work runs as a top-level subprocess of the `nightshift-do-task` skill (see the `dev-subprocess` capability).

#### Scenario: Manager subagent file exists after install
- **WHEN** `nightshift init` completes successfully
- **THEN** `.claude/agents/nightshift-manager.md` SHALL exist with valid Claude Code subagent frontmatter (at minimum `name`, `description`, `tools`, `model`)

#### Scenario: No nightshift-dev subagent file
- **WHEN** `nightshift init` completes successfully
- **THEN** `.claude/agents/nightshift-dev.md` SHALL NOT exist; if a pre-existing file from a prior installation is detected, `nightshift init` SHALL remove or rename it (see the installer spec for cleanup behavior)

### Requirement: Manager subagent restricts spawnable subagents to dev
The Claude `nightshift-manager` subagent SHALL declare `tools` such that the `Agent` tool is NOT present — the manager cannot spawn any subagent. Delegation to dev work occurs via the Bash tool spawning `claude -p` subprocesses, not via Agent.

#### Scenario: Manager tools omit Agent
- **WHEN** `.claude/agents/nightshift-manager.md` is parsed
- **THEN** its `tools` field SHALL NOT include `Agent`, `Agent(*)`, or any `Agent(<name>)` entry

#### Scenario: Manager has the tools required for orchestration
- **WHEN** `.claude/agents/nightshift-manager.md` is parsed
- **THEN** its `tools` field SHALL include `Read`, `Write`, `Edit`, `Bash`, `Glob`, and `Grep` so the manager can read configuration, write task files, edit state files, run qsv/flock commands, and spawn dev subprocesses via `claude -p`

### Requirement: Manager subagent body fits Claude Code re-attach budget
The system SHALL keep the prose body (frontmatter excluded) of `.claude/agents/nightshift-manager.md` under 5,000 tokens so that the manager's instructions survive Claude Code's auto-compaction event during long shifts. The build or test process SHALL verify this constraint.

#### Scenario: Manager body within budget
- **WHEN** the Claude target template `templates/claude/agents/nightshift-manager.md` is built and tested
- **THEN** the body content (everything after the closing `---` of the frontmatter) SHALL measure under 5,000 tokens (estimated as fewer than 20,000 characters as a conservative proxy)

### Requirement: Subagent model defaults
The system SHALL default the Claude `nightshift-manager` subagent to `model: sonnet` for orchestration intelligence. The dev role no longer has a subagent and therefore no model default — the dev subprocess uses whatever model the user has configured for top-level Claude Code (or whatever the manager passes via `--model` when invoking `claude -p`).

#### Scenario: Manager defaults to sonnet
- **WHEN** `.claude/agents/nightshift-manager.md` is parsed
- **THEN** its `model` frontmatter field SHALL be `sonnet`

#### Scenario: Dev subprocess uses inherited or manager-specified model
- **WHEN** the manager spawns a dev subprocess
- **THEN** the model SHALL be either the user's default (when `--model` is not passed) or a model the manager explicitly selects (when `--model` is passed)

## REMOVED Requirements

### Requirement: Dev subagent cannot delegate
**Reason:** The dev role is no longer a subagent in 3.x — it runs as a top-level `claude -p` subprocess. The "cannot delegate" guarantee provided by the subagent's `tools` allowlist no longer applies because there is no subagent file to set tools on. The new equivalent guarantee is enforced via the `nightshift-do-task` skill body's prose plus the `--permission-mode auto` classifier (or `bypassPermissions` fallback) — both of which are specified in the `dev-subprocess` capability.
**Migration:** Users relying on the static "dev cannot spawn other subagents" guarantee gain a runtime classifier guardrail in auto mode. In `bypassPermissions` mode the trade-off is explicit and documented.

### Requirement: Dev subagent documents Playwright as user-configured
**Reason:** The dev role is no longer a subagent. The "commented-out Playwright MCP server example in the subagent frontmatter" use case no longer applies — dev subprocesses inherit the user's top-level MCP configuration directly, so Playwright (or any other MCP) is enabled wherever the user enabled it globally.
**Migration:** Users who want Playwright available to dev work configure it at the Claude Code user level (per Claude Code's MCP setup docs) instead of in a subagent file. The README updates to describe this.
