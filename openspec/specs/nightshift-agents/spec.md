## ADDED Requirements

### Requirement: Manager agent role
The system SHALL define a `nightshift-manager` subagent that orchestrates shift execution. The manager SHALL read `manager.md`, `table.csv`, and the shift's `.env` file (if present), determine which items need processing, and delegate work to the dev agent. The manager SHALL pass environment variable key-value pairs to the dev agent as part of the delegation context. The manager SHALL be responsible for applying step improvements to task files based on dev agent recommendations, unless `disable-self-improvement: true` is set in the Shift Configuration section of `manager.md`. The manager SHALL use `qsv` CLI commands for all CSV operations on `table.csv`. The manager SHALL process all remaining items autonomously within a single session, returning to the supervisor only when all work is complete.

#### Scenario: Manager reads shift state
- **WHEN** the manager agent is invoked for a shift
- **THEN** it SHALL read `manager.md` for task order, parallel configuration, and the `disable-self-improvement` flag; query `table.csv` using `qsv` commands for item statuses; and read `.env` for environment variables (if the file exists) before making any delegation decisions

#### Scenario: Manager delegates to dev
- **WHEN** the manager identifies an item-task with status `todo`
- **THEN** it SHALL invoke the nightshift-dev agent with the task file contents (including Validation section), the item's metadata (extracted via `qsv slice --index <qsv_index>` and `qsv select`), environment variables from `.env` (if present), shift metadata (shift name, shift directory path), the table path, the task column name, the 0-based qsv positional index, instructions about self-validation and retry behavior, and whether `disable-self-improvement` is active

#### Scenario: Manager handles dev failure after retries
- **WHEN** the dev agent returns a result with `overall_status` containing `FAILED`
- **THEN** the manager SHALL log the `error` field from the dev output and proceed to the next item or batch

#### Scenario: Manager applies step improvements
- **WHEN** the manager receives results from dev agent(s) containing a `recommendations` field that is not "None" AND `disable-self-improvement` is not `true`
- **THEN** the manager SHALL review the recommendations, synthesize non-contradictory improvements, and apply a single coherent update to the Steps section of the task file before delegating the next item or batch

#### Scenario: Manager skips step improvements when flag is set
- **WHEN** the manager receives results from dev agent(s) AND `disable-self-improvement: true` is set in `manager.md`
- **THEN** the manager SHALL skip the Apply Step Improvements step entirely and proceed to the next item or batch without reading or acting on the `recommendations` field

#### Scenario: Manager deduplicates recommendations from parallel batch
- **WHEN** the manager receives recommendations from multiple concurrent dev agents in a parallel batch AND `disable-self-improvement` is not `true`
- **THEN** it SHALL identify common patterns, deduplicate similar suggestions, resolve contradictions, and apply one unified update to the Steps section

#### Scenario: Manager yields to supervisor on completion
- **WHEN** the manager has processed all items and no `todo` items remain across any task column
- **THEN** the manager SHALL derive final counts from `table.csv` using `qsv search` and `qsv count` operations and output a completion summary to the supervisor

### Requirement: Manager processes tasks in order
The manager SHALL process tasks for each item in the order specified in the Task Order section of `manager.md`. A subsequent task for an item SHALL NOT begin until all preceding tasks for that item are `done`.

#### Scenario: Sequential task processing per item
- **WHEN** a shift has tasks "create_page" then "update_spreadsheet" and item at position 4 (0-based) has `create_page: done` and `update_spreadsheet: todo`
- **THEN** the manager SHALL process "update_spreadsheet" for that item

#### Scenario: Blocked task skipped
- **WHEN** item at position 4 (0-based) has `create_page: failed` and `update_spreadsheet: todo`
- **THEN** the manager SHALL NOT process "update_spreadsheet" for that item since the prerequisite task failed

### Requirement: Decentralized status writes
The dev agent SHALL write its own status transitions to `table.csv` using `flock -x` prefixed `qsv edit -i` commands. The manager SHALL NOT write status transitions — it reads `table.csv` for status information and writes only to `manager.md` (configuration and task order) and task files (step improvements).

#### Scenario: Dev writes status on success
- **WHEN** the dev agent successfully completes execution and self-validation
- **THEN** it SHALL write `done` status to `table.csv` using `flock -x <table_path> qsv edit -i <table_path> <task_column> <qsv_index> done`

#### Scenario: Dev writes status on failure
- **WHEN** the dev agent fails after exhausting retries
- **THEN** it SHALL write `failed` status to `table.csv` using `flock -x <table_path> qsv edit -i <table_path> <task_column> <qsv_index> failed`

