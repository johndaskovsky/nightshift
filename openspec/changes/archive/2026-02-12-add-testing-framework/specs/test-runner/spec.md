## ADDED Requirements

### Requirement: Test runner entry point
The system SHALL provide a test runner script at `test/run-tests.ts` that serves as the single entry point for executing all tests. The runner SHALL be invocable via `pnpm test`, which SHALL execute `tsx test/run-tests.ts`.

#### Scenario: Running the full test suite
- **WHEN** the user executes `pnpm test`
- **THEN** the runner SHALL execute all defined tests sequentially and print a summary of results to stdout

#### Scenario: OpenCode not available
- **WHEN** the runner starts and `opencode` is not found in the system PATH
- **THEN** the runner SHALL print an error message stating that OpenCode is required and exit with a non-zero exit code without running any tests

### Requirement: Test workspace isolation
The system SHALL create a temporary workspace directory under `test/workspace/` for each test suite run. All command executions and artifact generation SHALL occur within this workspace directory. The `test/workspace/` directory SHALL be listed in `test/.gitignore`.

#### Scenario: Workspace creation
- **WHEN** the test runner starts a test suite run
- **THEN** the runner SHALL create a workspace directory at `test/workspace/` if it does not already exist

#### Scenario: Stale workspace cleanup on startup
- **WHEN** the test runner starts and `test/workspace/` contains directories from a previous run
- **THEN** the runner SHALL delete all contents of `test/workspace/` before proceeding

### Requirement: Test artifact cleanup
The system SHALL remove all generated artifacts from the workspace directory after each test suite run completes, regardless of whether the tests passed or failed.

#### Scenario: Cleanup after successful run
- **WHEN** all tests in a suite run complete successfully
- **THEN** the runner SHALL delete the workspace directory and all its contents

#### Scenario: Cleanup after failed run
- **WHEN** one or more tests in a suite run fail
- **THEN** the runner SHALL still delete the workspace directory and all its contents

### Requirement: CLI init test using local build
The system SHALL include a test that validates the `nightshift init` command by running it against the locally-built CLI from the project's `dist/` directory rather than the published npm package.

#### Scenario: Build before init test
- **WHEN** the init test begins execution
- **THEN** the runner SHALL execute `pnpm build` to compile the current TypeScript source to `dist/` before invoking the CLI

#### Scenario: Init scaffolds expected directories
- **WHEN** the init test runs `nightshift init` in the workspace directory using the local build
- **THEN** the following directories SHALL exist in the workspace: `.nightshift/archive/`, `.opencode/agent/`, `.opencode/command/`

#### Scenario: Init scaffolds expected agent files
- **WHEN** the init test runs `nightshift init` in the workspace directory
- **THEN** the following files SHALL exist: `.opencode/agent/nightshift-manager.md`, `.opencode/agent/nightshift-dev.md`, `.opencode/agent/nightshift-qa.md`

#### Scenario: Init scaffolds expected command files
- **WHEN** the init test runs `nightshift init` in the workspace directory
- **THEN** the following files SHALL exist: `.opencode/command/nightshift-create.md`, `.opencode/command/nightshift-add-task.md`, `.opencode/command/nightshift-update-table.md`, `.opencode/command/nightshift-start.md`, `.opencode/command/nightshift-test-task.md`, `.opencode/command/nightshift-archive.md`

### Requirement: Command execution via opencode run
The system SHALL execute each nightshift command under test using `opencode run --command <command-name> [args] --format json`. The runner SHALL capture the JSON output and the process exit code for validation.

#### Scenario: Executing a command test
- **WHEN** the runner executes a command test (e.g., `nightshift-create`)
- **THEN** the runner SHALL invoke `opencode run --command nightshift-create <args> --format json` in the workspace directory and capture both stdout and the exit code

#### Scenario: Command execution timeout
- **WHEN** a command execution exceeds a configurable timeout (default: 5 minutes)
- **THEN** the runner SHALL kill the process, record the test as failed with reason "timeout", and proceed to the next test

### Requirement: Nightshift-create command test
The system SHALL include a test that validates the `nightshift-create` command produces the expected shift structure.

#### Scenario: Create command produces shift files
- **WHEN** the runner executes `nightshift-create` with a test shift name in an initialized workspace
- **THEN** the following artifacts SHALL exist: `.nightshift/<shift-name>/manager.md`, `.nightshift/<shift-name>/table.csv`

#### Scenario: Create command manager file structure
- **WHEN** the runner validates the created `manager.md`
- **THEN** the file SHALL contain the sections `## Shift Configuration`, `## Task Order`, and `## Progress`

#### Scenario: Create command table structure
- **WHEN** the runner validates the created `table.csv`
- **THEN** the file SHALL contain a header row with at minimum the `row` column

### Requirement: Nightshift-add-task command test
The system SHALL include a test that validates the `nightshift-add-task` command adds a task to an existing shift.

#### Scenario: Add-task creates task file
- **WHEN** the runner executes `nightshift-add-task` on an existing shift
- **THEN** a new task `.md` file SHALL exist in the shift directory (`.nightshift/<shift-name>/<task-name>.md`)

