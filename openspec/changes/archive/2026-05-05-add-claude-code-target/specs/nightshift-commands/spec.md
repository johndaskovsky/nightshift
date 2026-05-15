## ADDED Requirements

### Requirement: Claude Code skill surface for all six commands
The system SHALL provide a Claude Code Skill counterpart for each of the six existing Nightshift slash commands. Each skill SHALL produce identical user-observable behavior to its OpenCode equivalent for the same inputs (same shift directory layout, same `manager.md` and `table.csv` mutations, same archive behavior).

#### Scenario: Skills available after Claude install
- **WHEN** a user runs `nightshift init --target=claude` in a fresh project and then opens Claude Code
- **THEN** all six Nightshift skills SHALL be available: `/nightshift-create`, `/nightshift-start`, `/nightshift-archive`, `/nightshift-add-task`, `/nightshift-test-task`, `/nightshift-update-table`

#### Scenario: Skills produce parity behavior
- **WHEN** the same input (e.g., a shift name) is supplied to a Claude Code skill and to its OpenCode slash command counterpart
- **THEN** the resulting filesystem state under `.nightshift/` SHALL be functionally equivalent (modulo non-deterministic agent decisions)

### Requirement: Create-shift skill
The system SHALL provide a `/nightshift-create` skill that scaffolds a new shift with a manager file, an empty table, and optionally one or more initial task files.

#### Scenario: Create shift with name only
- **WHEN** a user invokes `/nightshift-create my-batch-job` in Claude Code
- **THEN** the skill SHALL create `.nightshift/my-batch-job/` containing `manager.md` with the default template and an empty `table.csv`

#### Scenario: Create shift interactively
- **WHEN** a user invokes `/nightshift-create` without a name
- **THEN** the skill SHALL ask the user (using the `AskUserQuestion` deferred tool) to describe what the shift will do, derive a kebab-case name, and create the shift directory

#### Scenario: Shift name conflict
- **WHEN** a user invokes `/nightshift-create my-batch-job` and `.nightshift/my-batch-job/` already exists
- **THEN** the skill SHALL report that the shift already exists and suggest using `/nightshift-start` to resume it

### Requirement: Start-shift skill uses forked manager
The system SHALL provide a `/nightshift-start` skill that begins or resumes shift execution by forking into the `nightshift-manager` subagent with the skill body as the task prompt. The skill body SHALL include pre-flight summary state (total items, done count, failed count, todo count per task) inlined via dynamic context injection before the manager subagent receives the prompt.

#### Scenario: Start a new shift
- **WHEN** a user invokes `/nightshift-start my-batch-job` in Claude Code with a valid shift directory containing `todo` items
- **THEN** the skill SHALL fork the conversation into the `nightshift-manager` subagent with pre-flight counts inlined and the manager SHALL begin processing items

#### Scenario: Start a complete shift
- **WHEN** a user invokes `/nightshift-start my-batch-job` and all items are already `done`
- **THEN** the skill SHALL report that the shift is complete and suggest `/nightshift-archive` instead of forking the manager

#### Scenario: Start a shift with no items
- **WHEN** a user invokes `/nightshift-start my-batch-job` and `table.csv` has no rows
- **THEN** the skill SHALL report that the shift has no items and suggest `/nightshift-update-table` first

#### Scenario: Start a shift with no tasks
- **WHEN** a user invokes `/nightshift-start my-batch-job` and `table.csv` has no task columns
- **THEN** the skill SHALL report that the shift has no tasks and suggest `/nightshift-add-task` first

### Requirement: Test-task skill is read-only
The system SHALL provide a `/nightshift-test-task` skill that executes a single task on a single item via the dev subagent without modifying any state in `table.csv` or `manager.md`.

#### Scenario: Test-task does not mutate table
- **WHEN** a user invokes `/nightshift-test-task my-batch-job` and the dev subagent completes execution
- **THEN** `table.csv` and `manager.md` SHALL be byte-identical to their state before the invocation

