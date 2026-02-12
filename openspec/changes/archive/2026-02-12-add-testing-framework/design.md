## Context

Nightshift is a CLI-installable AI agent orchestration framework built from Markdown, YAML, and CSV configuration files. It has two testable surfaces: (1) the TypeScript CLI installer (`nightshift init`, `nightshift update`) that scaffolds directories and writes agent/command files, and (2) the six OpenCode slash commands (`nightshift-create`, `nightshift-add-task`, `nightshift-update-table`, `nightshift-start`, `nightshift-test-task`, `nightshift-archive`) that drive the three-agent batch processing system.

There is currently no test infrastructure. The `tsconfig.json` already excludes a `test/` directory, but it does not exist yet. The project uses `pnpm` as its package manager with ESM modules and has no test runner, test scripts, or test dependencies.

The commands run inside OpenCode and interact via `AskUserQuestion` prompts, delegate to subagents via the Task tool, and produce artifacts like directories, Markdown files, and CSV files. The `opencode run --command <command_name> [args]` CLI supports headless command execution with `--format json` for structured output, making automated invocation possible.

## Goals / Non-Goals

**Goals:**

- Test all six nightshift commands end-to-end via `opencode run --command`
- Test the CLI installer (`nightshift init`) using locally-built files from `dist/`
- Track accuracy: whether each command produces the expected artifacts (files, directories, CSV structure, Markdown sections)
- Track performance: execution time per test with persistent benchmarks
- Warn on performance regression (slower than benchmark), auto-update on improvement (faster than benchmark)
- Maintain a persistent log of test results for trend analysis
- Isolate test execution in a dedicated `test/` directory with automatic cleanup of generated artifacts
- Keep the test runner simple: a Node.js script with no external test framework dependency

**Non-Goals:**

- Unit testing individual TypeScript functions (the CLI surface area is small enough for integration testing)
- Testing the OpenSpec workflow commands (`opsx-*`) which are third-party plugin commands
- Testing the agent Markdown files in isolation (they are tested implicitly through command execution)
- CI/CD integration (can be added later; this change establishes the local test infrastructure)
- Testing with real external services or APIs beyond the local OpenCode runtime

## Decisions

### 1. Test runner: custom Node.js script over a test framework

**Decision**: Use a standalone ESM script (`test/run-tests.ts`) executed via `tsx` rather than adopting a test framework like Vitest or Jest.

**Rationale**: The tests are integration tests that shell out to `opencode run` and inspect filesystem artifacts. A test framework adds dependency weight and ceremony without providing meaningful value for this use case. The project already has `tsx` as a devDependency for running TypeScript directly. The test runner is a straightforward sequential executor: run command, check artifacts, record timing.

**Alternatives considered**:
- Vitest/Jest: Adds dependencies and configuration overhead. The assertion patterns needed (file existence, CSV content, Markdown structure) are simple enough for direct `node:assert` or manual checks.
- Shell script: Harder to manage timing, benchmarks, and structured JSON output. TypeScript gives type safety and access to `node:fs` for artifact validation.

### 2. Command execution via `opencode run --command` with `--format json`

**Decision**: Each test invokes the command under test using `opencode run --command <name> <args> --format json` via `child_process.execSync` (or `spawn` for streaming). The JSON output provides structured events for parsing results.

**Rationale**: This is the documented headless execution path for OpenCode commands. Using `--format json` gives machine-parseable output rather than terminal-formatted text, making result validation reliable.

**Key consideration**: Commands that use `AskUserQuestion` (interactive prompts) will need their inputs provided via the message arguments. The `opencode run` message positional serves as the argument to the command. Commands that require multi-step interactive input (like `nightshift-add-task` which asks for task descriptions) may need special handling or may need to be tested with pre-populated shift directories rather than through the full interactive flow.

### 3. Test isolation: temporary subdirectory per test run

**Decision**: Each test creates a temporary working directory under `test/workspace/` (e.g., `test/workspace/test-<command>-<timestamp>/`), runs the command there, validates artifacts, then removes the directory. The `test/workspace/` directory is gitignored.

**Rationale**: Tests that run `nightshift init` and `nightshift-create` produce real files (`.nightshift/`, `.opencode/`). These must not pollute the project root or interfere with each other. A per-test temporary directory provides full isolation. Cleanup after each test ensures no accumulation of artifacts.

**Alternatives considered**:
- Single shared workspace cleaned between tests: Risk of cross-contamination if cleanup fails partway. Per-test directories are safer.
- System temp directory (`os.tmpdir()`): Harder to inspect artifacts during debugging. A local `test/workspace/` directory is visible and easy to examine when cleanup is skipped for debugging.

### 4. CLI init test: use local build output

**Decision**: The `nightshift init` test runs `pnpm build` first, then executes the built CLI from `dist/` (or via the `bin/nightshift.js` entry point which references `dist/`) in the test workspace directory. This tests the actual scaffolder output against expected file lists.

**Rationale**: Testing against the local build rather than the published npm package ensures the current code is what gets validated. The build step is fast (TypeScript compilation only) and the test verifies both the build pipeline and the scaffolder behavior.

