## MODIFIED Requirements

### Requirement: Manager agent role
The system SHALL define a `nightshift-manager` subagent that orchestrates shift execution. The manager SHALL read `manager.md`, `table.csv`, and the shift's `.env` file (if present), determine which items need processing, and delegate work to the dev and qa agents. The manager SHALL pass environment variable key-value pairs to the dev agent as part of the delegation context. The manager SHALL be responsible for applying step improvements to task files based on dev agent recommendations, but SHALL only incorporate recommendations from dev processes that completed successfully (`overall_status: "SUCCESS"`). Recommendations from failed dev processes SHALL be discarded. The manager SHALL use `flock -x <table_path> qsv` commands for all CSV read operations on `table.csv`. The manager SHALL NOT write item-task status transitions to `table.csv` -- status writes are the responsibility of the dev and QA agents.

#### Scenario: Manager reads shift state
- **WHEN** the manager agent is invoked for a shift
- **THEN** it SHALL read `manager.md` for task order and parallel configuration, query `table.csv` using `flock -x <table_path> qsv` commands for item statuses, and read `.env` for environment variables (if the file exists) before making any delegation decisions

#### Scenario: Manager delegates to dev
- **WHEN** the manager identifies an item-task with status `todo`
- **THEN** it SHALL invoke the nightshift-dev agent with the task file contents (including Validation section), the item's row metadata (extracted via `flock -x <table_path> qsv slice` and `flock -x <table_path> qsv select`), environment variables from `.env` (if present), shift metadata (shift name, shift directory path), the table path, the task column name, and the qsv row index, and instructions about self-validation, retry behavior, and status update responsibility

#### Scenario: Manager delegates to qa
- **WHEN** the manager identifies an item-task with status `qa` (set by the dev agent after successful execution)
- **THEN** the manager SHALL invoke the nightshift-qa agent with the task's validation criteria, the item's row metadata, the table path, the task column name, and the qsv row index

#### Scenario: Manager updates status after qa
- **WHEN** the qa agent returns results
- **THEN** the manager SHALL NOT update the item-task status in `table.csv` -- the QA agent is responsible for writing its own status transition (`done` or `failed`)

#### Scenario: Manager handles dev failure after retries
- **WHEN** the dev agent returns a failure result (after exhausting retries)
- **THEN** the manager SHALL NOT update the item-task status in `table.csv` -- the dev agent is responsible for writing its own status transition to `failed`

#### Scenario: Manager updates progress section
- **WHEN** a batch of items has been processed (all dev and QA agents have returned)
- **THEN** the manager SHALL update the Progress section in `manager.md` with current counts derived from `flock -x <table_path> qsv search` and `flock -x <table_path> qsv count` operations on `table.csv`

#### Scenario: Manager applies step improvements from successful dev only
- **WHEN** the manager receives results from dev agent(s) and the dev agent's `overall_status` is `SUCCESS` and the results contain a Recommendations section
- **THEN** the manager SHALL review the recommendations, synthesize non-contradictory improvements, and apply a single coherent update to the Steps section of the task file before delegating the next item or batch

#### Scenario: Manager discards recommendations from failed dev
- **WHEN** the manager receives results from a dev agent whose `overall_status` contains `FAILED`
- **THEN** the manager SHALL discard the Recommendations section from that dev agent's results and SHALL NOT apply any of those recommendations to the task file

#### Scenario: Manager deduplicates recommendations from parallel batch
- **WHEN** the manager receives recommendations from multiple concurrent dev agents in a parallel batch
- **THEN** it SHALL consider only recommendations from successful dev agents, identify common patterns, deduplicate similar suggestions, resolve contradictions, and apply one unified update to the Steps section

#### Scenario: Manager reports progress after each batch
- **WHEN** the manager completes processing a batch of items (or a single item in sequential mode)
- **THEN** it SHALL output a structured progress report containing `Progress: M/N` (where M is items with all tasks `done` and N is total items) and `Compacted: true` or `Compacted: false` indicating whether context compaction was detected during the batch

#### Scenario: Manager detects context compaction
- **WHEN** the manager begins processing a new batch and cannot confirm it has the expected context (e.g., it does not know the shift name, directory, or current task)
- **THEN** it SHALL report `Compacted: true` in its progress output and stop processing

### Requirement: Manager is the sole writer of task files and manager.md
The manager agent SHALL be the only agent that writes to task files (for step improvements) and `manager.md` (for progress updates and batch size). The manager SHALL NOT write item-task status transitions to `table.csv` -- those writes are the responsibility of the dev and QA agents.

#### Scenario: Dev reports to manager
- **WHEN** the dev agent finishes executing steps
- **THEN** it SHALL return results to the manager AND write its own status transition to `table.csv` (`qa` on success, `failed` on failure) using `flock -x <table_path> qsv edit -i`

#### Scenario: QA reports to manager
- **WHEN** the qa agent finishes verification
- **THEN** it SHALL return pass/fail results to the manager AND write its own status transition to `table.csv` (`done` on pass, `failed` on fail) using `flock -x <table_path> qsv edit -i`