#### Scenario: Test-task displays results
- **WHEN** the dev subagent returns from a test-task invocation
- **THEN** the skill SHALL display the dev's overall status, recommendations, and (on failure) error details, prefixed with a note that no state was modified

### Requirement: Add-task skill
The system SHALL provide a `/nightshift-add-task` skill that adds a task definition file (`<task-name>.md`) to an existing shift, registers the task in `manager.md`'s Task Order, and adds a corresponding status column to `table.csv`.

#### Scenario: Add task to shift
- **WHEN** a user invokes `/nightshift-add-task my-batch-job` and provides task metadata
- **THEN** the skill SHALL create `.nightshift/my-batch-job/<task-name>.md` with Configuration/Steps/Validation sections, append the task to `manager.md`'s Task Order, and add a `<task-name>` column to `table.csv` initialized to `todo` for all existing items

### Requirement: Update-table skill
The system SHALL provide a `/nightshift-update-table` skill that allows the user to add rows, modify metadata columns, or reset failed items in a shift's `table.csv`.

#### Scenario: Add rows to table
- **WHEN** a user invokes `/nightshift-update-table my-batch-job` and provides new row data
- **THEN** the skill SHALL append the rows to `table.csv` with all task status columns initialized to `todo`

### Requirement: Archive skill
The system SHALL provide a `/nightshift-archive` skill that moves a completed shift to `.nightshift/archive/YYYY-MM-DD-<shift-name>/`.

#### Scenario: Archive a completed shift
- **WHEN** a user invokes `/nightshift-archive my-batch-job` and all items in the shift are `done`
- **THEN** the skill SHALL move `.nightshift/my-batch-job/` to `.nightshift/archive/<today>-my-batch-job/` atomically

#### Scenario: Archive an incomplete shift
- **WHEN** a user invokes `/nightshift-archive my-batch-job` and some items are still `todo` or `failed`
- **THEN** the skill SHALL ask the user (via `AskUserQuestion`) to confirm before archiving

### Requirement: Skills disable model invocation
The system SHALL set `disable-model-invocation: true` in the frontmatter of every Nightshift skill so that Claude does not auto-invoke side-effecting workflows. Users SHALL invoke skills explicitly via `/<skill-name>` typing.

#### Scenario: All skill SKILL.md files set the flag
- **WHEN** the Claude target is installed
- **THEN** every `.claude/skills/nightshift-*/SKILL.md` file SHALL contain `disable-model-invocation: true` in its YAML frontmatter

### Requirement: Skills pre-approve CSV operations
The system SHALL set `allowed-tools: Bash(qsv *) Bash(flock *)` in the frontmatter of every Nightshift skill that performs CSV operations, so that qsv and flock invocations execute without per-call permission prompts.

#### Scenario: All skill SKILL.md files include allowed-tools
- **WHEN** the Claude target is installed
- **THEN** every `.claude/skills/nightshift-*/SKILL.md` file that performs CSV operations SHALL include `Bash(qsv *)` and `Bash(flock *)` in its `allowed-tools` field

### Requirement: Skills accept shift name argument
The system SHALL allow each skill to accept a shift name as an argument via Claude Code's `$ARGUMENTS` (or `$0`) substitution, parallel to the OpenCode commands' positional argument handling.

#### Scenario: Skill receives shift name
- **WHEN** a user invokes `/nightshift-start my-batch-job`
- **THEN** the skill body SHALL receive `my-batch-job` substituted for `$ARGUMENTS` (or `$0`) at render time

#### Scenario: Skill prompts when argument omitted
- **WHEN** a user invokes a skill that requires a shift name (e.g., `/nightshift-start`) without providing one
- **THEN** the skill SHALL list the available shift directories and ask the user to pick one (using `AskUserQuestion` when more than one is available, auto-selecting when only one is available)