### Requirement: Dev agent role
The system SHALL define a `nightshift-dev` subagent that executes task steps on a single table item. The dev agent SHALL receive the task steps, item metadata, shift metadata, environment variables (if a `.env` file exists), tool configuration, the table path, the task column name, the 0-based qsv positional index, and the `disable-self-improvement` flag state from the manager. After execution, the dev agent SHALL run self-validation against the Validation criteria, retry up to 2 times if self-validation fails (refining its approach in-memory across retries), report step improvement recommendations to the manager unless `disable-self-improvement` is active (in which case it SHALL return `Recommendations: None` without running the Identify Recommendations step), and write its own status transition to `table.csv` using `flock -x <table_path> qsv edit -i`.

#### Scenario: Dev executes task steps
- **WHEN** the dev agent is invoked for task "create_page" on an item at qsv index 4
- **THEN** it SHALL follow the Steps section of the task file, substituting `{column_name}` placeholders with values from the item's metadata columns, `{ENV:VAR_NAME}` placeholders with values from the shift's `.env` file, and `{SHIFT:FOLDER}`, `{SHIFT:NAME}`, and `{SHIFT:TABLE}` placeholders with the shift directory path, shift name, and table file path respectively

#### Scenario: Dev writes done status on success
- **WHEN** the dev agent completes execution with `overall_status: "SUCCESS"` (self-validation passed)
- **THEN** it SHALL write the item-task status to `done` in `table.csv` using `flock -x <table_path> qsv edit -i <table_path> <task_column> <qsv_index> done`

#### Scenario: Dev writes failed status on failure
- **WHEN** the dev agent completes execution with `overall_status` containing `FAILED` (after exhausting retries)
- **THEN** it SHALL write the item-task status to `failed` in `table.csv` using `flock -x <table_path> qsv edit -i <table_path> <task_column> <qsv_index> failed`

#### Scenario: Dev has scoped tool access
- **WHEN** the dev agent is invoked with task configuration listing `tools: playwright, google_workspace`
- **THEN** it SHALL have access to those MCP tools plus default tools (read, write, edit, glob, grep)

#### Scenario: Dev returns structured results
- **WHEN** the dev agent completes execution
- **THEN** it SHALL return to the manager: step-by-step outcomes, captured values, any error details, self-validation results, attempt count, and step improvement recommendations (or `Recommendations: None` if `disable-self-improvement` is active)

#### Scenario: Dev processes one item at a time
- **WHEN** the dev agent is invoked
- **THEN** it SHALL process exactly one item (one table row) per invocation, operating with a fresh context each time

#### Scenario: Dev reports recommendations instead of editing task file
- **WHEN** the dev agent completes step execution and identifies potential improvements to the steps AND `disable-self-improvement` is not active
- **THEN** it SHALL include the improvements as recommendations in its result output and SHALL NOT directly edit the Steps section of the task file

#### Scenario: Dev skips recommendations when flag is set
- **WHEN** the dev agent is invoked with `disable-self-improvement` active
- **THEN** it SHALL NOT run the Identify Recommendations step and SHALL return `Recommendations: None` in its output

### Requirement: Fresh context per item
Each dev agent invocation SHALL operate with a fresh context containing only the task instructions and current item metadata — not the full shift history or other item results.

#### Scenario: Dev gets clean context
- **WHEN** the manager delegates an item at qsv index 9 to the dev agent
- **THEN** the dev agent SHALL receive only: the task file content, that item's metadata from table.csv, and any task-specific configuration — not results from other items

### Requirement: Dev agent self-validation
The dev agent SHALL evaluate the task's Validation criteria after completing step execution and before reporting results to the manager. This self-validation is the sole determination of item success or failure.

#### Scenario: Dev runs self-validation after steps complete
- **WHEN** the dev agent successfully completes all task steps for an item
- **THEN** it SHALL read the Validation section from the task file and evaluate each criterion against the execution outcomes

#### Scenario: Self-validation passes
- **WHEN** the dev agent's self-validation determines all criteria are met
- **THEN** the dev agent SHALL report success to the manager, including self-validation results and any recommendations in its output

#### Scenario: Self-validation fails triggers retry
- **WHEN** the dev agent's self-validation determines one or more criteria are not met AND the retry limit has not been reached
- **THEN** the dev agent SHALL refine its approach in-memory, re-execute the steps on the same item, and re-run self-validation

#### Scenario: Self-validation failure after retry limit
- **WHEN** the dev agent's self-validation fails AND the maximum number of attempts (3) has been reached
- **THEN** the dev agent SHALL report failure to the manager with details from all attempts and any recommendations gathered

### Requirement: Dev agent retry loop
The dev agent SHALL retry execution when self-validation fails, up to a bounded maximum of 3 total attempts (1 initial + 2 retries) per item. The dev agent SHALL refine its approach in-memory across retries but SHALL NOT write refinements to the task file.

