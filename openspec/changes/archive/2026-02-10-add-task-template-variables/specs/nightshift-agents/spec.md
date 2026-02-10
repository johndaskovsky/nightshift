## MODIFIED Requirements

### Requirement: Dev agent role
The system SHALL define a `nightshift-dev` subagent that executes task steps on a single table item. The dev agent SHALL receive the task steps, item metadata, shift metadata, environment variables (if a `.env` file exists), and tool configuration from the manager. After execution, the dev agent SHALL refine the Steps section of the task file, run self-validation against the Validation criteria, and retry up to 2 times if self-validation fails.

#### Scenario: Dev executes task steps
- **WHEN** the dev agent is invoked for task "create-page" on item row 5
- **THEN** it SHALL follow the Steps section of the task file, substituting `{column_name}` placeholders with values from row 5's metadata columns, `{ENV:VAR_NAME}` placeholders with values from the shift's `.env` file, and `{SHIFT:FOLDER}` and `{SHIFT:NAME}` placeholders with the shift directory path and shift name respectively

#### Scenario: Dev has scoped tool access
- **WHEN** the dev agent is invoked with task configuration listing `tools: playwright, google_workspace`
- **THEN** it SHALL have access to those MCP tools plus default tools (read, write, edit, glob, grep)

#### Scenario: Dev returns structured results
- **WHEN** the dev agent completes execution
- **THEN** it SHALL return to the manager: step-by-step outcomes, captured values, any error details, self-validation results, attempt count, whether steps were refined, and whether execution completed or was halted by a failure

#### Scenario: Dev processes one item at a time
- **WHEN** the dev agent is invoked
- **THEN** it SHALL process exactly one item (one table row) per invocation, operating with a fresh context each time

#### Scenario: Dev self-improves and self-validates
- **WHEN** the dev agent completes step execution
- **THEN** it SHALL refine the Steps section if improvements are identified, run self-validation against the Validation criteria, and retry execution if self-validation fails (up to 3 total attempts)

### Requirement: Manager agent role
The system SHALL define a `nightshift-manager` subagent that orchestrates shift execution. The manager SHALL read `manager.md`, `table.csv`, and the shift's `.env` file (if present), determine which items need processing, and delegate work to the dev and qa agents. The manager SHALL pass environment variable key-value pairs to the dev agent as part of the delegation context.

#### Scenario: Manager reads shift state
- **WHEN** the manager agent is invoked for a shift
- **THEN** it SHALL read `manager.md` for task order, `table.csv` for item statuses, and `.env` for environment variables (if the file exists) before making any delegation decisions

#### Scenario: Manager delegates to dev
- **WHEN** the manager identifies an item-task with status `todo`
- **THEN** it SHALL invoke the nightshift-dev agent with the task file contents (including Validation section), the item's row metadata, environment variables from `.env` (if present), shift metadata (shift name, shift directory path), and instructions about self-improvement, self-validation, and retry behavior, and update the item-task status to `in_progress`

#### Scenario: Manager delegates to qa
- **WHEN** the dev agent completes work on an item-task
- **THEN** the manager SHALL invoke the nightshift-qa agent with the task's validation criteria and the item's row metadata, and update the item-task status to `qa`

#### Scenario: Manager updates status after qa
- **WHEN** the qa agent returns a pass result
- **THEN** the manager SHALL update the item-task status to `done` in table.csv

#### Scenario: Manager handles qa failure
- **WHEN** the qa agent returns a fail result
- **THEN** the manager SHALL update the item-task status to `failed` in table.csv and record the failure reason

#### Scenario: Manager handles dev failure after retries
- **WHEN** the dev agent returns a failure result (after exhausting retries)
- **THEN** the manager SHALL update the item-task status to `failed` in table.csv and record the failure details including attempt count

#### Scenario: Manager updates progress section
- **WHEN** an item-task status changes
- **THEN** the manager SHALL update the Progress section in `manager.md` with current counts of completed, failed, and remaining items
