# dev-subprocess Specification

## Purpose
TBD - created by archiving change dev-to-cli-subprocess. Update Purpose after archive.
## Requirements
### Requirement: Dev runs as a top-level Claude Code subprocess
The system SHALL execute Nightshift dev work as a `claude -p` subprocess invoked from the manager subagent via the Bash tool. Each invocation runs in a fresh top-level Claude Code session and SHALL inherit the user's full top-level MCP configuration. There SHALL NOT be a `nightshift-dev` subagent.

#### Scenario: Manager spawns dev via Bash
- **WHEN** the manager needs to execute a task on an item
- **THEN** it SHALL invoke `claude -p "/nightshift-do-task <shift-name> <task-name> <item-id>" --output-format stream-json --permission-mode <auto|bypassPermissions> > <log-path>` via the Bash tool

#### Scenario: Dev subprocess inherits user MCPs
- **WHEN** a dev subprocess is spawned by the manager via `claude -p`
- **THEN** the dev SHALL have access to every MCP server the user has configured at the user level (Claude Code global, Claude Desktop, custom internal MCPs) without those MCPs being declared in any Nightshift-shipped file

### Requirement: nightshift-do-task skill
The system SHALL provide a `nightshift-do-task` Claude Code skill at `.claude/skills/nightshift-do-task/SKILL.md` that accepts positional arguments `<shift-name> <task-name> <item-id>` and optionally a 4th positional `--read-only` flag. The skill SHALL NOT use `context: fork` — it runs in the calling top-level session.

#### Scenario: Skill resolves shift artifacts
- **WHEN** the skill is invoked with `/nightshift-do-task my-shift create_page 3`
- **THEN** it SHALL resolve `.nightshift/my-shift/manager.md`, `.nightshift/my-shift/create_page.md`, and the row at the matching `item-id` in `.nightshift/my-shift/table.csv`

#### Scenario: Skill performs template substitution
- **WHEN** the skill executes
- **THEN** it SHALL substitute `{column}` placeholders from the item row, `{ENV:VAR}` placeholders from the shift `.env` file, and `{SHIFT:FOLDER}`/`{SHIFT:NAME}`/`{SHIFT:TABLE}` placeholders from shift metadata before running steps

#### Scenario: Skill writes own status on success
- **WHEN** the skill completes execution with self-validation passing AND the `--read-only` flag is not set
- **THEN** it SHALL write `done` to its own row in `table.csv` using `flock -x <table_path> qsv edit -i ...`

#### Scenario: Skill writes own status on failure
- **WHEN** the skill exhausts all retry attempts AND self-validation still fails AND the `--read-only` flag is not set
- **THEN** it SHALL write `failed` to its own row in `table.csv`

#### Scenario: Skill respects --read-only flag
- **WHEN** the skill is invoked with the `--read-only` 4th positional argument
- **THEN** the skill SHALL NOT write to `table.csv`, SHALL NOT modify `manager.md`, and SHALL NOT modify the task file, regardless of success or failure

#### Scenario: Skill emits structured final report
- **WHEN** the skill completes (success or failure)
- **THEN** its final message SHALL be a structured report containing at minimum: `status: done|failed`, `attempts: <number>`, `recommendations: <text|None>`, and (on failure) `error: <text>`

#### Scenario: Skill disables model auto-invocation
- **WHEN** the skill's `SKILL.md` is parsed
- **THEN** its YAML frontmatter SHALL include `disable-model-invocation: true` so that Claude does not auto-invoke it; the skill SHALL be invoked only via explicit `/nightshift-do-task` calls

### Requirement: Permission posture for dev subprocesses
The manager SHALL invoke each dev subprocess with `--permission-mode auto` by default. When auto mode is unavailable, the manager SHALL fall back to `--permission-mode bypassPermissions` and SHALL log the fallback decision once per shift.

#### Scenario: Auto mode used by default
- **WHEN** the manager dispatches a dev subprocess on a host where `claude --permission-mode auto -p "echo ready"` exits successfully
- **THEN** all dev subprocesses in the shift SHALL be invoked with `--permission-mode auto`

#### Scenario: Fallback to bypassPermissions on auto-mode probe failure
- **WHEN** the auto-mode probe fails because the user's plan, model, or Claude Code version does not support auto mode
- **THEN** all dev subprocesses in the shift SHALL be invoked with `--permission-mode bypassPermissions` and a one-time notice SHALL be surfaced to the user explaining the trade-off (no classifier guardrails)

#### Scenario: Safety boundary in dev prompt
- **WHEN** the manager spawns a dev subprocess in auto mode
- **THEN** the invocation SHALL include a safety boundary preamble that the auto-mode classifier interprets as deny signals (e.g., "do not modify files outside the shift directory, do not push to git, do not modify .env files")

#### Scenario: Probe runs once per shift
- **WHEN** a shift is started or resumed
- **THEN** the manager SHALL run the auto-mode probe at most once before dispatching the first dev subprocess and SHALL reuse the result for all subsequent dispatches in the same session

