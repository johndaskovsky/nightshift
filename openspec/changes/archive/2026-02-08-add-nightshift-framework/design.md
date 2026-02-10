## Context

This repository uses OpenCode with slash commands (`.opencode/command/*.md`) and subagent definitions (`opencode.jsonc`) to drive agent-assisted workflows. The existing pattern — seen in OpenSpec commands (`/opsx:*`) and report agents (`report-project`, `report-people`) — provides a proven template for structuring Nightshift.

Currently, long-running batch work (e.g., creating example pages across dozens of CMS components) is done ad-hoc with no standard structure for tracking progress, resuming after failures, or separating execution from verification. The `add-brightspot-promo-examples` change demonstrated this pain point: a partially-completed batch with no clean way to resume.

Nightshift introduces a framework where a **shift** is a self-contained unit of batch work, a **table** defines the items to process, and **tasks** define the work to perform on each item.

## Goals / Non-Goals

**Goals:**

- Provide a standard directory and file structure for defining batch agent work
- Enable unsupervised execution with progress tracking and resumability
- Separate concerns: manager orchestrates, dev executes, qa verifies
- Make it easy to test a task on a single item before running a full shift
- Track per-item, per-task status in a CSV table that's human-readable and diff-friendly
- Follow existing OpenCode patterns (commands as markdown files, agents in `opencode.jsonc`)

**Non-Goals:**

- Real-time monitoring UI or dashboard — progress is tracked in the CSV file
- Parallel agent execution — shifts process items sequentially (one at a time)
- Cross-shift dependencies — each shift is independent
- Retry policies or exponential backoff — failed items are marked and can be manually re-queued
- Custom agent models per shift — agents use whatever model OpenCode is configured with (tasks can suggest a model but enforcement is not in scope)

## Decisions

### 1. `.nightshift/` at repository root for shift storage

**Decision:** Store shifts in `.nightshift/` at the repo root, mirroring how `.opencode/` stores agent config.

**Alternatives considered:**
- Inside `openspec/` — rejected because Nightshift is not an OpenSpec concern; it's a runtime execution framework
- Inside `Notes/` — rejected because shifts are operational artifacts, not knowledge management

**Rationale:** A dotfile directory signals "tooling infrastructure" and keeps it out of the Obsidian vault. The archive subdirectory (`.nightshift/archive/`) follows the same pattern as `openspec/changes/archive/`.

### 2. CSV for the item table (not Markdown tables or JSON)

**Decision:** Use `table.csv` as the canonical data format for shift items.

**Alternatives considered:**
- Markdown table — harder to parse programmatically, painful to edit with many columns
- JSON array — not human-readable at a glance, poor diff experience
- SQLite — overkill for this scale, not human-editable

**Rationale:** CSV is natively supported by spreadsheet tools, easy to parse in scripts, produces clean git diffs, and is readable in both raw form and rendered views. The table needs a `row` column (sequential integer), metadata columns for task context, and one status column per task.

### 3. Task files as structured Markdown with three sections

**Decision:** Each task file (`<task-name>.md`) uses three mandatory sections: Configuration, Steps, Validation.

```
## Configuration
- tools: playwright, google_workspace
- model: (suggested, not enforced)

## Steps
1. Navigate to...
2. Click...
3. Capture...

## Validation
- Page exists at expected URL
- Spreadsheet cell contains CMS edit URL
```

**Alternatives considered:**
- YAML frontmatter + Markdown body — adds parsing complexity for minimal benefit
- Separate config file per task — too many files for a simple structure

**Rationale:** Markdown with clear section headers is consistent with how OpenSpec artifacts and OpenCode commands are structured in this repo. The three sections map directly to the agent concerns: configuration tells the dev agent what tools it needs, steps tell it what to do, validation tells the qa agent what to check.

### 4. Manager file as the execution manifest

**Decision:** `manager.md` defines which tasks run in what order, plus shift-level configuration.