### Requirement: Dev agent role
The system SHALL define a `nightshift-dev` subagent that executes task steps on a single table item. The dev agent SHALL receive the task steps, item metadata, shift metadata, environment variables (if a `.env` file exists), tool configuration, the table path, the task column name, and the qsv row index from the manager. After execution, the dev agent SHALL run self-validation against the Validation criteria, retry up to 2 times if self-validation fails (refining its approach in-memory across retries), report step improvement recommendations to the manager, and write its own status transition to `table.csv` using `flock -x <table_path> qsv edit -i`.

#### Scenario: Dev executes task steps
- **WHEN** the dev agent is invoked for task "create_page" on item row 5
- **THEN** it SHALL follow the Steps section of the task file, substituting `{column_name}` placeholders with values from row 5's metadata columns, `{ENV:VAR_NAME}` placeholders with values from the shift's `.env` file, and `{SHIFT:FOLDER}`, `{SHIFT:NAME}`, and `{SHIFT:TABLE}` placeholders with the shift directory path, shift name, and table file path respectively

#### Scenario: Dev writes qa status on success
- **WHEN** the dev agent completes execution with `overall_status: "SUCCESS"` (self-validation passed)
- **THEN** it SHALL write the item-task status to `qa` in `table.csv` using `flock -x <table_path> qsv edit -i <table_path> <task_column> <qsv_index> qa`

#### Scenario: Dev writes failed status on failure
- **WHEN** the dev agent completes execution with `overall_status` containing `FAILED` (after exhausting retries)
- **THEN** it SHALL write the item-task status to `failed` in `table.csv` using `flock -x <table_path> qsv edit -i <table_path> <task_column> <qsv_index> failed`

#### Scenario: Dev has scoped tool access
- **WHEN** the dev agent is invoked with task configuration listing `tools: playwright, google_workspace`
- **THEN** it SHALL have access to those MCP tools plus default tools (read, write, edit, glob, grep)

#### Scenario: Dev returns structured results
- **WHEN** the dev agent completes execution
- **THEN** it SHALL return to the manager: step-by-step outcomes, captured values, any error details, self-validation results, attempt count, and step improvement recommendations

#### Scenario: Dev processes one item at a time
- **WHEN** the dev agent is invoked
- **THEN** it SHALL process exactly one item (one table row) per invocation, operating with a fresh context each time

#### Scenario: Dev reports recommendations instead of editing task file
- **WHEN** the dev agent completes step execution and identifies potential improvements to the steps
- **THEN** it SHALL include the improvements as recommendations in its result output and SHALL NOT directly edit the Steps section of the task file

### Requirement: QA agent role
The system SHALL define a `nightshift-qa` subagent that verifies task completion against validation criteria. The QA agent SHALL receive the validation criteria, item metadata, the dev agent's reported results, the table path, the task column name, and the qsv row index. After verification, the QA agent SHALL write its own status transition to `table.csv`.

#### Scenario: QA checks all validation criteria
- **WHEN** the qa agent is invoked for task "create_page" on item row 5
- **THEN** it SHALL evaluate each criterion in the Validation section independently and report pass/fail per criterion

#### Scenario: QA writes done status on pass
- **WHEN** all validation criteria pass for an item-task
- **THEN** the qa agent SHALL write the item-task status to `done` in `table.csv` using `flock -x <table_path> qsv edit -i <table_path> <task_column> <qsv_index> done` and return a pass result to the manager

#### Scenario: QA writes failed status on fail
- **WHEN** any validation criterion fails for an item-task
- **THEN** the qa agent SHALL write the item-task status to `failed` in `table.csv` using `flock -x <table_path> qsv edit -i <table_path> <task_column> <qsv_index> failed` and return a fail result to the manager with details about which criteria failed and why

#### Scenario: QA has scoped tool access
- **WHEN** the qa agent is invoked with task configuration listing `tools: playwright, google_workspace`
- **THEN** it SHALL have access to those MCP tools plus default tools (read, write, edit, glob, grep) for verification purposes

#### Scenario: QA does not modify application state
- **WHEN** the qa agent verifies task completion
- **THEN** it SHALL only read and observe application state — it SHALL NOT create, modify, or delete any resources outside of updating its item-task status in `table.csv` and reporting its findings

### Requirement: Manager agent qsv and flock bash permissions
The manager agent SHALL have `qsv*` and `flock*` commands allowed in its bash permission configuration, as an exception to the default deny-all bash policy.

#### Scenario: Manager can execute flock-prefixed qsv commands
- **WHEN** the manager agent needs to read `table.csv`
- **THEN** it SHALL execute `flock -x <table_path> qsv` subcommands via the Bash tool without permission denial

#### Scenario: Manager cannot execute non-qsv non-flock bash commands
- **WHEN** the manager agent attempts to run a bash command that does not match the `qsv*` or `flock*` patterns
- **THEN** the command SHALL be denied by the permission policy

## REMOVED Requirements

### Requirement: Manager is the sole writer of table state
**Reason:** Replaced by decentralized state management. Dev and QA agents now write their own status transitions to `table.csv` using `flock`-protected `qsv` commands. The manager retains write authority over task files and `manager.md` only.
**Migration:** Manager delegation prompts must include table path, task column name, and qsv row index so dev and QA agents can construct their own `flock -x <table_path> qsv edit -i` commands.

### Requirement: Manager agent qsv bash permissions
**Reason:** Replaced by expanded requirement "Manager agent qsv and flock bash permissions" that adds `flock*` to the allowed commands alongside `qsv*`.
**Migration:** Add `"flock*": allow` to the manager agent's bash permission block.
