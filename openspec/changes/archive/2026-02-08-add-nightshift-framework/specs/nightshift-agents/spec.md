## ADDED Requirements

### Requirement: Manager agent role
The system SHALL define a `nightshift-manager` subagent that orchestrates shift execution. The manager SHALL read `manager.md` and `table.csv`, determine which items need processing, and delegate work to the dev and qa agents.

#### Scenario: Manager reads shift state
- **WHEN** the manager agent is invoked for a shift
- **THEN** it SHALL read `manager.md` for task order and `table.csv` for item statuses before making any delegation decisions

#### Scenario: Manager delegates to dev
- **WHEN** the manager identifies an item-task with status `todo`
- **THEN** it SHALL invoke the nightshift-dev agent with the task file contents and the item's row metadata, and update the item-task status to `in_progress`

#### Scenario: Manager delegates to qa
- **WHEN** the dev agent completes work on an item-task
- **THEN** the manager SHALL invoke the nightshift-qa agent with the task's validation criteria and the item's row metadata, and update the item-task status to `qa`

#### Scenario: Manager updates status after qa
- **WHEN** the qa agent returns a pass result
- **THEN** the manager SHALL update the item-task status to `done` in table.csv

#### Scenario: Manager handles qa failure
- **WHEN** the qa agent returns a fail result
- **THEN** the manager SHALL update the item-task status to `failed` in table.csv and record the failure reason

#### Scenario: Manager updates progress section
- **WHEN** an item-task status changes
- **THEN** the manager SHALL update the Progress section in `manager.md` with current counts of completed, failed, and remaining items

### Requirement: Manager processes tasks in order
The manager SHALL process tasks for each item in the order specified in the Task Order section of `manager.md`. A subsequent task for an item SHALL NOT begin until all preceding tasks for that item are `done`.

#### Scenario: Sequential task processing per item
- **WHEN** a shift has tasks "create-page" then "update-spreadsheet" and item row 5 has `create-page: done` and `update-spreadsheet: todo`
- **THEN** the manager SHALL process "update-spreadsheet" for row 5

#### Scenario: Blocked task skipped
- **WHEN** item row 5 has `create-page: failed` and `update-spreadsheet: todo`
- **THEN** the manager SHALL NOT process "update-spreadsheet" for row 5 since the prerequisite task failed

### Requirement: Manager is the sole writer of table state
The manager agent SHALL be the only agent that writes to `table.csv`. The dev and qa agents SHALL report results back to the manager, which then updates the table.

#### Scenario: Dev reports to manager
- **WHEN** the dev agent finishes executing steps
- **THEN** it SHALL return results to the manager without directly modifying table.csv

#### Scenario: QA reports to manager
- **WHEN** the qa agent finishes verification
- **THEN** it SHALL return pass/fail results to the manager without directly modifying table.csv

### Requirement: Dev agent role
The system SHALL define a `nightshift-dev` subagent that executes task steps on a single table item. The dev agent SHALL receive the task steps, item metadata, and tool configuration from the manager.

#### Scenario: Dev executes task steps
- **WHEN** the dev agent is invoked for task "create-page" on item row 5
- **THEN** it SHALL follow the Steps section of the task file, substituting `{column_name}` placeholders with values from row 5's metadata columns

#### Scenario: Dev has scoped tool access
- **WHEN** the dev agent is invoked with task configuration listing `tools: playwright, google_workspace`
- **THEN** it SHALL have access to those MCP tools plus default tools (read, write, edit, glob, grep)

#### Scenario: Dev returns structured results
- **WHEN** the dev agent completes execution
- **THEN** it SHALL return to the manager: step-by-step outcomes, captured values, any error details, and whether execution completed or was halted by a failure

#### Scenario: Dev processes one item at a time
- **WHEN** the dev agent is invoked
- **THEN** it SHALL process exactly one item (one table row) per invocation, operating with a fresh context each time

### Requirement: QA agent role
The system SHALL define a `nightshift-qa` subagent that verifies task completion against validation criteria. The QA agent SHALL receive the validation criteria, item metadata, and the dev agent's reported results.

#### Scenario: QA checks all validation criteria
- **WHEN** the qa agent is invoked for task "create-page" on item row 5
- **THEN** it SHALL evaluate each criterion in the Validation section independently and report pass/fail per criterion

#### Scenario: QA returns pass when all criteria met
- **WHEN** all validation criteria pass for an item-task
- **THEN** the qa agent SHALL return a pass result to the manager

#### Scenario: QA returns fail with details
- **WHEN** any validation criterion fails for an item-task
- **THEN** the qa agent SHALL return a fail result to the manager with details about which criteria failed and why

#### Scenario: QA has scoped tool access
- **WHEN** the qa agent is invoked with task configuration listing `tools: playwright, google_workspace`
- **THEN** it SHALL have access to those MCP tools plus default tools (read, write, edit, glob, grep) for verification purposes

#### Scenario: QA does not modify application state
- **WHEN** the qa agent verifies task completion
- **THEN** it SHALL only read and observe — it SHALL NOT create, modify, or delete any resources outside of reporting its findings

### Requirement: Agent definitions in opencode.jsonc
The system SHALL define all three agents (`nightshift-manager`, `nightshift-dev`, `nightshift-qa`) in `opencode.jsonc` with appropriate mode and tool permissions.

#### Scenario: Manager agent definition
- **WHEN** `opencode.jsonc` is read
- **THEN** it SHALL contain a `nightshift-manager` agent with `mode: "subagent"` and access to read, write, edit, glob, grep, and task tools

#### Scenario: Dev agent definition
- **WHEN** `opencode.jsonc` is read
- **THEN** it SHALL contain a `nightshift-dev` agent with `mode: "subagent"` and access to read, write, edit, glob, grep tools (MCP tools granted per task configuration)

#### Scenario: QA agent definition
- **WHEN** `opencode.jsonc` is read
- **THEN** it SHALL contain a `nightshift-qa` agent with `mode: "subagent"` and access to read, glob, grep tools (MCP tools granted per task configuration, no write/edit to prevent state modification)

### Requirement: Fresh context per item
Each dev and qa agent invocation SHALL operate with a fresh context containing only the task instructions and current item metadata — not the full shift history or other item results.

#### Scenario: Dev gets clean context
- **WHEN** the manager delegates item row 10 to the dev agent
- **THEN** the dev agent SHALL receive only: the task file content, row 10's metadata from table.csv, and any task-specific configuration — not results from rows 1-9

#### Scenario: QA gets clean context
- **WHEN** the manager delegates item row 10 to the qa agent
- **THEN** the qa agent SHALL receive only: the task's validation criteria, row 10's metadata, and the dev agent's results for row 10
