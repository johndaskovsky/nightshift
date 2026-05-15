## MODIFIED Requirements

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
