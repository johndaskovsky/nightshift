# test-runner Specification

## Purpose
Defines the test runner: entry points, workspace isolation, command execution, accuracy tracking, benchmarks, log persistence, and execution ordering.
## Requirements
### Requirement: Test runner entry points
The system SHALL provide two test entry points: an init/scaffolder suite at `test/init-tests.ts` (no runtime CLI required) and an integration suite at `test/run-tests.ts` (drives shift execution against Claude Code, including spawned `claude -p` dev subprocesses). `pnpm test` SHALL run the init suite first and then the integration suite. Dedicated scripts SHALL exist to run each suite independently: `pnpm test:init`, `pnpm test:integration`.

#### Scenario: Running the full test suite
- **WHEN** the user executes `pnpm test`
- **THEN** the runner SHALL execute the init suite to completion, then the integration suite, and print a summary of results to stdout

#### Scenario: Init suite without any runtime
- **WHEN** the user executes `pnpm test:init` in an environment without `claude` installed
- **THEN** the init suite SHALL complete successfully (the init suite does NOT depend on any runtime CLI)

#### Scenario: Integration suite without Claude
- **WHEN** the user executes `pnpm test:integration` and `claude` is not on PATH
- **THEN** the runner SHALL print an error stating Claude Code is not installed and exit with a non-zero status without running any tests

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
The integration suite SHALL include an init test that validates the `nightshift init` command by running it against the locally-built CLI from the project's `dist/` directory rather than the published npm package.

#### Scenario: Build before init test
- **WHEN** the init test begins execution
- **THEN** the runner SHALL execute `pnpm build` to compile the current TypeScript source to `dist/` before invoking the CLI

#### Scenario: Init scaffolds Claude runtime tree
- **WHEN** the init test runs `nightshift init` in the workspace directory using the local build
- **THEN** the following directories SHALL exist in the workspace: `.nightshift/archive/`, `.claude/agents/`, `.claude/skills/`

#### Scenario: Init scaffolds expected Claude files
- **WHEN** the init test runs `nightshift init` in the workspace directory
- **THEN** the following files SHALL exist: `.claude/agents/nightshift-manager.md`, `.claude/skills/nightshift-start/SKILL.md`, `.claude/skills/nightshift-start/scripts/dispatch-batch.sh`, `.claude/skills/nightshift-do-task/SKILL.md`, `.claude/settings.json`, and `CLAUDE.md`

#### Scenario: Init does NOT scaffold dev subagent
- **WHEN** the init test runs `nightshift init` in the workspace directory
- **THEN** `.claude/agents/nightshift-dev.md` SHALL NOT exist (whether or not a stale copy was pre-seeded — see installer spec for cleanup behavior)

### Requirement: Nightshift-start command test
The system SHALL include a test that validates the `nightshift-start` command initiates shift execution by delegating to the manager agent.

#### Scenario: Start command processes items
- **WHEN** the runner executes `nightshift-start` on a shift with tasks and rows
- **THEN** `table.csv` SHALL contain at least one row where a task status column has a value other than `todo` (indicating processing occurred)

### Requirement: Nightshift-start-parallel command test
The system SHALL include a test that validates the `nightshift-start` command initiates shift execution in parallel mode with configurable batch sizing.

#### Scenario: Start command processes items in parallel mode
- **WHEN** the runner executes `nightshift-start` on a shift with `parallel: true`, `current-batch-size: 3`, and `max-batch-size: 3` in the Shift Configuration section, and the shift has tasks and rows
- **THEN** `table.csv` SHALL contain at least one row where a task status column has a value other than `todo` (indicating processing occurred)

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
The system SHALL execute tests in a fixed sequential order that respects dependencies between commands: `init`, `nightshift-start`, `nightshift-start-parallel`, `nightshift-start-no-self-improvement`, `nightshift-start-parallel-no-self-improvement`.

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

### Requirement: Command execution under Claude Code
For each integration test, the integration runner SHALL invoke the Nightshift skill using the Claude Code CLI and SHALL capture stdout and the exit code for validation.

#### Scenario: Claude invocation
- **WHEN** the runner executes an integration test
- **THEN** the runner SHALL invoke `claude -p "/<skill-name> <shift-name>" --output-format json --dangerously-skip-permissions` in the workspace directory with the environment variable `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` so that `context: fork` skills block the print-mode session until the manager subagent finishes

#### Scenario: Command execution timeout
- **WHEN** a command execution exceeds a configurable timeout (default: 5 minutes)
- **THEN** the runner SHALL kill the process, record the test as failed with reason "timeout", and proceed to the next test

### Requirement: Per-item subprocess log assertions
The integration runner SHALL assert that each dev subprocess produces a stream-json log file at `.nightshift/<shift>/logs/<item-id>-<task>-<timestamp>.jsonl` after a shift test completes.

#### Scenario: Per-item logs exist after shift test
- **WHEN** the integration runner executes a shift test with 3 items in the table
- **THEN** the workspace SHALL contain at least 3 `.jsonl` log files under `.nightshift/<shift>/logs/` (one per item; retries produce additional files)

#### Scenario: Log files contain a result event
- **WHEN** a `.jsonl` log file exists for a completed dev subprocess
- **THEN** the file SHALL contain at least one JSON object with `"type": "result"`

### Requirement: Auto-mode escape hatch for test environments
The integration runner SHALL accept a `NIGHTSHIFT_TEST_NO_AUTO_MODE` environment variable (or equivalent CLI flag) that forces dev subprocesses to use `--permission-mode bypassPermissions` instead of `--permission-mode auto`. When set, the runner SHALL pass this preference through to the manager's invocation so subprocesses bypass the auto-mode probe.

#### Scenario: Escape hatch on environments without auto mode
- **WHEN** the integration runner is executed with `NIGHTSHIFT_TEST_NO_AUTO_MODE=1`
- **THEN** every dev subprocess invocation SHALL use `--permission-mode bypassPermissions`, no auto-mode probe SHALL be performed, and the runner SHALL print a one-line notice in its output

#### Scenario: Default behavior probes for auto mode
- **WHEN** the integration runner is executed without the escape hatch
- **THEN** the manager (running under the test) SHALL perform its standard auto-mode probe and use `auto` if available, falling back to `bypassPermissions` if not

