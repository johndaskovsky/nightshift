## MODIFIED Requirements

### Requirement: Start shift command
The system SHALL provide a `/nightshift-start` command that begins or resumes execution of a shift by invoking the manager agent. The command SHALL perform a pre-flight check for qsv and flock availability. The command SHALL invoke the manager once and read its completion output for the final report.

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

#### Scenario: Pre-flight qsv check passes
- **WHEN** `/nightshift-start` runs pre-flight checks and `qsv --version` succeeds
- **THEN** the system SHALL include the qsv version in the pre-flight summary and proceed normally

#### Scenario: Pre-flight qsv check fails
- **WHEN** `/nightshift-start` runs pre-flight checks and `qsv --version` fails (command not found)
- **THEN** the system SHALL display an error that qsv is not installed, recommend `brew install qsv`, and STOP

#### Scenario: Pre-flight flock check fails
- **WHEN** `/nightshift-start` runs pre-flight checks and `flock --version` fails (command not found)
- **THEN** the system SHALL display an error that flock is not installed, recommend `brew install flock`, and STOP

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

### Requirement: Test task command
The system SHALL provide a `/nightshift-test-task` command that executes a single task on a single table row for testing without modifying table state. Row data SHALL be read using `qsv slice` and `qsv select`.

#### Scenario: Test specific task and row
- **WHEN** user runs `/nightshift-test-task my-batch-job` and specifies task "create_page" and row 3
- **THEN** the system SHALL extract row 3's data using `qsv slice --index 2 table.csv`, execute the task steps, run self-validation, and display the full results without updating table.csv

#### Scenario: Test prompts for task and row
- **WHEN** user runs `/nightshift-test-task my-batch-job` without specifying task or row
- **THEN** the system SHALL use `qsv headers --just-names` to list available task columns and prompt for task selection, then use `qsv count` to determine valid row range and prompt for row number

#### Scenario: Test reports detailed results
- **WHEN** a test-task execution completes
- **THEN** the system SHALL display: each step's outcome (pass/fail), any captured values, each validation criterion result, and an overall pass/fail summary

## REMOVED Requirements

### Requirement: Supervisor handles compaction
**Reason**: Compaction detection was an unreliable self-check. The existing resume logic via `table.csv` state handles interrupted sessions when the user re-runs `/nightshift-start`.
**Migration**: The supervisor invokes the manager once. If the session errors, the user re-runs the command.
