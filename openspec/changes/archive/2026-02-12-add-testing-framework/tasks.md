## 1. Project Setup

- [x] 1.1 Create `test/` directory and `test/.gitignore` with entries for `workspace/`, `test-log.jsonl`
- [x] 1.2 Add `"test": "tsx test/run-tests.ts"` script to `package.json`
- [x] 1.3 Create empty `test/benchmarks.json` file with `{}` content (committed to repo)

## 2. Test Runner Core

- [x] 2.1 Create `test/run-tests.ts` with the main entry point, OpenCode availability check (exit with error if `opencode` not in PATH), and sequential test executor loop
- [x] 2.2 Implement workspace management: create `test/workspace/` on startup, clean stale contents if present, delete workspace on completion (both success and failure paths)
- [x] 2.3 Implement the `runCommand` utility function that executes `opencode run --command <name> [args] --format json` via `child_process.spawn` in the workspace directory, captures stdout and exit code, and enforces a configurable timeout (default 5 minutes)
- [x] 2.4 Implement the accuracy validation system: define a `Check` type (file existence, directory existence, file content match, CSV column check, CSV row count), run checks against the workspace, and return accuracy as `M/N` ratio
- [x] 2.5 Implement the test result summary printer: table format with test name, pass/fail, accuracy ratio, duration, and benchmark status columns; exit code 0 if all pass, non-zero otherwise

## 3. Benchmark System

- [x] 3.1 Implement benchmark file I/O: read `test/benchmarks.json` on startup, write updates after each test; create file if missing
- [x] 3.2 Implement performance timing: wrap each test execution with `performance.now()` calls to capture wall-clock duration in milliseconds
- [x] 3.3 Implement benchmark comparison logic with 10% default tolerance constant: detect faster (update benchmark), within tolerance (no action), beyond tolerance (warn with delta), and new baseline scenarios
- [x] 3.4 Integrate benchmark status indicators into the test summary output: NEW, FASTER, OK, SLOW labels with deltas; add footer line for regression count when regressions detected

## 4. Test Log

- [x] 4.1 Implement JSONL log appender: append one JSON line per test to `test/test-log.jsonl` with fields `timestamp`, `test`, `pass`, `accuracy`, `durationMs`, `benchmarkMs` (null if no prior benchmark)
- [x] 4.2 Create log file on first write if it does not exist

## 5. CLI Init Test

- [x] 5.1 Implement the `init` test: execute `pnpm build` to compile current source, then run `node <project-root>/bin/nightshift.js init` in the workspace directory
- [x] 5.2 Define the init test artifact checklist: 3 directory checks (`.nightshift/archive/`, `.opencode/agent/`, `.opencode/command/`), 3 agent file checks (`nightshift-manager.md`, `nightshift-dev.md`, `nightshift-qa.md`), 6 command file checks (`nightshift-create.md`, `nightshift-add-task.md`, `nightshift-update-table.md`, `nightshift-start.md`, `nightshift-test-task.md`, `nightshift-archive.md`)

## 6. Nightshift Command Tests

- [x] 6.1 Implement the `nightshift-create` test: run `opencode run --command nightshift-create <test-shift-name> --format json` in the workspace; validate `manager.md` exists with `## Shift Configuration`, `## Task Order`, `## Progress` sections; validate `table.csv` exists with `row` column header
- [x] 6.2 Implement the `nightshift-add-task` test: run `opencode run --command nightshift-add-task <test-shift-name> --format json` with a task description message; validate a task `.md` file exists in the shift directory; validate `table.csv` header includes the new task column; validate `manager.md` `## Task Order` section lists the task
- [x] 6.3 Implement the `nightshift-update-table` test: run `opencode run --command nightshift-update-table <test-shift-name> --format json` with a message to add rows; validate `table.csv` contains the expected number of data rows; validate new rows have `todo` in task status columns
- [x] 6.4 Implement the `nightshift-start` test: run `opencode run --command nightshift-start <test-shift-name> --format json`; validate `table.csv` contains at least one row where a task status is no longer `todo`
- [x] 6.5 Implement the `nightshift-test-task` test: capture `table.csv` contents before execution; run `opencode run --command nightshift-test-task <test-shift-name> --format json`; validate `table.csv` contents are identical to the pre-execution snapshot
- [x] 6.6 Implement the `nightshift-archive` test: run `opencode run --command nightshift-archive <test-shift-name> --format json`; validate the shift directory no longer exists at `.nightshift/<shift-name>/`; validate a date-prefixed directory exists under `.nightshift/archive/` matching `YYYY-MM-DD-<shift-name>`; validate archived directory contains `manager.md`, `table.csv`, and task files

## 7. Integration and Verification

- [x] 7.1 Wire all tests into the sequential executor in the defined order: init, nightshift-create, nightshift-add-task, nightshift-update-table, nightshift-start, nightshift-test-task, nightshift-archive
- [x] 7.2 Run the full test suite with `pnpm test` and verify: all tests execute sequentially, accuracy is reported per test, benchmarks are established on first run, test log is populated, workspace is cleaned up, and the summary prints correctly
- [x] 7.3 Run the suite a second time and verify: benchmark comparisons work (FASTER/OK/SLOW indicators appear), existing benchmarks are compared against, and the test log accumulates entries