#### Scenario: Add-task updates table with status column
- **WHEN** the runner validates `table.csv` after `nightshift-add-task` completes
- **THEN** the CSV header row SHALL include a new column matching the task name

#### Scenario: Add-task updates manager task order
- **WHEN** the runner validates `manager.md` after `nightshift-add-task` completes
- **THEN** the `## Task Order` section SHALL list the new task name

### Requirement: Nightshift-update-table command test
The system SHALL include a test that validates the `nightshift-update-table` command can add rows to a shift table.

#### Scenario: Update-table adds rows
- **WHEN** the runner executes `nightshift-update-table` to add rows to an existing shift
- **THEN** `table.csv` SHALL contain the expected number of data rows (excluding the header row)

#### Scenario: Update-table initializes task statuses
- **WHEN** the runner validates `table.csv` after rows are added
- **THEN** all new rows SHALL have `todo` as the value in each task status column

### Requirement: Nightshift-start command test
The system SHALL include a test that validates the `nightshift-start` command initiates shift execution by delegating to the manager agent.

#### Scenario: Start command processes items
- **WHEN** the runner executes `nightshift-start` on a shift with tasks and rows
- **THEN** `table.csv` SHALL contain at least one row where a task status column has a value other than `todo` (indicating processing occurred)

### Requirement: Nightshift-test-task command test
The system SHALL include a test that validates the `nightshift-test-task` command executes a single task on a single row without modifying state.

#### Scenario: Test-task does not modify table
- **WHEN** the runner captures the contents of `table.csv` before and after executing `nightshift-test-task`
- **THEN** the file contents SHALL be identical

### Requirement: Nightshift-archive command test
The system SHALL include a test that validates the `nightshift-archive` command moves a shift to the archive directory.

#### Scenario: Archive moves shift directory
- **WHEN** the runner executes `nightshift-archive` on an existing shift
- **THEN** the original shift directory (`.nightshift/<shift-name>/`) SHALL no longer exist and a date-prefixed directory SHALL exist under `.nightshift/archive/` (matching the pattern `YYYY-MM-DD-<shift-name>`)

#### Scenario: Archive preserves files
- **WHEN** the runner validates the archived shift directory
- **THEN** the directory SHALL contain `manager.md`, `table.csv`, and any task `.md` files that existed before archiving

### Requirement: Accuracy tracking
The system SHALL track accuracy for each test as the ratio of expected artifacts that were found to the total number of expected artifacts. Each test definition SHALL declare its expected artifact checklist.

#### Scenario: Full accuracy
- **WHEN** all expected artifacts for a test are found after command execution
- **THEN** the accuracy SHALL be reported as `N/N` where N is the total number of expected artifacts, and the test SHALL be marked as passed

#### Scenario: Partial accuracy
- **WHEN** some but not all expected artifacts are found after command execution
- **THEN** the accuracy SHALL be reported as `M/N` where M is the number of found artifacts and N is the total, and the test SHALL be marked as failed

#### Scenario: Accuracy includes multiple validation types
- **WHEN** a test defines expected artifacts that include file existence checks, directory existence checks, and file content checks
- **THEN** each check SHALL be counted independently in the accuracy ratio

### Requirement: Test result summary
The system SHALL print a summary table to stdout after all tests complete. The summary SHALL include each test name, pass/fail status, accuracy ratio, and execution duration.

#### Scenario: All tests pass
- **WHEN** all tests in the suite pass
- **THEN** the runner SHALL exit with code 0 and print a summary showing all tests as passed

#### Scenario: Some tests fail
- **WHEN** one or more tests fail
- **THEN** the runner SHALL exit with a non-zero exit code and print a summary showing which tests failed and their accuracy ratios

### Requirement: Test execution order
The system SHALL execute tests in a fixed sequential order that respects dependencies between commands: `init`, `nightshift-create`, `nightshift-add-task`, `nightshift-update-table`, `nightshift-start`, `nightshift-test-task`, `nightshift-archive`.

#### Scenario: Sequential execution
- **WHEN** the test runner starts
- **THEN** tests SHALL execute in the defined order, with each test starting only after the previous test completes

#### Scenario: Continuing after failure
- **WHEN** a test fails
- **THEN** the runner SHALL continue executing subsequent tests rather than aborting the suite

### Requirement: Test log persistence
The system SHALL append a result record to `test/test-log.jsonl` after each test completes. Each record SHALL be a single JSON object on one line containing the timestamp, test name, pass/fail status, accuracy ratio, and execution duration in milliseconds. The `test/test-log.jsonl` file SHALL be listed in `test/.gitignore`.

#### Scenario: Appending a test result
- **WHEN** a test completes (pass or fail)
- **THEN** the runner SHALL append one JSON line to `test/test-log.jsonl` with fields: `timestamp` (ISO 8601), `test` (test name), `pass` (boolean), `accuracy` (string ratio), `durationMs` (number)

#### Scenario: First run creates log file
- **WHEN** the runner executes for the first time and `test/test-log.jsonl` does not exist
- **THEN** the runner SHALL create the file and append the first result record
