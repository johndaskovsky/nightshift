# nightshift-agents Specification

## Purpose
Defines the manager and dev agent roles, their orchestration contract (item selection, retry budget, self-validation, self-improvement), permission scope, and the Claude Code subagent surface.
## Requirements
### Requirement: Manager agent role
The system SHALL define a `nightshift-manager` subagent that orchestrates shift execution. The manager SHALL read `manager.md`, `table.csv`, and the shift's `.env` file (if present), determine which items need processing, resolve per-task execution-config fields (`model`, `working_dir`, `worktree`) using item data and shift metadata, and dispatch work to dev subprocesses via the Bash tool (`${CLAUDE_SKILL_DIR}/scripts/dispatch-batch.sh`). The manager SHALL be responsible for applying step improvements to task files based on dev subprocess recommendations, unless `disable-self-improvement: true` is set in the Shift Configuration section of `manager.md`. The manager SHALL use `qsv` CLI commands for all CSV operations on `table.csv`. The manager SHALL process all remaining items autonomously within a single session, returning to the supervisor only when all work is complete.

#### Scenario: Manager reads shift state
- **WHEN** the manager agent is invoked for a shift
- **THEN** it SHALL read `manager.md` for task order, parallel configuration, and the `disable-self-improvement` flag; query `table.csv` using `qsv` commands for item statuses; and read `.env` for environment variables (if the file exists) before making any dispatch decisions

#### Scenario: Manager reads task execution config
- **WHEN** the manager reads `<task-name>.md` to dispatch work for that task
- **THEN** it SHALL parse the Configuration section for the fields `tools`, `model`, `working_dir`, and `worktree`, treating each as optional

#### Scenario: Manager resolves placeholders in working_dir
- **WHEN** a task's `working_dir` value contains placeholders (`{column}`, `{ENV:VAR}`, `{SHIFT:FOLDER|NAME|TABLE}`)
- **THEN** the manager SHALL substitute placeholders per-item using that item's row data, shift environment variables, and shift metadata, producing a fully-resolved literal path before manifest construction

#### Scenario: Manager performs trust pre-flight before worktree batches
- **WHEN** any item in the next batch has `worktree: true`
- **THEN** the manager SHALL collect the set of unique resolved `working_dir` values, probe each by running `claude --worktree probe-trust-<random-suffix> -p "exit"` from that directory, and abort the shift with a clear remediation message if any directory is untrusted; the manager SHALL NOT dispatch any items in the batch until trust is accepted for all directories

#### Scenario: Manager skips trust pre-flight when worktree is not used
- **WHEN** no items in the next batch have `worktree: true`
- **THEN** the manager SHALL skip the trust probe entirely

#### Scenario: Manager dispatches dev subprocess with execution-config fields
- **WHEN** the manager identifies item(s) to dispatch
- **THEN** it SHALL invoke `${CLAUDE_SKILL_DIR}/scripts/dispatch-batch.sh` with a JSON manifest containing the shift name, the items array (each entry including `item_id`, `task`, resolved `working_dir`, `worktree` boolean, `worktree_name`, and `model`), the resolved `permission_mode`, and the log directory; the helper SHALL spawn one `claude -p "/nightshift-do-task <shift> <task> <id>" --output-format stream-json --verbose --permission-mode <mode>` subprocess per item, with `--model` and `--worktree` appended per-item where set, and with cwd set to `working_dir` where set

#### Scenario: Manager fails working_dir-not-found items without retry
- **WHEN** an item's resolved `working_dir` does not exist as a directory
- **THEN** the manager SHALL write `failed` to that item's status in `table.csv`, record the failure with error message `working_dir does not exist: <path>`, and SHALL NOT retry the item

#### Scenario: Manager handles dev failure after retries
- **WHEN** a dev subprocess returns a result with `status: failed` and the item has exhausted its retry budget
- **THEN** the manager SHALL log the `error` field from the parsed result event and proceed to the next item or batch

#### Scenario: Manager surfaces preserved worktrees in completion summary
- **WHEN** the manager finishes a shift and the dispatch helper reported any `worktree_preserved` entries
- **THEN** the manager's final shift summary SHALL list each preserved worktree path so the user knows where to inspect leftover state and how to clean up (`git worktree remove --force <path>` per repo)

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

### Requirement: Manager processes tasks in order
The manager SHALL process tasks for each item in the order specified in the Task Order section of `manager.md`. A subsequent task for an item SHALL NOT begin until all preceding tasks for that item are `done`.

#### Scenario: Sequential task processing per item
- **WHEN** a shift has tasks "create_page" then "update_spreadsheet" and item at position 4 (0-based) has `create_page: done` and `update_spreadsheet: todo`
- **THEN** the manager SHALL process "update_spreadsheet" for that item

#### Scenario: Blocked task skipped
- **WHEN** item at position 4 (0-based) has `create_page: failed` and `update_spreadsheet: todo`
- **THEN** the manager SHALL NOT process "update_spreadsheet" for that item since the prerequisite task failed

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

