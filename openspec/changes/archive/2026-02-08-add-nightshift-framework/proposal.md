## Why

Agent-driven automation in this repository currently works well for short, interactive tasks (report generation, OpenSpec changes, ticket research). However, there is no structured way to run long, unsupervised agent work — processing dozens or hundreds of items through multi-step workflows where each item needs independent execution, quality verification, and progress tracking. Without a framework, long-running batch work is ad-hoc, hard to resume after failures, and lacks visibility into what completed, what failed, and what remains.

## What Changes

- Add a new **Nightshift** framework for defining and executing long-running unsupervised agent shifts
- Add a `.nightshift/` directory structure at the repository root for shift definitions and archives
- Add **6 OpenCode slash commands** for shift lifecycle management:
  - `/nightshift-create` — scaffold a new shift with manager, table, and task files
  - `/nightshift-start` — begin or resume executing a shift
  - `/nightshift-archive` — move a completed shift to the archive
  - `/nightshift-add-task` — add a task to an existing shift
  - `/nightshift-test-task` — run a single task on a single table row for testing
  - `/nightshift-update-table` — make bulk changes to the shift table
- Add **3 subagent definitions** for shift execution:
  - `nightshift-manager` — orchestrates shift execution, delegates work to dev and qa agents, tracks state
  - `nightshift-dev` — executes task steps against table items, iterates based on validation failures, captures learnings
  - `nightshift-qa` — verifies task completion against validation criteria, reports pass/fail
- Add a **standardized file format** for shift components:
  - `manager.md` — task execution order, shift-level configuration, progress summary
  - `table.csv` — item table with metadata columns and per-task status columns (todo, in progress, qa, complete)
  - `<task-name>.md` — task definitions with configuration (tools, model), steps (detailed instructions), and validation criteria

## Capabilities

### New Capabilities

- `nightshift-shifts`: Shift lifecycle management — creating, starting, resuming, and archiving shifts. Covers the `.nightshift/` directory structure, shift state tracking, and the manager/table/task file formats.
- `nightshift-tasks`: Task definition and execution — the standardized task file format (configuration, steps, validation), single-item test runs, and the dev/qa agent loop for processing items.
- `nightshift-commands`: OpenCode slash commands for interacting with shifts — create, start, archive, add-task, test-task, update-table.
- `nightshift-agents`: Subagent definitions and orchestration — manager, dev, and qa agent roles, delegation patterns, and how agents coordinate during shift execution.

### Modified Capabilities

None. This is a new standalone framework with no changes to existing specs.

## Impact

- **New directory**: `.nightshift/` at repository root (with `/archive` subdirectory)
- **New OpenCode commands**: 6 command files in `.opencode/command/`
- **New OpenCode agents**: 3 agent definitions in `opencode.jsonc`
- **New OpenCode skills**: Possible skill files in `.opencode/skills/` for agent instructions
- **Dependencies**: Relies on existing MCP tools (Playwright, Slack, JIRA, Google Workspace) — tasks will reference these tools in their configuration sections
- **No changes to existing scripts or workflows** — Nightshift is additive only
