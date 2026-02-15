## MODIFIED Requirements

### Requirement: Task steps section
The Steps section SHALL contain numbered instructions that the dev agent follows to execute the task on a single table item. Steps SHALL be detailed enough for unsupervised execution. The manager agent SHALL apply step improvements to the task file based on dev agent recommendations between items or batches, but SHALL only incorporate recommendations from dev processes that completed successfully. Recommendations from failed dev processes SHALL be discarded. The dev agent SHALL NOT directly edit the Steps section. Steps MAY reference environment variables using `{ENV:VAR_NAME}` syntax, shift metadata using `{SHIFT:FOLDER}`, `{SHIFT:NAME}`, or `{SHIFT:TABLE}` syntax, and table column data using `{column_name}` syntax (where `column_name` corresponds to a metadata column in table.csv).

#### Scenario: Steps reference table metadata
- **WHEN** steps reference item data using `{column_name}` placeholders
- **THEN** the dev agent SHALL substitute the actual values from the current table item's metadata columns before execution

#### Scenario: Steps reference environment variables
- **WHEN** steps reference environment variables using `{ENV:VAR_NAME}` placeholders
- **THEN** the dev agent SHALL substitute the actual values from the shift's `.env` file before execution

#### Scenario: Steps reference shift metadata
- **WHEN** steps reference shift metadata using `{SHIFT:FOLDER}`, `{SHIFT:NAME}`, or `{SHIFT:TABLE}` placeholders
- **THEN** the dev agent SHALL substitute the computed shift directory path, shift name, or table file path before execution

#### Scenario: Steps include error handling
- **WHEN** steps include conditional branches (e.g., "If X fails, then Y")
- **THEN** the dev agent SHALL follow the conditional logic during execution

#### Scenario: Manager applies step improvements from successful recommendations only
- **WHEN** the manager receives step improvement recommendations from a dev agent whose `overall_status` is `SUCCESS`
- **THEN** the manager SHALL review, synthesize, and apply a coherent update to the Steps section in the task file before delegating the next item or batch

#### Scenario: Manager discards step improvements from failed dev
- **WHEN** the manager receives step improvement recommendations from a dev agent whose `overall_status` contains `FAILED`
- **THEN** the manager SHALL discard those recommendations and SHALL NOT apply them to the Steps section

#### Scenario: Step improvements persist for subsequent items
- **WHEN** the manager applies step improvements after processing item N
- **THEN** item N+1 SHALL receive the improved steps when the manager delegates it to the dev agent

### Requirement: Task test execution
The system SHALL support running a single task on a single table item for testing purposes, without affecting other items or tasks in the shift.

#### Scenario: Test a task on one item
- **WHEN** a user invokes test-task for task "create_page" on item 5 (1-based display label)
- **THEN** the system SHALL execute the task steps on the item at qsv index 4 (0-based) only, run self-validation, and report the result without updating the table status

#### Scenario: Test preserves table state
- **WHEN** a test-task execution completes
- **THEN** the table.csv SHALL NOT be modified (status columns remain unchanged)