#### Scenario: First retry after self-validation failure
- **WHEN** the dev agent's self-validation fails on the first attempt
- **THEN** the dev agent SHALL refine its approach in-memory based on the failure, re-execute all steps from the beginning on the same item, and run self-validation again

#### Scenario: Second retry after repeated failure
- **WHEN** the dev agent's self-validation fails on the second attempt
- **THEN** the dev agent SHALL refine its approach in-memory again, re-execute, and run self-validation one final time (attempt 3 of 3)

#### Scenario: Retry limit exceeded
- **WHEN** the dev agent has exhausted all 3 attempts and self-validation still fails
- **THEN** the dev agent SHALL report failure to the manager with `overall_status: "FAILED"` and include details from all attempts and final recommendations

#### Scenario: Step execution failure during retry
- **WHEN** a step fails during a retry attempt (not a validation failure)
- **THEN** the dev agent SHALL count this as a failed attempt, refine its approach in-memory, and retry if attempts remain

### Requirement: Dev agent step self-improvement
The dev agent SHALL retain in-memory self-improvement during retries within a single invocation but SHALL NOT directly edit the Steps section of the task file. Instead, the dev agent SHALL report step improvement recommendations to the manager in its result output, unless `disable-self-improvement` is active in which case the Identify Recommendations step is skipped entirely and `Recommendations: None` is returned.

#### Scenario: Dev refines approach in-memory during retries
- **WHEN** the dev agent identifies during execution that steps could be improved (e.g., a step was ambiguous, an error case was unhandled, an assumption was wrong)
- **THEN** the dev agent SHALL refine its understanding of the steps in-memory for use in subsequent retry attempts within the same invocation

#### Scenario: Dev preserves step intent in recommendations
- **WHEN** the dev agent formulates recommendations AND `disable-self-improvement` is not active
- **THEN** the recommendations SHALL preserve the original intent and goals of the task while suggesting improvements to execution reliability

#### Scenario: Dev does not write to task file
- **WHEN** the dev agent identifies step improvements
- **THEN** it SHALL NOT edit the Steps section of the task file directly, and SHALL instead include the improvements in its Recommendations output section (or return `Recommendations: None` if `disable-self-improvement` is active)

#### Scenario: Recommendations reported regardless of outcome
- **WHEN** the dev agent completes execution (success or failure) AND `disable-self-improvement` is not active
- **THEN** it SHALL include any identified step improvements in the Recommendations section of its output, even if execution failed

#### Scenario: Recommendations always None when flag is set
- **WHEN** the dev agent completes execution AND `disable-self-improvement` is active
- **THEN** it SHALL return `Recommendations: None` regardless of execution outcome

### Requirement: Dev agent extended output contract
The dev agent's result format returned to the manager SHALL include only the fields the manager acts on: `overall_status`, `recommendations`, and `error` (if failed). Verbose fields (per-step outcomes, captured values, self-validation details, attempt count) SHALL NOT be included in the output returned to the manager. The dev agent SHALL still use these fields internally for retry decisions and self-validation.

#### Scenario: Output includes overall status
- **WHEN** the dev agent returns results to the manager
- **THEN** the results SHALL include an `overall_status` field with value `SUCCESS`, `FAILED (step N)`, or `FAILED (validation)`

#### Scenario: Output includes recommendations
- **WHEN** the dev agent returns results to the manager
- **THEN** the results SHALL include a `recommendations` field listing any suggested step improvements, or explicitly stating "None" if no improvements were identified

#### Scenario: Output includes error on failure
- **WHEN** the dev agent returns results with `overall_status` containing `FAILED`
- **THEN** the results SHALL include an `error` field with the full failure description including details from all attempts

#### Scenario: Output excludes verbose fields
- **WHEN** the dev agent returns results to the manager
- **THEN** the results SHALL NOT include `Steps`, `Captured Values`, `Self-Validation`, or `Attempts` sections

### Requirement: Manager agent qsv and flock bash permissions
The manager agent SHALL have `qsv*` and `flock*` commands allowed in its bash permission configuration, as an exception to the default deny-all bash policy.

#### Scenario: Manager can execute flock-prefixed qsv commands
- **WHEN** the manager agent needs to read `table.csv`
- **THEN** it SHALL execute `flock -x <table_path> qsv` subcommands via the Bash tool without permission denial

#### Scenario: Manager cannot execute non-qsv non-flock bash commands
- **WHEN** the manager agent attempts to run a bash command that does not match the `qsv*` or `flock*` patterns
- **THEN** the command SHALL be denied by the permission policy

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
