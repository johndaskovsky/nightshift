## MODIFIED Requirements

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
