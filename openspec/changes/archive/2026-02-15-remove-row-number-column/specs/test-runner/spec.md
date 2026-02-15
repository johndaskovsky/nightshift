## MODIFIED Requirements

### Requirement: Nightshift-create command test
The system SHALL include a test that validates the `nightshift-create` command produces the expected shift structure.

#### Scenario: Create command produces shift files
- **WHEN** the runner executes `nightshift-create` with a test shift name in an initialized workspace
- **THEN** the following artifacts SHALL exist: `.nightshift/<shift-name>/manager.md`, `.nightshift/<shift-name>/table.csv`

#### Scenario: Create command manager file structure
- **WHEN** the runner validates the created `manager.md`
- **THEN** the file SHALL contain the sections `## Shift Configuration` and `## Task Order`

#### Scenario: Create command table structure
- **WHEN** the runner validates the created `table.csv`
- **THEN** the file SHALL contain a header row with no pre-defined columns (columns are added when tasks are defined)
