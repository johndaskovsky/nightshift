## MODIFIED Requirements

### Requirement: Start shift command
The system SHALL provide a `/nightshift-start` command that begins or resumes execution of a shift by invoking the manager agent. The command SHALL perform a pre-flight check for both `qsv` and `flock` availability and SHALL NOT proceed if either is missing. The command SHALL operate as a supervisor loop that monitors the manager for progress reports and compaction, restarting the manager subagent when context compaction is detected.

#### Scenario: Start a new shift
- **WHEN** user runs `/nightshift-start my-batch-job` and all table statuses are `todo`
- **THEN** the system SHALL invoke the nightshift-manager agent to begin processing items from the first row and first task

#### Scenario: Resume an interrupted shift
- **WHEN** user runs `/nightshift-start my-batch-job` and the table contains a mix of `done`, `todo`, and `failed` statuses
- **THEN** the system SHALL invoke the nightshift-manager agent, which SHALL skip `done` items and process remaining `todo` items

#### Scenario: Start without shift name prompts selection
- **WHEN** user runs `/nightshift-start` without a name and multiple active shifts exist
- **THEN** the system SHALL list available shifts and prompt the user to select one

#### Scenario: All items complete
- **WHEN** user runs `/nightshift-start my-batch-job` and all item-task statuses are `done`
- **THEN** the system SHALL report that the shift is complete and suggest archiving with `/nightshift-archive`

#### Scenario: Pre-flight qsv check fails
- **WHEN** `/nightshift-start` runs pre-flight checks and `qsv --version` fails (command not found)
- **THEN** the system SHALL display an error that qsv is required, recommend `brew install qsv`, and SHALL NOT proceed with shift execution

#### Scenario: Pre-flight flock check fails
- **WHEN** `/nightshift-start` runs pre-flight checks and `flock --version` fails (command not found)
- **THEN** the system SHALL display an error that flock is required, recommend `brew install flock`, and SHALL NOT proceed with shift execution

#### Scenario: Pre-flight both dependencies pass
- **WHEN** `/nightshift-start` runs pre-flight checks and both `qsv --version` and `flock --version` succeed
- **THEN** the system SHALL include both versions in the pre-flight summary and proceed normally

#### Scenario: Pre-flight reads table status with qsv
- **WHEN** `/nightshift-start` performs pre-flight checks and qsv is available
- **THEN** it SHALL use `flock -x <table_path> qsv count`, `flock -x <table_path> qsv search`, and `flock -x <table_path> qsv table` to read and display the table summary

#### Scenario: Manager progress monitoring loop
- **WHEN** the manager agent returns with a progress report after processing a batch
- **THEN** the `nightshift-start` command thread SHALL parse the progress report, display `Progress: M/N` to the user, and re-invoke the manager to continue processing if items remain

#### Scenario: Compaction detected triggers manager restart
- **WHEN** the manager agent returns with `Compacted: true` in its progress report
- **THEN** the `nightshift-start` command thread SHALL discard the current manager session and start a fresh manager subagent invocation to continue the shift

#### Scenario: No compaction continues same session
- **WHEN** the manager agent returns with `Compacted: false` in its progress report and items remain
- **THEN** the `nightshift-start` command thread SHALL re-invoke the same manager session (using `task_id`) to continue processing

#### Scenario: Loop terminates on completion
- **WHEN** the manager agent reports that all items are `done` or `failed` (no `todo` items remain)
- **THEN** the `nightshift-start` command thread SHALL exit the supervisor loop and display the final summary

## REMOVED Requirements

### Requirement: Handle stale statuses on start
**Reason:** The `in_progress` status has been removed from the state machine. Items remain `todo` until a dev agent completes and writes `qa` or `failed`. There are no transient states that can become stale on interruption, so stale-status detection and reset logic is no longer needed.
**Migration:** Remove the pre-flight step that searches for `in_progress` and `qa` statuses to reset. The `qa` status is now a durable state (set by dev, consumed by QA) and SHALL NOT be reset on resume.
