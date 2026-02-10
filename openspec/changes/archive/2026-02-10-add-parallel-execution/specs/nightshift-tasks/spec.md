## MODIFIED Requirements

### Requirement: Task steps section
The Steps section SHALL contain numbered instructions that the dev agent follows to execute the task on a single table item. Steps SHALL be detailed enough for unsupervised execution. The manager agent SHALL apply step improvements to the task file based on dev agent recommendations between items or batches. The dev agent SHALL NOT directly edit the Steps section. Steps MAY reference environment variables using `{ENV:VAR_NAME}` syntax and shift metadata using `{SHIFT:FOLDER}` or `{SHIFT:NAME}` syntax, in addition to table column data using `{column_name}` syntax.

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

#### Scenario: Manager applies step improvements from recommendations
- **WHEN** the manager receives step improvement recommendations from the dev agent
- **THEN** the manager SHALL review, synthesize, and apply a coherent update to the Steps section in the task file before delegating the next item or batch

#### Scenario: Step improvements persist for subsequent items
- **WHEN** the manager applies step improvements after processing item N
- **THEN** item N+1 SHALL receive the improved steps when the manager delegates it to the dev agent

### Requirement: Task file section mutability rules
The system SHALL enforce mutability rules for task file sections. The Steps section SHALL be mutable only by the manager agent (for applying step improvements from dev recommendations). The dev agent SHALL NOT modify any section of the task file. The Configuration and Validation sections SHALL be immutable by all agents during execution.

#### Scenario: Manager modifies Steps section
- **WHEN** the manager agent receives step improvement recommendations from dev agents
- **THEN** the manager SHALL be permitted to update the Steps section of the task file with synthesized improvements

#### Scenario: Dev cannot modify Steps section
- **WHEN** the dev agent identifies step improvements during execution
- **THEN** the dev agent SHALL NOT edit the Steps section of the task file, and SHALL instead report improvements as recommendations in its result output

#### Scenario: Dev cannot modify Validation section
- **WHEN** the dev agent attempts to modify the Validation section of a task file
- **THEN** the system SHALL prevent the modification — the Validation section SHALL remain unchanged from its authored state

#### Scenario: Dev cannot modify Configuration section
- **WHEN** the dev agent attempts to modify the Configuration section of a task file
- **THEN** the system SHALL prevent the modification — the Configuration section SHALL remain unchanged from its authored state
