# nightshift-tasks Specification

## Purpose
Defines the task file format (Configuration, Steps, Validation sections), the per-task execution-config fields (tools, model, working_dir, worktree), and section mutability rules.
## Requirements
### Requirement: Task file format
The system SHALL define tasks as Markdown files with three mandatory sections: Configuration, Steps, and Validation. Each task file SHALL be named `<task_name>.md` in snake_case (no hyphens — hyphens conflict with qsv column selectors).

#### Scenario: Valid task file structure
- **WHEN** a task file is read
- **THEN** it SHALL contain a `## Configuration` section, a `## Steps` section, and a `## Validation` section in that order

#### Scenario: Missing section rejected
- **WHEN** a task file is missing any of the three mandatory sections
- **THEN** the system SHALL report an error identifying the missing section

### Requirement: Task configuration section
The Configuration section SHALL declare the tools, optional model selection, optional working directory, and optional worktree flag for executing the task. Fields are formatted as bulleted `- key: value` lines.

#### Scenario: Tools declaration
- **WHEN** a task configuration lists `tools: playwright, google_workspace`
- **THEN** the executing agent SHALL have access to the Playwright and Google Workspace MCP tools

#### Scenario: Model selection
- **WHEN** a task configuration includes `model: <name>` where `<name>` is a valid Claude Code model identifier (e.g., `haiku`, `sonnet`, `opus`)
- **THEN** the dev subprocess SHALL be invoked with `--model <name>` and the named model SHALL execute the task; if the model name is unsupported by the host Claude Code version, the subprocess SHALL fail with a clear error and the manager SHALL mark the item failed without retry

#### Scenario: Working directory declaration
- **WHEN** a task configuration includes `working_dir: <path-or-placeholder>`
- **THEN** the manager SHALL resolve placeholders (`{column_name}`, `{ENV:VAR}`, `{SHIFT:FOLDER|NAME|TABLE}`) using the item's row data, shift environment, and shift metadata, and the dispatch helper SHALL `cd` into the resolved absolute (or workspace-relative) path before invoking `claude -p` for that item

#### Scenario: Working directory per-item via column placeholder
- **WHEN** a task configuration includes `working_dir: {repo_path}` and `table.csv` has a `repo_path` column
- **THEN** each item's dev subprocess SHALL run from the directory named in that row's `repo_path` cell

#### Scenario: Working directory does not exist
- **WHEN** the resolved `working_dir` for an item is not an existing directory at dispatch time
- **THEN** the manager SHALL record the failure with a clear error (`working_dir does not exist: <path>`), write `failed` to that item's status in `table.csv`, and SHALL NOT retry the item

#### Scenario: Worktree flag
- **WHEN** a task configuration includes `worktree: true` AND `working_dir` is also set
- **THEN** the dispatch helper SHALL append `--worktree <unique-name>` to the `claude -p` invocation, where `<unique-name>` follows the schema `ns-<shift>-<item-id>-<task-name>-<timestamp>`, causing Claude Code to create a git worktree under `<working_dir>/.claude/worktrees/<unique-name>/` on a branch `worktree-<unique-name>`

#### Scenario: Worktree requires working_dir
- **WHEN** a task configuration sets `worktree: true` but does NOT set `working_dir`
- **THEN** the manager SHALL surface a configuration error during pre-flight and SHALL NOT dispatch any items for that task

#### Scenario: Worktree omitted
- **WHEN** a task configuration omits `worktree` (or sets `worktree: false`)
- **THEN** the dispatch helper SHALL NOT pass `--worktree` to `claude -p` and no worktree SHALL be created

#### Scenario: No tools declared
- **WHEN** a task configuration has no tools listed
- **THEN** the executing dev subprocess SHALL have access to default tools only (Read, Write, Edit, Bash, Glob, Grep) plus any MCPs the user has configured at the Claude Code user level

### Requirement: Task steps section
The Steps section SHALL contain numbered instructions that the dev agent follows to execute the task on a single table item. Steps SHALL be detailed enough for unsupervised execution. The manager agent SHALL apply step improvements to the task file based on dev agent recommendations between items or batches, but SHALL only incorporate recommendations from dev processes that completed successfully. Recommendations from failed dev processes SHALL be discarded. The dev agent SHALL NOT directly edit the Steps section. Steps MAY reference environment variables using `{ENV:VAR_NAME}` syntax, shift metadata using `{SHIFT:FOLDER}`, `{SHIFT:NAME}`, or `{SHIFT:TABLE}` syntax, and table column data using `{column_name}` syntax (where `column_name` corresponds to a metadata column in table.csv).

