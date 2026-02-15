## MODIFIED Requirements

### Requirement: Task steps section
The Steps section SHALL contain numbered instructions that the dev agent follows to execute the task on a single table item. Steps SHALL be detailed enough for unsupervised execution. The manager agent SHALL apply step improvements to the task file based on dev agent recommendations between items or batches, but SHALL only incorporate recommendations from dev processes that completed successfully. Recommendations from failed dev processes SHALL be discarded. The dev agent SHALL NOT directly edit the Steps section. Steps MAY reference environment variables using `{ENV:VAR_NAME}` syntax, shift metadata using `{SHIFT:FOLDER}`, `{SHIFT:NAME}`, or `{SHIFT:TABLE}` syntax, and table column data using `{column_name}` syntax.

#### Scenario: Steps reference table metadata
- **WHEN** steps reference item data using `{column_name}` placeholders
- **THEN** the dev agent SHALL substitute the actual values from the current table row before execution

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
