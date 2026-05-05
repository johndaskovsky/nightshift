## ADDED Requirements

### Requirement: Test runner entry points
The system SHALL provide two test entry points: an init/scaffolder suite at `test/init-tests.ts` (no runtime CLI required) and an integration suite at `test/run-tests.ts` (drives shift execution against one or more runtimes). `pnpm test` SHALL run the init suite first and then the integration suite. Dedicated scripts SHALL exist to run each suite independently or to filter the integration suite by runtime: `pnpm test:init`, `pnpm test:integration`, `pnpm test:integration:opencode`, `pnpm test:integration:claude`, `pnpm test:integration:both`.

#### Scenario: Running the full test suite
- **WHEN** the user executes `pnpm test`
- **THEN** the runner SHALL execute the init suite to completion, then the integration suite, and print a summary of results to stdout

#### Scenario: Init suite without any runtime
- **WHEN** the user executes `pnpm test:init` in an environment with neither `opencode` nor `claude` installed
- **THEN** the init suite SHALL complete successfully (the init suite does NOT depend on any runtime CLI)

### Requirement: Integration runner runtime selection
The integration runner (`test/run-tests.ts`) SHALL accept a `--runtime=<opencode|claude|both>` CLI argument and a `NIGHTSHIFT_TEST_RUNTIMES` environment variable to select which runtimes are exercised. When neither is provided, the runner SHALL auto-detect by inspecting which runtime CLIs are on PATH.

#### Scenario: Explicit runtime selection
- **WHEN** the user executes `pnpm test:integration --runtime=claude`
- **THEN** the runner SHALL run only the Claude variants of the per-runtime tests

#### Scenario: Both runtimes selected
- **WHEN** the user executes `pnpm test:integration --runtime=both`
- **THEN** the runner SHALL run every per-runtime test once for OpenCode and once for Claude, in that order

#### Scenario: Auto-detect with both CLIs available
- **WHEN** the user executes `pnpm test:integration` with both `opencode` and `claude` on PATH
- **THEN** the runner SHALL run every per-runtime test against both runtimes

#### Scenario: Auto-detect with only one CLI available
- **WHEN** the user executes `pnpm test:integration` with only `opencode` on PATH
- **THEN** the runner SHALL run every per-runtime test against OpenCode only and SHALL NOT error

#### Scenario: Requested runtime not available
- **WHEN** the user requests a runtime via `--runtime=claude` but `claude` is not on PATH
- **THEN** the runner SHALL print an error and exit with a non-zero status without running any tests

#### Scenario: No runtimes available
- **WHEN** the user invokes `pnpm test:integration` and neither `opencode` nor `claude` is on PATH
- **THEN** the runner SHALL print an error and exit with a non-zero status

### Requirement: Runtime-agnostic test definitions
Each test in the integration runner SHALL define its fixtures and accuracy checks in a runtime-agnostic form. The runner SHALL execute the same test definition once per selected runtime, suffixing the displayed name and benchmark key with the runtime (e.g. `nightshift-start [claude]`, benchmark key `nightshift-start.claude`).

#### Scenario: Per-runtime benchmark keys
- **WHEN** the runner executes `nightshift-start` against both OpenCode and Claude
- **THEN** the benchmarks file SHALL contain separate entries `nightshift-start.opencode` and `nightshift-start.claude` so each runtime's performance is tracked independently

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
The integration suite SHALL include an init test that validates the `nightshift init` command by running it against the locally-built CLI from the project's `dist/` directory rather than the published npm package, using `--target=both` so subsequent per-runtime tests have access to whichever runtime is selected.

#### Scenario: Build before init test
- **WHEN** the init test begins execution
- **THEN** the runner SHALL execute `pnpm build` to compile the current TypeScript source to `dist/` before invoking the CLI

#### Scenario: Init scaffolds both runtime trees
- **WHEN** the init test runs `nightshift init --target=both` in the workspace directory using the local build
- **THEN** the following directories SHALL exist in the workspace: `.nightshift/archive/`, `.opencode/agents/`, `.opencode/commands/`, `.claude/agents/`, `.claude/skills/`

#### Scenario: Init scaffolds expected OpenCode files
- **WHEN** the init test runs `nightshift init --target=both` in the workspace directory
- **THEN** the following files SHALL exist: `.opencode/agents/nightshift-manager.md`, `.opencode/agents/nightshift-dev.md`, and one `.opencode/commands/nightshift-*.md` per Nightshift command

#### Scenario: Init scaffolds expected Claude files
- **WHEN** the init test runs `nightshift init --target=both` in the workspace directory
- **THEN** the following files SHALL exist: `.claude/agents/nightshift-manager.md`, `.claude/agents/nightshift-dev.md`, `.claude/skills/nightshift-start/SKILL.md`, `.claude/settings.json`, and `CLAUDE.md`

### Requirement: Per-runtime command execution
For each per-runtime test, the integration runner SHALL invoke the Nightshift slash command using the selected runtime's CLI and shall capture stdout and the exit code for validation.

#### Scenario: OpenCode invocation
- **WHEN** the runner executes a per-runtime test against OpenCode
- **THEN** the runner SHALL invoke `opencode run --command <skill-name> "<shift-name> -- <message>" --format json` in the workspace directory

#### Scenario: Claude invocation
- **WHEN** the runner executes a per-runtime test against Claude Code
- **THEN** the runner SHALL invoke `claude -p "/<skill-name> <shift-name>" --output-format json --dangerously-skip-permissions` in the workspace directory with the environment variable `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` so that `context: fork` skills block the print-mode session until the manager subagent finishes

#### Scenario: Command execution timeout
- **WHEN** a command execution exceeds a configurable timeout (default: 5 minutes)
- **THEN** the runner SHALL kill the process, record the test as failed with reason "timeout", and proceed to the next test

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
