## ADDED Requirements

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

## MODIFIED Requirements

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
