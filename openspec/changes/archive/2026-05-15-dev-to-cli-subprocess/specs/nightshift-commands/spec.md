## ADDED Requirements

### Requirement: Do-task skill
The system SHALL provide a `/nightshift-do-task` Claude Code skill at `.claude/skills/nightshift-do-task/SKILL.md` that executes a single task on a single item. The skill is intended to be invoked from a `claude -p` subprocess spawned by the manager subagent; it MAY also be invoked directly by the user for ad-hoc execution.

#### Scenario: Skill receives positional arguments
- **WHEN** the skill is invoked as `/nightshift-do-task <shift> <task> <item-id>`
- **THEN** `$ARGUMENTS` SHALL contain the three (or four, with `--read-only`) positional arguments, and the skill body SHALL parse them in order

#### Scenario: Skill resolves task artifacts
- **WHEN** the skill is invoked
- **THEN** it SHALL read `.nightshift/<shift>/manager.md`, `.nightshift/<shift>/<task>.md`, and the matching row in `.nightshift/<shift>/table.csv` before executing any task step

#### Scenario: Skill disables model auto-invocation
- **WHEN** `.claude/skills/nightshift-do-task/SKILL.md` is parsed
- **THEN** its YAML frontmatter SHALL include `disable-model-invocation: true`

#### Scenario: Skill pre-approves CSV operations
- **WHEN** `.claude/skills/nightshift-do-task/SKILL.md` is parsed
- **THEN** its YAML frontmatter `allowed-tools` field SHALL include `Bash(qsv *)` and `Bash(flock *)`

## MODIFIED Requirements

### Requirement: Start-shift skill uses forked manager
The system SHALL provide a `/nightshift-start` skill that begins or resumes shift execution by forking into the `nightshift-manager` subagent with the skill body as the task prompt. The skill body SHALL include pre-flight summary state (total items, done count, failed count, todo count per task) inlined via dynamic context injection before the manager subagent receives the prompt. The manager subagent SHALL dispatch dev work as `claude -p` subprocesses via the bundled `dispatch-batch.sh` helper, NOT via the `Agent` tool.

#### Scenario: Start a new shift
- **WHEN** a user invokes `/nightshift-start my-batch-job` in Claude Code with a valid shift directory containing `todo` items
- **THEN** the skill SHALL fork the conversation into the `nightshift-manager` subagent with pre-flight counts inlined and the manager SHALL begin processing items by spawning dev subprocesses

#### Scenario: Start a complete shift
- **WHEN** a user invokes `/nightshift-start my-batch-job` and all items are already `done`
- **THEN** the skill SHALL report that the shift is complete and suggest `/nightshift-archive` instead of forking the manager

#### Scenario: Start a shift with no items
- **WHEN** a user invokes `/nightshift-start my-batch-job` and `table.csv` has no rows
- **THEN** the skill SHALL report that the shift has no items and suggest `/nightshift-update-table` first

#### Scenario: Start a shift with no tasks
- **WHEN** a user invokes `/nightshift-start my-batch-job` and `table.csv` has no task columns
- **THEN** the skill SHALL report that the shift has no tasks and suggest `/nightshift-add-task` first

#### Scenario: Manager uses dispatch-batch.sh for all dispatch
- **WHEN** the forked manager subagent dispatches work to dev
- **THEN** it SHALL invoke `${CLAUDE_SKILL_DIR}/scripts/dispatch-batch.sh` (installed alongside the start skill) for both single-item and multi-item batches, rather than calling `Agent(nightshift-dev)`

### Requirement: Test-task skill is read-only
The system SHALL provide a `/nightshift-test-task` skill that executes a single task on a single item via the `nightshift-do-task` skill invoked in a `claude -p` subprocess with the `--read-only` flag, without modifying any state in `table.csv` or `manager.md`.

#### Scenario: Test-task does not mutate table
- **WHEN** a user invokes `/nightshift-test-task my-batch-job` and the dev subprocess completes execution
- **THEN** `table.csv` and `manager.md` SHALL be byte-identical to their state before the invocation

#### Scenario: Test-task displays results
- **WHEN** the dev subprocess returns from a test-task invocation
- **THEN** the skill SHALL display the dev's overall status, recommendations, and (on failure) error details, prefixed with a note that no state was modified

#### Scenario: Test-task invocation includes read-only flag
- **WHEN** the test-task skill spawns the dev subprocess
- **THEN** the invocation SHALL pass `--read-only` as the 4th positional argument to `/nightshift-do-task` so the skill's mutation paths (status write, recommendation application) are bypassed

#### Scenario: Test-task includes safety boundary in dev prompt
- **WHEN** the test-task skill spawns the dev subprocess
- **THEN** the invocation prompt SHALL include a boundary line directing the dev to not modify `table.csv`, `manager.md`, or the task file — leveraging auto-mode classifier deny signals as a secondary safeguard