```
## Shift Configuration
- name: create-promo-examples
- created: 2026-02-08

## Task Order
1. create-page
2. add-module
3. update-spreadsheet

## Progress
- Total items: 45
- Completed: 12
- Failed: 2
- Remaining: 31
```

**Alternatives considered:**
- Implicit ordering from filenames (alphabetical) — fragile and unclear
- A separate `config.yaml` — adds another file format to manage

**Rationale:** A single Markdown file that the manager agent reads to understand the shift. The progress section is updated by the manager agent during execution, providing at-a-glance status.

### 5. Three subagents with clear role separation

**Decision:** Three agents — `nightshift-manager`, `nightshift-dev`, `nightshift-qa` — each with scoped tool access.

| Agent | Role | Key Tools |
|-------|------|-----------|
| `nightshift-manager` | Reads manager.md and table.csv, picks next item/task, delegates to dev/qa, updates status | read, write, edit, task |
| `nightshift-dev` | Executes task steps on a single item, reports results | read, write, edit, glob, grep + MCP tools per task config |
| `nightshift-qa` | Reads validation criteria, verifies dev's work, reports pass/fail | read, glob, grep + MCP tools per task config |

**Alternatives considered:**
- Single agent doing everything — no separation of concerns, harder to debug failures
- Two agents (dev + qa combined) — loses the quality gate that makes unsupervised work trustworthy

**Rationale:** The manager/dev/qa pattern mirrors a real team structure. The manager never executes tasks directly — it delegates. The dev never marks its own work as complete — qa verifies. This separation is critical for unsupervised reliability.

### 6. Status column values in table.csv

**Decision:** Each task gets a status column with values: `todo`, `in_progress`, `qa`, `done`, `failed`.

**Flow:** `todo` → `in_progress` (dev working) → `qa` (dev done, awaiting verification) → `done` (qa passed) or `failed` (qa rejected, needs retry or manual intervention).

**Alternatives considered:**
- Boolean done/not-done — insufficient for debugging and resumption
- Separate status file — splits state across multiple files

**Rationale:** Embedding status in the CSV keeps all item state in one place. The manager reads the CSV to determine what work remains. On resume, it scans for `todo` and `failed` items.

### 7. Commands as OpenCode slash commands (not scripts)

**Decision:** All 6 Nightshift commands are implemented as `.opencode/command/nightshift-*.md` files.

**Alternatives considered:**
- zx scripts in `scripts/` — would need separate CLI invocation, not integrated with agent workflow
- OpenSpec skills — wrong abstraction; these are user-facing commands, not agent behaviors

**Rationale:** Slash commands are the standard user interface in this repo for agent-driven workflows. They integrate with the conversation context and can invoke subagents via the Task tool.

## Risks / Trade-offs

**[CSV corruption on concurrent writes]** → Mitigation: Sequential processing only. Manager is the single writer for status updates. Dev and qa report results back to manager, which updates the CSV.

**[Long-running shifts may hit context limits]** → Mitigation: Manager delegates each item as a fresh subagent task. The dev and qa agents process one item at a time with a clean context, receiving only the task instructions and item metadata — not the full shift history.

**[Task steps may need iteration after failures]** → Mitigation: Dev agent captures learnings in its session. The task file's Steps section can include conditional branches and error handling notes. Failed items are marked `failed` for manual review or re-queuing.

**[Model cost for large shifts]** → Trade-off accepted. Processing 100 items through 3 tasks each means ~300 agent invocations. This is the expected use case. Users can test with `/nightshift-test-task` before committing to a full run.

**[Resumability depends on CSV state accuracy]** → Mitigation: Manager updates CSV status atomically (one row at a time, immediately after each state transition). If a shift is interrupted mid-item, the item remains `in_progress` and can be detected on resume.

## Open Questions

- Should the manager agent maintain a log file (e.g., `shift-log.md`) with timestamped entries for debugging, or is the CSV status sufficient?
- Should `/nightshift-start` support a `--dry-run` flag that shows what would be processed without executing?
- How should the dev agent handle tasks that require tools not currently enabled in `opencode.jsonc`? Warn and skip, or fail the item?
