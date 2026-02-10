## ADDED Requirements

### Requirement: Task file section mutability rules
The system SHALL enforce mutability rules for task file sections during dev agent execution. The Steps section SHALL be mutable by the dev agent. The Configuration and Validation sections SHALL be immutable — the dev agent SHALL NOT modify them.

#### Scenario: Dev modifies Steps section
- **WHEN** the dev agent completes execution of task steps on an item
- **THEN** the dev agent SHALL be permitted to update the Steps section of the task file with refined instructions based on execution feedback

#### Scenario: Dev cannot modify Validation section
- **WHEN** the dev agent attempts to modify the Validation section of a task file
- **THEN** the system SHALL prevent the modification — the Validation section SHALL remain unchanged from its authored state

#### Scenario: Dev cannot modify Configuration section
- **WHEN** the dev agent attempts to modify the Configuration section of a task file
- **THEN** the system SHALL prevent the modification — the Configuration section SHALL remain unchanged from its authored state

## MODIFIED Requirements

### Requirement: Task steps section
The Steps section SHALL contain numbered instructions that the dev agent follows to execute the task on a single table item. Steps SHALL be detailed enough for unsupervised execution. The dev agent SHALL be permitted to refine steps after execution based on what it learned, improving quality for subsequent items.

#### Scenario: Steps reference table metadata
- **WHEN** steps reference item data using `{column_name}` placeholders
- **THEN** the dev agent SHALL substitute the actual values from the current table row before execution

#### Scenario: Steps include error handling
- **WHEN** steps include conditional branches (e.g., "If X fails, then Y")
- **THEN** the dev agent SHALL follow the conditional logic during execution

#### Scenario: Dev refines steps after execution
- **WHEN** the dev agent completes executing steps on an item and identifies improvements (e.g., missing error handling, incorrect assumptions, ambiguous instructions)
- **THEN** the dev agent SHALL update the Steps section in the task file with the refined instructions before proceeding to self-validation

#### Scenario: Step refinements persist for subsequent items
- **WHEN** the dev agent refines steps during execution of item N
- **THEN** item N+1 SHALL receive the refined steps when the manager delegates it to the dev agent
