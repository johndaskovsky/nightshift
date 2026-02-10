## 1. Directory Structure and Base Files

- [x] 1.1 Create `.nightshift/` directory and `.nightshift/archive/` subdirectory at repository root
- [x] 1.2 Create a `.gitkeep` in `.nightshift/archive/` so the empty directory is tracked

## 2. Agent Definitions

- [x] 2.1 Add `nightshift-manager` agent definition to `opencode.jsonc` with `mode: "subagent"`, access to read, write, edit, glob, grep, and task tools
- [x] 2.2 Add `nightshift-dev` agent definition to `opencode.jsonc` with `mode: "subagent"`, access to read, write, edit, glob, grep tools (MCP tools granted dynamically per task config)
- [x] 2.3 Add `nightshift-qa` agent definition to `opencode.jsonc` with `mode: "subagent"`, access to read, glob, grep tools only (no write/edit to prevent state modification)
- [x] 2.4 Write agent instruction files referenced by each agent definition (`.opencode/agents/nightshift-manager.md`, `.opencode/agents/nightshift-dev.md`, `.opencode/agents/nightshift-qa.md`) covering role, responsibilities, input/output contract, and status update rules

## 3. Slash Commands — Shift Lifecycle

- [x] 3.1 Create `/nightshift-create` command file (`.opencode/command/nightshift-create.md`) — scaffolds a new shift directory with manager.md template, empty table.csv, prompts for shift name if not provided, validates kebab-case naming, checks for existing shift conflicts
- [x] 3.2 Create `/nightshift-start` command file (`.opencode/command/nightshift-start.md`) — invokes nightshift-manager agent to begin or resume a shift, handles shift selection when name omitted, detects fully-complete shifts and suggests archive
- [x] 3.3 Create `/nightshift-archive` command file (`.opencode/command/nightshift-archive.md`) — moves shift to `.nightshift/archive/YYYY-MM-DD-<name>/`, warns on incomplete items, handles name selection, checks for archive name collisions

## 4. Slash Commands — Shift Editing

- [x] 4.1 Create `/nightshift-add-task` command file (`.opencode/command/nightshift-add-task.md`) — adds a new task file with Configuration/Steps/Validation sections, appends status column to table.csv initialized to `todo`, updates manager.md task order
- [x] 4.2 Create `/nightshift-test-task` command file (`.opencode/command/nightshift-test-task.md`) — runs a single task on a single row via dev+qa agents without modifying table.csv, displays detailed step and validation results
- [x] 4.3 Create `/nightshift-update-table` command file (`.opencode/command/nightshift-update-table.md`) — supports adding rows, modifying metadata columns, resetting failed items to `todo`, confirms destructive changes before applying

## 5. Manager Agent Instructions

- [x] 5.1 Write the nightshift-manager agent instruction file with full orchestration logic: read manager.md for task order, read table.csv for status, pick next item-task (items with `todo` or reset `in_progress`/`qa`), delegate to dev via Task tool, delegate to qa via Task tool, update table.csv status after each delegation, update manager.md progress section after each status change
- [x] 5.2 Define the manager's item selection algorithm: process items row-by-row, for each item process tasks in order, skip items where a prerequisite task is `failed`, handle resume by resetting stale `in_progress`/`qa` to `todo`

## 6. Dev Agent Instructions

- [x] 6.1 Write the nightshift-dev agent instruction file: receive task file content and item row metadata from manager, substitute `{column_name}` placeholders with row values, execute steps sequentially, halt on step failure, return structured results (step outcomes, captured values, errors)
- [x] 6.2 Document the dev agent's output contract: JSON-like structured result with `steps` array (each with `step_number`, `status`, `output`), `captured_values` dict, `overall_status` (success/failed), and `error` field if applicable

## 7. QA Agent Instructions

- [x] 7.1 Write the nightshift-qa agent instruction file: receive validation criteria from task file, item row metadata, and dev agent's results, check each criterion independently, return per-criterion pass/fail with reasons, return overall pass/fail
- [x] 7.2 Document the qa agent's output contract: structured result with `criteria` array (each with `criterion`, `status`, `reason`), `overall_status` (pass/fail), and `summary` field

## 8. Template Files

- [x] 8.1 Create a manager.md template (used by `/nightshift-create`) with Shift Configuration (name, created date), Task Order (empty numbered list), and Progress (all zeros) sections — **inline in nightshift-create.md**
- [x] 8.2 Create a table.csv template (used by `/nightshift-create`) with just the `row` header column — **inline in nightshift-create.md**
- [x] 8.3 Create a task file template (used by `/nightshift-add-task`) with Configuration, Steps, and Validation section scaffolds — **inline in nightshift-add-task.md**

## 9. Validation and Testing

- [x] 9.1 Manually test `/nightshift-create` by creating a test shift, verify directory structure, manager.md content, and table.csv format
- [x] 9.2 Manually test `/nightshift-add-task` by adding a task to the test shift, verify task file format, table.csv column addition, and manager.md task order update
- [x] 9.3 Manually test `/nightshift-test-task` by running the added task on a single row, verify dev and qa agent invocation and result display
- [x] 9.4 Manually test `/nightshift-archive` by archiving the test shift, verify archive directory naming and file preservation
- [x] 9.5 Clean up test artifacts from `.nightshift/`
