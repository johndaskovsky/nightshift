## ADDED Requirements

### Requirement: Nightshift-start-no-self-improvement command test
The system SHALL include a test that validates the `nightshift-start` command with `disable-self-improvement: true` set in the Shift Configuration section of `manager.md`, confirming that shift execution completes correctly when self-improvement is disabled.

#### Scenario: Start command processes items with self-improvement disabled (serial)
- **WHEN** the runner executes `nightshift-start` on a shift with `disable-self-improvement: true` in the Shift Configuration section and the shift has tasks and rows
- **THEN** the expected output files SHALL be created for each item (confirming execution succeeded) and `table.csv` SHALL contain rows with `done` status

### Requirement: Nightshift-start-parallel-no-self-improvement command test
The system SHALL include a test that validates the `nightshift-start` command in parallel mode with `disable-self-improvement: true` set in the Shift Configuration section of `manager.md`.

#### Scenario: Start command processes items in parallel mode with self-improvement disabled
- **WHEN** the runner executes `nightshift-start` on a shift with `parallel: true`, `current-batch-size: 3`, `max-batch-size: 3`, and `disable-self-improvement: true` in the Shift Configuration section, and the shift has tasks and rows
- **THEN** the expected output files SHALL be created for each item (confirming execution succeeded) and `table.csv` SHALL contain rows with `done` status

## MODIFIED Requirements

### Requirement: Test execution order
The system SHALL execute tests in a fixed sequential order that respects dependencies between commands: `init`, `nightshift-start`, `nightshift-start-parallel`, `nightshift-start-no-self-improvement`, `nightshift-start-parallel-no-self-improvement`.

#### Scenario: Sequential execution
- **WHEN** the test runner starts
- **THEN** tests SHALL execute in the defined order, with each test starting only after the previous test completes

#### Scenario: Continuing after failure
- **WHEN** a test fails
- **THEN** the runner SHALL continue executing subsequent tests rather than aborting the suite