**Expected artifacts from `nightshift init`**:
- `.nightshift/archive/` directory
- `.opencode/agent/nightshift-manager.md`
- `.opencode/agent/nightshift-dev.md`
- `.opencode/agent/nightshift-qa.md`
- `.opencode/command/nightshift-create.md`
- `.opencode/command/nightshift-add-task.md`
- `.opencode/command/nightshift-update-table.md`
- `.opencode/command/nightshift-start.md`
- `.opencode/command/nightshift-test-task.md`
- `.opencode/command/nightshift-archive.md`

### 5. Accuracy validation: artifact checklists per command

**Decision**: Each test defines an expected artifact checklist (files that should exist, CSV columns that should be present, Markdown sections that should appear). After command execution, the runner checks each item and reports accuracy as a fraction (e.g., 8/10 artifacts found).

**Rationale**: Accuracy tracking provides a quantitative measure of command correctness beyond simple pass/fail. A command might partially succeed (creating some files but not others), and accuracy captures that nuance.

**Validation types**:
- File existence: `fs.existsSync(path)`
- Directory existence: `fs.existsSync(path)` + `fs.statSync(path).isDirectory()`
- File content contains section: `fs.readFileSync(path).includes(marker)`
- CSV has column: parse header row and check column name
- CSV row count: count data rows

### 6. Benchmark storage: JSON file with per-test baselines

**Decision**: Store benchmarks in `test/benchmarks.json` as a map of test name to timing data. This file is committed to the repo (not gitignored) so benchmarks persist across environments and contributors.

**Format**:
```json
{
  "init": { "durationMs": 1250, "updatedAt": "2026-02-12T..." },
  "nightshift-create": { "durationMs": 45000, "updatedAt": "2026-02-12T..." }
}
```

**Behavior**:
- If no benchmark exists for a test, the first run establishes it
- If the test runs faster, update the benchmark silently (log the improvement)
- If the test runs slower, print a warning with the delta but do not fail the test
- A threshold tolerance (e.g., 10%) prevents noise from minor fluctuations triggering warnings

**Alternatives considered**:
- SQLite: Overkill for a simple key-value timing store
- CSV: Less ergonomic for structured data with nested fields
- No committed benchmarks (gitignored): Loses benchmark history and makes it per-machine only. Committing gives a shared baseline.

### 7. Test log: append-only JSONL file

**Decision**: Each test run appends a result line to `test/test-log.jsonl` (JSON Lines format). This file is gitignored since it captures local run history.

**Format per line**:
```json
{"timestamp": "2026-02-12T...", "test": "nightshift-create", "pass": true, "accuracy": "5/5", "durationMs": 43200, "benchmarkMs": 45000}
```

**Rationale**: JSONL is append-friendly (no need to parse/rewrite the whole file), easy to query with `grep` or `jq`, and lightweight. The log provides a local history of test runs for trend analysis without the complexity of a database.

### 8. Test execution order

**Decision**: Tests run sequentially in dependency order:

1. `init` - Tests `nightshift init` using local build (foundational, validates scaffolder)
2. `nightshift-create` - Creates a shift (requires init'd environment)
3. `nightshift-add-task` - Adds a task to the shift (requires a shift)
4. `nightshift-update-table` - Adds rows to the table (requires a shift)
5. `nightshift-start` - Executes the shift (requires tasks and rows)
6. `nightshift-test-task` - Tests a single task (requires tasks and rows)
7. `nightshift-archive` - Archives the shift (requires a completed or partial shift)

**Rationale**: Some commands depend on the state created by prior commands (you cannot add a task without a shift). Sequential execution with a shared workspace per test suite run allows later tests to build on earlier state while still tracking each command's accuracy and timing independently.

**Alternative approach**: Each test fully self-contained with its own init + setup. This would be more isolated but much slower and redundant. The sequential approach mirrors the real user workflow.

## Risks / Trade-offs

**[Interactive prompts in headless mode]** Commands that use `AskUserQuestion` may behave differently in headless `opencode run` mode. Some commands may block waiting for input that cannot be provided.
-> Mitigation: Test with commands that accept arguments directly (e.g., `opencode run --command nightshift-create my-test-shift`). For commands requiring interactive input, pre-populate the shift directory with the needed state and test only the non-interactive portions. Investigate whether `opencode run` supports providing answers to prompts via message arguments.

**[OpenCode runtime dependency]** Tests require a running OpenCode environment with the correct model provider configured. Tests will fail if OpenCode is not installed or configured.
-> Mitigation: The test runner should check for `opencode` availability as a precondition and provide a clear error message if missing. Document the runtime requirements.

**[AI non-determinism]** Commands that delegate to AI agents (like `nightshift-start` which invokes the manager, dev, and QA agents) will produce non-deterministic results.
-> Mitigation: Focus accuracy validation on structural artifacts (files exist, columns present, sections present) rather than content correctness. Accept that AI-driven commands may have variable accuracy scores and use benchmarks only for timing, not for enforcing exact accuracy thresholds.

**[Performance variance]** AI command execution time varies significantly based on model latency, prompt complexity, and provider load. Benchmarks may be noisy.
-> Mitigation: Use a tolerance threshold (e.g., 10%) before triggering regression warnings. Store benchmarks from the most recent faster run rather than averaging, so the baseline naturally adjusts to current conditions.

**[Test workspace cleanup failure]** If the test runner crashes mid-test, temporary workspace directories may not be cleaned up.
-> Mitigation: The runner should clean up stale workspaces at startup (delete any `test/workspace/*` directories). The `test/workspace/` directory is gitignored so leftover artifacts do not affect the repo.