### Requirement: Real-time observability via stream-json log files
Each dev subprocess SHALL write its `--output-format stream-json` output to `.nightshift/<shift>/logs/<item-id>-<task-name>-<timestamp>.jsonl`. Logs SHALL be one JSON object per line. The timestamp SHALL ensure retries do not overwrite earlier attempts.

#### Scenario: Log file is created per invocation
- **WHEN** the manager dispatches a dev subprocess for shift `my-shift`, task `create_page`, item `3`
- **THEN** a log file matching `.nightshift/my-shift/logs/3-create_page-<YYYY-MM-DDTHH-MM-SS>.jsonl` SHALL exist and be appended to as the subprocess runs

#### Scenario: User can tail a log mid-shift
- **WHEN** a dev subprocess is running and the user runs `tail -f .nightshift/<shift>/logs/<file>.jsonl`
- **THEN** the user SHALL see new JSON events appear as the dev makes progress

#### Scenario: Retries do not overwrite logs
- **WHEN** the manager retries an item after a dev failure
- **THEN** the retry SHALL produce a new log file with a distinct timestamp, leaving the prior attempt's log intact

#### Scenario: Logs are gitignored
- **WHEN** `nightshift init` runs
- **THEN** `.nightshift/.gitignore` SHALL include a pattern that excludes `**/logs/` from git

#### Scenario: Manager parses final result from log
- **WHEN** a dev subprocess completes
- **THEN** the manager SHALL parse the last JSON object with `"type": "result"` from the log file to extract `status`, `recommendations`, and (on failure) `error`

### Requirement: Parallel dispatch via bundled helper script
The system SHALL provide a bundled `dispatch-batch.sh` helper script that the manager uses for both serial (single-item) and parallel (multi-item) dispatch. The script SHALL be installed alongside the `nightshift-start` skill at `.claude/skills/nightshift-start/scripts/dispatch-batch.sh`.

#### Scenario: Script accepts JSON manifest
- **WHEN** the manager invokes `${CLAUDE_SKILL_DIR}/scripts/dispatch-batch.sh` with a JSON manifest of `{"shift": "...", "items": [{"item_id": "1", "task": "create_page"}, ...], "permission_mode": "auto|bypassPermissions", "log_dir": ".nightshift/<shift>/logs"}`
- **THEN** the script SHALL spawn one `claude -p "/nightshift-do-task ..." --output-format stream-json --permission-mode <mode> > <log_path>` per item, run them in parallel, and wait for all to exit

#### Scenario: Script emits JSON result array
- **WHEN** all spawned dev subprocesses have exited
- **THEN** the script SHALL emit a single JSON document to stdout: `{"results": [{"item_id": "1", "exit_code": 0, "status": "done|failed", "recommendations": "...", "log_path": "..."}, ...]}` parsed by the manager

#### Scenario: Script preserves order
- **WHEN** the script processes a batch
- **THEN** the order of items in the result array SHALL match the order of items in the input manifest

#### Scenario: Script handles non-zero exit codes
- **WHEN** a spawned `claude -p` exits with a non-zero code
- **THEN** the corresponding result entry SHALL contain `exit_code: <non-zero>` and `status: failed`, and the result entry's `recommendations` SHALL be derived from the log if available

#### Scenario: Script is executable
- **WHEN** `nightshift init` writes `dispatch-batch.sh` from the bundled template
- **THEN** the file SHALL be marked executable (mode `0755`)

### Requirement: Classifier-failure handling
When a dev subprocess running in `--permission-mode auto` is aborted by classifier-denial budget exhaustion (3 consecutive or 20 total denials per auto-mode rules), the manager SHALL treat the failure as a normal dev failure for retry-budget accounting.

#### Scenario: Classifier abort counts as one attempt
- **WHEN** a dev subprocess in auto mode aborts due to classifier denials
- **THEN** the manager SHALL decrement the item's retry budget by one (treating it as one failed attempt of three)

#### Scenario: Item marked failed after retries exhausted
- **WHEN** an item exhausts all 3 retry attempts (any combination of classifier aborts, validation failures, or other failures)
- **THEN** the item SHALL be marked `failed` in `table.csv` and the manager SHALL proceed to the next item

### Requirement: Plan/model/version eligibility for auto mode
Documentation SHALL state the eligibility constraints for `--permission-mode auto`: Claude Code v2.1.83 or later; Max, Team, Enterprise, or API plan (not Pro); an eligible model (Sonnet 4.6, Opus 4.6, or Opus 4.7); and the Anthropic API provider (not Bedrock, Vertex, or Foundry). Users on incompatible configurations SHALL receive the documented fallback experience (`--permission-mode bypassPermissions`) without manual configuration.

#### Scenario: README documents eligibility
- **WHEN** a user reads README.md
- **THEN** the documentation SHALL state the auto-mode eligibility requirements and the fallback behavior

#### Scenario: Auto-mode probe transparently selects fallback
- **WHEN** the auto-mode probe fails on shift start because of an eligibility constraint
- **THEN** the user SHALL see a one-line notice in the shift's output explaining that `bypassPermissions` is being used and pointing to the documentation, but the shift SHALL proceed without requiring user action

