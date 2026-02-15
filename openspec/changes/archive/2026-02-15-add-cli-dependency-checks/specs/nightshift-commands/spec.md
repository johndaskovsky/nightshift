## MODIFIED Requirements

### Requirement: Start shift command
The system SHALL provide a `/nightshift-start` command that begins or resumes execution of a shift by invoking the manager agent. The command SHALL invoke the manager once and read its completion output for the final report.

#### Scenario: Start a new shift
- **WHEN** user runs `/nightshift-start my-batch-job` and all table statuses are `todo`
- **THEN** the system SHALL invoke the nightshift-manager agent to begin processing all remaining items autonomously

#### Scenario: Resume an interrupted shift
- **WHEN** user runs `/nightshift-start my-batch-job` and the table contains a mix of `done`, `todo`, and `failed` statuses
- **THEN** the system SHALL invoke the nightshift-manager agent, which SHALL skip `done` items and process remaining `todo` items autonomously

#### Scenario: Start without shift name prompts selection
- **WHEN** user runs `/nightshift-start` without a name and multiple active shifts exist
- **THEN** the system SHALL list available shifts and prompt the user to select one

#### Scenario: All items complete
- **WHEN** user runs `/nightshift-start my-batch-job` and all item-task statuses are `done`
- **THEN** the system SHALL report that the shift is complete and suggest archiving with `/nightshift-archive`

#### Scenario: Pre-flight reads table status with qsv
- **WHEN** `/nightshift-start` performs pre-flight checks and qsv is available
- **THEN** it SHALL use `qsv count`, `qsv search`, and `qsv table` to read and display the table summary instead of reading the full file with the Read tool

#### Scenario: Supervisor handles manager completion
- **WHEN** the manager returns its completion output
- **THEN** the supervisor SHALL parse the final counts from the manager's completion output and proceed to the final report

#### Scenario: Supervisor does not gate batches
- **WHEN** the manager is processing batches within a single session
- **THEN** the supervisor SHALL NOT intervene, re-invoke, or run termination checks between batches

#### Scenario: Supervisor reads progress from manager output
- **WHEN** the supervisor needs to determine final shift status after the manager returns
- **THEN** it SHALL parse the final counts from the manager's completion output

## REMOVED Requirements

### Requirement: Pre-flight qsv check passes
**Reason**: Dependency verification has moved to the CLI installer (`nightshift init` and `nightshift update`). The start command no longer performs pre-flight dependency checks.
**Migration**: Users are warned about missing dependencies during `nightshift init` and `nightshift update`. System-level errors will surface if dependencies are missing at execution time.

### Requirement: Pre-flight qsv check fails
**Reason**: Dependency verification has moved to the CLI installer (`nightshift init` and `nightshift update`). The start command no longer performs pre-flight dependency checks.
**Migration**: Users are warned about missing dependencies during `nightshift init` and `nightshift update`.

### Requirement: Pre-flight flock check fails
**Reason**: Dependency verification has moved to the CLI installer (`nightshift init` and `nightshift update`). The start command no longer performs pre-flight dependency checks.
**Migration**: Users are warned about missing dependencies during `nightshift init` and `nightshift update`.
