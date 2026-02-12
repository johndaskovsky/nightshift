## Why

Nightshift has no test infrastructure. The framework consists of Markdown-based agent definitions, OpenCode commands, and a TypeScript CLI installer, but none of these are validated by automated tests. There is no way to verify that commands execute correctly, that the CLI scaffolds the expected artifacts, or to detect performance regressions between changes. As the framework grows, this lack of feedback makes it easy to introduce breakages silently.

## What Changes

- Add a `test/` directory as the dedicated test execution environment, with its own `.gitignore` to exclude generated artifacts
- Add a test runner that executes OpenCode commands via `opencode run --command <command_name>` and validates their output
- Add a test for the `nightshift init` command that runs against locally-built files (via `pnpm build` output in `dist/`) instead of the published npm package, ensuring the CLI scaffolder produces the expected directory structure and files
- Add accuracy tracking that verifies whether each command produces the expected artifacts (files, directories, CSV rows, Markdown sections)
- Add performance tracking that records execution time for each test run and compares it against stored benchmarks
- Add a benchmark store that persists current performance baselines, warns when a test runs slower than its benchmark, and auto-updates the benchmark when a test runs faster
- Add a test log that records historical test results (pass/fail, accuracy, timing) for trend analysis
- Add automatic cleanup that removes all generated artifacts from the test directory after each test completes
- Add a `test` script to `package.json` for running the test suite

## Capabilities

### New Capabilities

- `test-runner`: Core test execution engine that invokes OpenCode commands via `opencode run --command`, manages the test lifecycle (setup, execute, validate, teardown), and reports results with accuracy and pass/fail status
- `test-benchmarks`: Performance tracking system that times test execution, persists benchmark baselines, warns on regressions (slower than current benchmark), and auto-updates benchmarks on improvements (faster than current benchmark)

### Modified Capabilities

_None. No existing spec-level requirements are changing._

## Impact

- **New files**: `test/` directory with test definitions, runner script, benchmark store, test log, and `.gitignore`
- **Modified files**: `package.json` (new `test` script, possible new devDependencies for the test runner)
- **Modified files**: Root `.gitignore` (add `test/` artifact exclusions if needed beyond the nested `.gitignore`)
- **Build dependency**: Tests for `nightshift init` depend on `pnpm build` completing first so that `dist/` contains current code
- **Runtime dependency**: Tests require `opencode` CLI to be available in the environment for `opencode run --command` invocations
- **No breaking changes**: This is purely additive infrastructure
