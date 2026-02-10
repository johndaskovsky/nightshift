## MODIFIED Requirements

### Requirement: Task steps section
The Steps section SHALL contain numbered instructions that the dev agent follows to execute the task on a single table item. Steps SHALL be detailed enough for unsupervised execution. The dev agent SHALL be permitted to refine steps after execution based on what it learned, improving quality for subsequent items. Steps MAY reference environment variables using `{ENV:VAR_NAME}` syntax and shift metadata using `{SHIFT:FOLDER}` or `{SHIFT:NAME}` syntax, in addition to table column data using `{column_name}` syntax.

#### Scenario: Steps reference table metadata
- **WHEN** steps reference item data using `{column_name}` placeholders
- **THEN** the dev agent SHALL substitute the actual values from the current table row before execution

#### Scenario: Steps reference environment variables
- **WHEN** steps reference environment variables using `{ENV:VAR_NAME}` placeholders
- **THEN** the dev agent SHALL substitute the actual values from the shift's `.env` file before execution

#### Scenario: Steps reference shift metadata
- **WHEN** steps reference shift metadata using `{SHIFT:FOLDER}` or `{SHIFT:NAME}` placeholders
- **THEN** the dev agent SHALL substitute the computed shift directory path or shift name before execution

#### Scenario: Steps include error handling
- **WHEN** steps include conditional branches (e.g., "If X fails, then Y")
- **THEN** the dev agent SHALL follow the conditional logic during execution

#### Scenario: Dev refines steps after execution
- **WHEN** the dev agent completes executing steps on an item and identifies improvements (e.g., missing error handling, incorrect assumptions, ambiguous instructions)
- **THEN** the dev agent SHALL update the Steps section in the task file with the refined instructions before proceeding to self-validation

#### Scenario: Step refinements persist for subsequent items
- **WHEN** the dev agent refines steps during execution of item N
- **THEN** item N+1 SHALL receive the refined steps when the manager delegates it to the dev agent
