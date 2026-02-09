* .       .         .      * .    +
 _   _ _       _     _     ____  _     _  __ _    *
| \ | (_) __ _| |__ | |_  / ___|| |__ (_)/ _| |_  .
|  \| | |/ _` | '_ \| __| \___ \| '_ \| | |_| __|    (
| |\  | | (_| | | | | |_   ___) | | | | |  _| |_  *
|_| \_|_|\__, |_| |_|\__| |____/|_| |_|_|_|  \__|
       * |___/    .      +       .   *

Long-running unsupervised agent framework

A batch processing framework for AI agents. Define a table of items, write task instructions, and let a three-agent system (manager, dev, QA) work through them autonomously with built-in retries, self-improvement, and independent verification.

Nightshift runs inside [OpenCode](https://opencode.ai/) as a set of custom agents, commands, and skills. There is no traditional source code -- the entire framework is defined through Markdown, CSV, YAML, and JSONC configuration files.

## How It Works

A **shift** is a batch job. It contains a CSV table of items to process and one or more task definitions that describe what to do with each item. Three agents collaborate to execute the work:

- **Manager** -- reads shift state, picks the next item, delegates to dev and QA, updates statuses. The sole writer of `table.csv`.
- **Dev** -- executes task steps on a single item, self-validates, retries up to 3 times, and refines task steps for future items.
- **QA** -- independently verifies the dev's work against validation criteria. Strictly read-only.

Each item-task moves through a state machine:

```
todo --> in_progress --> qa --> done
                    \         /
                     -> failed
```

## Prerequisites

- [OpenCode](https://opencode.ai/) AI assistant
- [Bun](https://bun.sh/) package manager

```bash
cd .opencode && bun install
```

## Quick Start

All commands run inside the OpenCode assistant.

### 1. Create a shift

```
/nightshift-create my-batch-job
```

This scaffolds `.nightshift/my-batch-job/` with a `manager.md` and an empty `table.csv`.

### 2. Add a task

```
/nightshift-add-task my-batch-job
```

The command asks you to describe what the agent should do, what tools it needs, step-by-step instructions, and how to verify success. It creates a task file (e.g., `create-page.md`) with three sections:

```markdown
## Configuration

- tools: playwright

## Steps

1. Navigate to {url}
2. Click the "Add Page" button
3. Fill in the title field with {page_title}
4. Click "Publish"

## Validation

- Page exists at the expected URL
- Page title matches {page_title}
```

Steps use `{column_name}` placeholders that get substituted with each row's data at execution time.

### 3. Add items to the table

```
/nightshift-update-table my-batch-job
```

Add rows with the metadata columns your tasks reference. The resulting `table.csv` looks like:

```csv
row,url,page_title,create-page
1,https://example.com/site1,Welcome,todo
2,https://example.com/site2,About Us,todo
3,https://example.com/site3,Contact,todo
```

Each task gets a status column initialized to `todo`.

### 4. Run the shift

```
/nightshift-start my-batch-job
```

The manager agent takes over: it reads the table, picks the next `todo` item, delegates to the dev agent, sends successful results to QA, updates statuses, and loops until everything is `done` or `failed`.

### 5. Test a single task (optional)

```
/nightshift-test-task my-batch-job
```

Runs one task on one row through both dev and QA agents **without modifying any state**. Useful for debugging task definitions before running a full shift.

### 6. Archive a completed shift

```
/nightshift-archive my-batch-job
```

Moves the shift to `.nightshift/archive/YYYY-MM-DD-my-batch-job/`.

## Commands Reference

| Command | Purpose |
|---------|---------|
| `/nightshift-create <name>` | Scaffold a new shift directory with manager.md and table.csv |
| `/nightshift-add-task <name>` | Add a task definition to an existing shift |
| `/nightshift-update-table <name>` | Add rows, update metadata, or reset failed items |
| `/nightshift-start <name>` | Begin or resume shift execution |
| `/nightshift-test-task <name>` | Dry-run a single task on a single row |
| `/nightshift-archive <name>` | Move a completed shift to the archive |

All commands accept a shift name as an argument, or prompt interactively if omitted.

## Shift Structure

```
.nightshift/
  my-batch-job/
    manager.md          # Shift config: name, task order, progress counters
    table.csv           # Items and their per-task statuses
    create-page.md      # Task definition (Configuration, Steps, Validation)
    update-cms.md       # Another task definition
  archive/
    2026-02-08-old-job/ # Archived shift (date-prefixed)
```

### manager.md

Tracks task execution order and progress. Updated automatically by the manager agent.

```markdown
## Shift Configuration

- name: my-batch-job
- created: 2026-02-08

## Task Order

1. create-page
2. update-cms

## Progress

- Total items: 3
- Completed: 1
- Failed: 0
- Remaining: 2
```

### table.csv

Each row is an item. Metadata columns hold the data tasks need. Status columns (one per task) track progress.

```csv
row,url,page_title,create-page,update-cms
1,https://example.com/site1,Welcome,done,in_progress
2,https://example.com/site2,About Us,todo,todo
3,https://example.com/site3,Contact,todo,todo
```

Status values: `todo`, `in_progress`, `qa`, `done`, `failed`.

### Task files

Each task has three sections. Only the Steps section is modified during execution (by the dev agent's self-improvement loop).

| Section | Purpose | Mutable by Dev |
|---------|---------|----------------|
| Configuration | Declares tools and optional model | No |
| Steps | Numbered instructions with `{placeholder}` substitution | Yes |
| Validation | Independently verifiable success criteria | No |

## Execution Details

### Item processing order

The manager iterates rows in order, tasks in the order listed in `manager.md`. Tasks within a row are sequential -- task 2 cannot start until task 1 is `done`. A `failed` task blocks all subsequent tasks for that row.

### Dev agent retry loop

The dev agent gets up to 3 attempts per item (1 initial + 2 retries). On each attempt it:

1. Substitutes `{placeholder}` values from the current row
2. Executes steps sequentially, stopping on failure
3. Refines the Steps section based on what it learned
4. Self-validates against the Validation criteria
5. Retries from scratch if self-validation fails and attempts remain

Step refinements persist to the task file, so subsequent items benefit from earlier learnings.

### QA verification

After a successful dev execution, the QA agent independently checks every validation criterion using read-only tools (file reads, grep, Playwright). It reports per-criterion pass/fail with specific evidence. All criteria must pass for `done`; any failure means `failed`.

### Resumability

If a shift is interrupted, `/nightshift-start` picks up where it left off. The manager resets any stale `in_progress` or `qa` statuses back to `todo` on startup, then continues processing remaining items.

### Graceful degradation

A single item failure never stops the entire shift. The manager marks the failed item and moves on to the next one.

## Agent Permissions

| Agent | Write | Edit | Bash | Delegation | Playwright |
|-------|-------|------|------|------------|------------|
| Manager | yes | yes | denied | dev, qa only | no |
| Dev | yes | yes | `mkdir` only | none | yes |
| QA | no | no | denied | none | yes |

## Project Layout

```
night-shift/
  opencode.jsonc        # Agent definitions and permissions
  .nightshift/          # Active and archived shifts
  .opencode/
    agent/              # Manager, dev, and QA agent instructions
    command/            # Slash command definitions
    skills/             # OpenSpec workflow skills
  openspec/             # Specifications and change tracking
```

