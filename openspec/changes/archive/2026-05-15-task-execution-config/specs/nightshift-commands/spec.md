## MODIFIED Requirements

### Requirement: Do-task skill
The system SHALL provide a `/nightshift-do-task` Claude Code skill at `.claude/skills/nightshift-do-task/SKILL.md` that executes a single task on a single item. The skill is intended to be invoked from a `claude -p` subprocess spawned by the manager subagent; it MAY also be invoked directly by the user for ad-hoc execution. The skill SHALL resolve the workspace root by reading the `NIGHTSHIFT_WORKSPACE_ROOT` environment variable, falling back to `pwd` only when the env var is unset.

#### Scenario: Skill receives positional arguments
- **WHEN** the skill is invoked as `/nightshift-do-task <shift> <task> <item-id>`
- **THEN** `$ARGUMENTS` SHALL contain the three (or four, with `--read-only`) positional arguments, and the skill body SHALL parse them in order

#### Scenario: Skill resolves task artifacts via NIGHTSHIFT_WORKSPACE_ROOT
- **WHEN** the skill is invoked with `NIGHTSHIFT_WORKSPACE_ROOT` set
- **THEN** it SHALL read `$NIGHTSHIFT_WORKSPACE_ROOT/.nightshift/<shift>/manager.md`, `$NIGHTSHIFT_WORKSPACE_ROOT/.nightshift/<shift>/<task>.md`, and the matching row from `$NIGHTSHIFT_WORKSPACE_ROOT/.nightshift/<shift>/table.csv` before executing any task step, regardless of its own cwd

#### Scenario: Skill falls back to pwd when env var unset
- **WHEN** the skill is invoked directly (e.g., a user runs `claude -p "/nightshift-do-task ..."` without going through `dispatch-batch.sh`) and `NIGHTSHIFT_WORKSPACE_ROOT` is not set
- **THEN** the skill SHALL use `pwd` as the workspace root for all shift-artifact paths, preserving pre-3.1 behavior

#### Scenario: Skill disables model auto-invocation
- **WHEN** `.claude/skills/nightshift-do-task/SKILL.md` is parsed
- **THEN** its YAML frontmatter SHALL include `disable-model-invocation: true`

#### Scenario: Skill pre-approves CSV operations
- **WHEN** `.claude/skills/nightshift-do-task/SKILL.md` is parsed
- **THEN** its YAML frontmatter `allowed-tools` field SHALL include `Bash(qsv *)` and `Bash(flock *)`

### Requirement: Add-task skill
The system SHALL provide a `/nightshift-add-task` skill that adds a task definition file (`<task-name>.md`) to an existing shift, registers the task in `manager.md`'s Task Order, and adds a corresponding status column to `table.csv`. When guiding the user through task creation, the skill SHALL describe the available Configuration fields including `tools`, `model`, `working_dir`, and `worktree`.

#### Scenario: Add task to shift
- **WHEN** a user invokes `/nightshift-add-task my-batch-job` and provides task metadata
- **THEN** the skill SHALL create `.nightshift/my-batch-job/<task-name>.md` with Configuration/Steps/Validation sections, append the task to `manager.md`'s Task Order, and add a `<task-name>` column to `table.csv` initialized to `todo` for all existing items

#### Scenario: Skill prompts for execution-config fields
- **WHEN** the user is creating a new task interactively
- **THEN** the skill SHALL describe the optional Configuration fields (`model: <name>`, `working_dir: <path-or-placeholder>`, `worktree: true|false`) and their effects, allowing the user to set or omit each

#### Scenario: Skill records execution-config fields verbatim
- **WHEN** the user supplies values for `model`, `working_dir`, or `worktree`
- **THEN** the skill SHALL write them into the task file's Configuration section as `- key: value` lines, without normalizing or validating values (validation happens at dispatch time)
