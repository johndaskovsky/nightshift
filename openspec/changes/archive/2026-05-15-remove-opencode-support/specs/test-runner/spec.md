## MODIFIED Requirements

### Requirement: Test runner entry points
The system SHALL provide two test entry points: an init/scaffolder suite at `test/init-tests.ts` (no runtime CLI required) and an integration suite at `test/run-tests.ts` (drives shift execution against Claude Code). `pnpm test` SHALL run the init suite first and then the integration suite. Dedicated scripts SHALL exist to run each suite independently: `pnpm test:init`, `pnpm test:integration`.

#### Scenario: Running the full test suite
- **WHEN** the user executes `pnpm test`
- **THEN** the runner SHALL execute the init suite to completion, then the integration suite, and print a summary of results to stdout

#### Scenario: Init suite without any runtime
- **WHEN** the user executes `pnpm test:init` in an environment without `claude` installed
- **THEN** the init suite SHALL complete successfully (the init suite does NOT depend on any runtime CLI)

#### Scenario: Integration suite without Claude
- **WHEN** the user executes `pnpm test:integration` and `claude` is not on PATH
- **THEN** the runner SHALL print an error stating Claude Code is not installed and exit with a non-zero status without running any tests

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
- **THEN** the following files SHALL exist: `.claude/agents/nightshift-manager.md`, `.claude/agents/nightshift-dev.md`, `.claude/skills/nightshift-start/SKILL.md`, `.claude/settings.json`, and `CLAUDE.md`

### Requirement: Command execution under Claude Code
For each integration test, the integration runner SHALL invoke the Nightshift skill using the Claude Code CLI and SHALL capture stdout and the exit code for validation.

#### Scenario: Claude invocation
- **WHEN** the runner executes an integration test
- **THEN** the runner SHALL invoke `claude -p "/<skill-name> <shift-name>" --output-format json --dangerously-skip-permissions` in the workspace directory with the environment variable `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` so that `context: fork` skills block the print-mode session until the manager subagent finishes

#### Scenario: Command execution timeout
- **WHEN** a command execution exceeds a configurable timeout (default: 5 minutes)
- **THEN** the runner SHALL kill the process, record the test as failed with reason "timeout", and proceed to the next test

## REMOVED Requirements

### Requirement: Integration runner runtime selection
**Reason:** Removed when OpenCode support was dropped. With one runtime there is no runtime to select.
**Migration:** Drop `--runtime=...` from invocations and unset `NIGHTSHIFT_TEST_RUNTIMES`. The integration suite always runs against Claude Code; if Claude Code is not on PATH the suite errors out (see `Test runner entry points`).

### Requirement: Runtime-agnostic test definitions
**Reason:** Removed when OpenCode support was dropped. With one runtime there is no need to parameterize test definitions over a runtime axis, and benchmark keys no longer need runtime suffixes (e.g., `nightshift-start.claude` becomes `nightshift-start`).
**Migration:** `test/benchmarks.json` keys that previously ended in `.opencode` are deleted; keys that ended in `.claude` are renamed to drop the suffix. Existing baseline values are preserved.

### Requirement: Per-runtime command execution
**Reason:** Replaced by `Command execution under Claude Code`. Per-runtime branching is no longer required.
**Migration:** See `Command execution under Claude Code` for the new single-runtime invocation contract.
