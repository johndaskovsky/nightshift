## MODIFIED Requirements

### Requirement: Start shift command
The system SHALL provide a `/nightshift-start` command that begins or resumes execution of a shift by invoking the manager agent. The command SHALL perform a pre-flight check for qsv and flock availability. The command SHALL operate as a supervisor that invokes the manager and handles compaction recovery, but SHALL NOT gate the manager between batches.

#### Scenario: Start a new shift
- **WHEN** user runs `/nightshift-start my-batch-job` and all table statuses are `todo`
- **THEN** the system SHALL invoke the nightshift-manager agent to begin processing all remaining items autonomously

#### Scenario: Resume an interrupted shift
- **WHEN** user runs `/nightshift-start my-batch-job` and the table contains a mix of `done`, `todo`, and `failed` statuses
- **THEN** the system SHALL invoke the nightshift-manager agent, which SHALL skip `done` items and process remaining `todo` and `qa` items autonomously

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
- **WHEN** the manager returns without reporting compaction
- **THEN** the supervisor SHALL parse the final counts from the manager's completion output and proceed to the final report

#### Scenario: Supervisor handles compaction
- **WHEN** the manager returns with `Compacted: true` in its output
- **THEN** the supervisor SHALL discard the current manager session and start a fresh manager invocation to continue the shift

#### Scenario: Supervisor does not gate batches
- **WHEN** the manager is processing batches within a single session
- **THEN** the supervisor SHALL NOT intervene, re-invoke, or run termination checks between batches

#### Scenario: Supervisor reads progress from manager output
- **WHEN** the supervisor needs to determine final shift status after the manager returns
- **THEN** it SHALL parse the final counts from the manager's completion output instead of reading `manager.md` or running independent `qsv search` commands against `table.csv`
