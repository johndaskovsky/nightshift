## ADDED Requirements

### Requirement: Task file format
The system SHALL define tasks as Markdown files with three mandatory sections: Configuration, Steps, and Validation. Each task file SHALL be named `<task_name>.md` in snake_case (no hyphens — hyphens conflict with qsv column selectors).

#### Scenario: Valid task file structure
- **WHEN** a task file is read
- **THEN** it SHALL contain a `## Configuration` section, a `## Steps` section, and a `## Validation` section in that order

#### Scenario: Missing section rejected
- **WHEN** a task file is missing any of the three mandatory sections
- **THEN** the system SHALL report an error identifying the missing section

### Requirement: Task configuration section
The Configuration section SHALL declare the tools and optional model suggestion needed to execute the task.

#### Scenario: Tools declaration
- **WHEN** a task configuration lists `tools: playwright, google_workspace`
- **THEN** the executing agent SHALL have access to the Playwright and Google Workspace MCP tools

#### Scenario: Model suggestion
- **WHEN** a task configuration includes `model: claude-sonnet`
- **THEN** the system SHALL treat this as a suggestion (not enforced) and note it in the task context provided to the executing agent

#### Scenario: No tools declared
- **WHEN** a task configuration has no tools listed
- **THEN** the executing agent SHALL have access to default tools only (read, write, edit, glob, grep)

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

### Requirement: Task validation section
The Validation section SHALL describe criteria the QA agent uses to verify task completion on a single item. Each criterion SHALL be independently verifiable.

#### Scenario: Validation criteria format
- **WHEN** a validation section is read
- **THEN** it SHALL contain one or more checkable criteria as a bulleted list, each describing an observable outcome

#### Scenario: QA uses validation criteria
- **WHEN** the QA agent verifies a task on an item
- **THEN** it SHALL check each validation criterion independently and report pass/fail per criterion

#### Scenario: All criteria must pass
- **WHEN** the QA agent evaluates validation criteria for an item-task
- **THEN** the item-task SHALL be marked `done` only if ALL criteria pass, otherwise it SHALL be marked `failed`

### Requirement: Task test execution
The system SHALL support running a single task on a single table item for testing purposes, without affecting other items or tasks in the shift.

#### Scenario: Test a task on one row
- **WHEN** a user invokes test-task for task "create_page" on row 5
- **THEN** the system SHALL execute the task steps on row 5 only, run QA validation, and report the result without updating the table status

#### Scenario: Test preserves table state
- **WHEN** a test-task execution completes
- **THEN** the table.csv SHALL NOT be modified (status columns remain unchanged)

### Requirement: Task execution produces observable output
The dev agent SHALL report the results of each step execution so that the QA agent and manager have visibility into what was done.

#### Scenario: Dev reports step results
- **WHEN** the dev agent completes executing steps for an item
- **THEN** it SHALL return a structured summary including: which steps succeeded, which failed, any captured values (e.g., URLs, IDs), and any error messages

#### Scenario: Failed step halts execution
- **WHEN** a step fails during execution
- **THEN** the dev agent SHALL stop executing remaining steps for that item and report the failure with the step number and error details

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