#### Scenario: Steps reference table metadata
- **WHEN** steps reference item data using `{column_name}` placeholders
- **THEN** the dev agent SHALL substitute the actual values from the current table item's metadata columns before execution

#### Scenario: Steps reference environment variables
- **WHEN** steps reference environment variables using `{ENV:VAR_NAME}` placeholders
- **THEN** the dev agent SHALL substitute the actual values from the shift's `.env` file before execution

#### Scenario: Steps reference shift metadata
- **WHEN** steps reference shift metadata using `{SHIFT:FOLDER}`, `{SHIFT:NAME}`, or `{SHIFT:TABLE}` placeholders
- **THEN** the dev agent SHALL substitute the computed shift directory path, shift name, or table file path before execution

#### Scenario: Steps include error handling
- **WHEN** steps include conditional branches (e.g., "If X fails, then Y")
- **THEN** the dev agent SHALL follow the conditional logic during execution

#### Scenario: Manager applies step improvements from successful recommendations only
- **WHEN** the manager receives step improvement recommendations from a dev agent whose `overall_status` is `SUCCESS`
- **THEN** the manager SHALL review, synthesize, and apply a coherent update to the Steps section in the task file before delegating the next item or batch

#### Scenario: Manager discards step improvements from failed dev
- **WHEN** the manager receives step improvement recommendations from a dev agent whose `overall_status` contains `FAILED`
- **THEN** the manager SHALL discard those recommendations and SHALL NOT apply them to the Steps section

#### Scenario: Step improvements persist for subsequent items
- **WHEN** the manager applies step improvements after processing item N
- **THEN** item N+1 SHALL receive the improved steps when the manager delegates it to the dev agent

### Requirement: Task validation section
The Validation section SHALL describe criteria the dev agent uses for self-validation of task completion on a single item. Each criterion SHALL be independently verifiable.

#### Scenario: Validation criteria format
- **WHEN** a validation section is read
- **THEN** it SHALL contain one or more checkable criteria as a bulleted list, each describing an observable outcome

#### Scenario: Dev uses validation criteria for self-validation
- **WHEN** the dev agent completes task steps on an item
- **THEN** it SHALL check each validation criterion independently and report pass/fail per criterion as part of self-validation

#### Scenario: All criteria must pass
- **WHEN** the dev agent evaluates validation criteria for an item-task
- **THEN** the item-task SHALL be marked `done` only if ALL criteria pass, otherwise it SHALL be marked `failed`

### Requirement: Task test execution
The system SHALL support running a single task on a single table item for testing purposes, without affecting other items or tasks in the shift.

#### Scenario: Test a task on one item
- **WHEN** a user invokes test-task for task "create_page" on item 5 (1-based display label)
- **THEN** the system SHALL execute the task steps on the item at qsv index 4 (0-based) only, run self-validation, and report the result without updating the table status

#### Scenario: Test preserves table state
- **WHEN** a test-task execution completes
- **THEN** the table.csv SHALL NOT be modified (status columns remain unchanged)

### Requirement: Task execution produces observable output
The dev agent SHALL report the results of each step execution so that the manager has visibility into what was done.

#### Scenario: Dev reports step results
- **WHEN** the dev agent completes executing steps for an item
- **THEN** it SHALL return a structured summary including: which steps succeeded, which failed, any captured values (e.g., URLs, IDs), and any error messages

#### Scenario: Failed step halts execution
- **WHEN** a step fails during execution
- **THEN** the dev agent SHALL stop executing remaining steps for that item and report the failure with the step number and error details

### Requirement: Task file section mutability rules
The system SHALL enforce mutability rules for task file sections. The Steps section SHALL be mutable only by the manager agent (for applying step improvements from dev recommendations). The dev agent SHALL NOT modify any section of the task file. The Configuration and Validation sections SHALL be immutable by all agents during execution.

#### Scenario: Manager modifies Steps section
- **WHEN** the manager agent receives step improvement recommendations from dev agents
- **THEN** the manager SHALL be permitted to update the Steps section of the task file with synthesized improvements

#### Scenario: Dev cannot modify Steps section
- **WHEN** the dev agent identifies step improvements during execution
- **THEN** the dev agent SHALL NOT edit the Steps section of the task file, and SHALL instead report improvements as recommendations in its result output

#### Scenario: Dev cannot modify Validation section
- **WHEN** the dev agent attempts to modify the Validation section of a task file
- **THEN** the system SHALL prevent the modification — the Validation section SHALL remain unchanged from its authored state

#### Scenario: Dev cannot modify Configuration section
- **WHEN** the dev agent attempts to modify the Configuration section of a task file
- **THEN** the system SHALL prevent the modification — the Configuration section SHALL remain unchanged from its authored state

