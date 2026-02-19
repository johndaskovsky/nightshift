```
* .       .         .      * .    +
 _   _ _       _     _     ____  _     _  __ _    *
| \ | (_) __ _| |__ | |_  / ___|| |__ (_)/ _| |_  .
|  \| | |/ _` | '_ \| __| \___ \| '_ \| | |_| __|    (
| |\  | | (_| | | | | |_   ___) | | | | |  _| |_  *
|_| \_|_|\__, |_| |_|\__| |____/|_| |_|_|_|  \__|
       * |___/    .      +       .   *
```
[![npm version](https://img.shields.io/npm/v/@johndaskovsky/nightshift.svg)](https://www.npmjs.com/package/@johndaskovsky/nightshift)
[![downloads](https://img.shields.io/npm/dm/@johndaskovsky/nightshift.svg)](https://www.npmjs.com/package/@johndaskovsky/nightshift)

Long-running unsupervised agent framework

A batch processing framework for AI agents. Define a table of items, write task instructions, and let a two-agent system (manager, dev) work through them autonomously with built-in retries, self-improvement, and self-validation.

Nightshift runs inside [OpenCode](https://opencode.ai/) as a set of custom agents, commands, and skills. It is distributed as a TypeScript CLI installer (`nightshift init`) that scaffolds agent and command files into target projects.

## How It Works

A **shift** is a batch job. It contains a CSV table of items to process and one or more task definitions that describe what to do with each item. Two agents collaborate to execute the work:

- **Manager** -- reads shift state, picks the next item, delegates to dev, applies step improvements from successful dev agents, and reports progress. Writes `manager.md` and task files; reads `table.csv` for status information.
- **Dev** -- executes task steps on a single item, self-validates, retries up to 3 times, reports step improvement recommendations, and writes its own status to `table.csv` (`done` on success, `failed` on failure).

Each item-task moves through a state machine:

```
todo --> done
    \
     -> failed
```

## Prerequisites

- [OpenCode](https://opencode.ai/) AI assistant
- [qsv](https://github.com/dathere/qsv) CSV toolkit (required) -- install via `brew install qsv` or download from [GitHub releases](https://github.com/dathere/qsv/releases) for non-Homebrew platforms
- [flock](https://github.com/discoteq/flock) file locking utility (required) -- install via `brew install flock` or use the version bundled with `util-linux` on Linux

## Installation

Install the Nightshift CLI globally:

```bash
npm install -g @johndaskovsky/nightshift
```

Then initialize Nightshift in your project:

```bash
cd your-project
nightshift init
```

This creates the `.nightshift/` and `.opencode/` directories and writes the agent and command files.

To regenerate framework files after upgrading the CLI, run `nightshift init` again. It detects the existing installation and adjusts its output messaging accordingly. All framework-managed files are overwritten with the latest versions; shift data in `.nightshift/` is never touched.

## Quick Start

All commands run inside the OpenCode assistant.

### 1. Create a shift

```
/nightshift-create my-batch-job
```

This scaffolds `.nightshift/my-batch-job/` with a `manager.md` and an empty `table.csv`. Add data to the table. The items should have all of the metadata needed to process the tasks.

### 2. Add a task

```
/nightshift-add-task my-batch-job
```

The command asks you to describe what the agent should do, what tools it needs, step-by-step instructions, and how to verify success. It creates a task file (e.g., `create_page.md`) with three sections:

```markdown
## Configuration

- tools: playwright

## Steps

1. Navigate to {ENV:BASE_URL}{path}
2. Click the "Add Page" button
3. Fill in the title field with {page_title}
4. Click "Publish"
5. Save a screenshot to {SHIFT:FOLDER}screenshots/

## Validation

- Page exists at the expected URL
- Page title matches {page_title}
```

Steps use template variables that get substituted before execution. Three types are supported:

- `{column_name}` -- item data from `table.csv` (e.g., `{url}`, `{page_title}`)
- `{ENV:VAR_NAME}` -- values from the shift's `.env` file (e.g., `{ENV:BASE_URL}`, `{ENV:API_KEY}`)
- `{SHIFT:FOLDER}` / `{SHIFT:NAME}` / `{SHIFT:TABLE}` -- shift metadata (directory path, shift name, and table file path)

See [Template Variables](#template-variables) for details.

### 3. Add items to the table

```
/nightshift-update-table my-batch-job
```

Add rows with the metadata columns your tasks reference. The resulting `table.csv` looks like:

```csv
url,page_title,create_page
https://example.com/site1,Welcome,todo
https://example.com/site2,About Us,todo
https://example.com/site3,Contact,todo
```

Each task gets a status column initialized to `todo`.

### 4. Run the shift

```
/nightshift-start my-batch-job
```

The manager agent takes over: it reads the table, picks the next `todo` item, delegates to the dev agent, updates statuses, and loops until everything is `done` or `failed`.

### 5. Test a single task (optional)

```
/nightshift-test-task my-batch-job
```

Runs one task on one item through the dev agent **without modifying any state**. Useful for debugging task definitions before running a full shift.

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
| `/nightshift-test-task <name>` | Dry-run a single task on a single item |
| `/nightshift-archive <name>` | Move a completed shift to the archive |

All commands accept a shift name as an argument, or prompt interactively if omitted.

## Shift Structure

```
.nightshift/
  my-batch-job/
    manager.md          # Shift config: name, task order, progress counters
    table.csv           # Items and their per-task statuses
    .env                # Optional: environment variables for this shift (gitignored)
    create_page.md      # Task definition (Configuration, Steps, Validation)
    update_cms.md       # Another task definition
  archive/
    2026-02-08-old-job/ # Archived shift (date-prefixed)
```

### manager.md

Tracks task execution order and progress. Updated automatically by the manager agent.

```markdown
## Shift Configuration

- name: my-batch-job
- created: 2026-02-08
# - parallel: true
# - current-batch-size: 2
# - max-batch-size: 10

## Task Order

1. create_page
2. update_cms
```

The `parallel`, `current-batch-size`, and `max-batch-size` fields are optional. See [Parallel Execution](#parallel-execution) for details.

### table.csv

Each row is an item. Metadata columns hold the data tasks need. Status columns (one per task) track progress.

```csv
url,page_title,create_page,update_cms
https://example.com/site1,Welcome,done,done
https://example.com/site2,About Us,todo,todo
https://example.com/site3,Contact,todo,todo
```

Status values: `todo`, `done`, `failed`.

### Task files

Each task has three sections. Only the Steps section is modified during execution (by the dev agent's self-improvement loop).

| Section | Purpose | Mutable by Dev |
|---------|---------|----------------|
| Configuration | Declares tools and optional model | No |
| Steps | Numbered instructions with template variable substitution | Yes |
| Validation | Independently verifiable success criteria | No |

## Execution Details

### Item processing order

The manager iterates items in order, tasks in the order listed in `manager.md`. Tasks within an item are sequential -- task 2 cannot start until task 1 is `done`. A `failed` task blocks all subsequent tasks for that item.

### Dev agent retry loop

The dev agent gets up to 3 attempts per item (1 initial + 2 retries). On each attempt it:

1. Substitutes all template variables from the current item, environment, and shift metadata
2. Executes steps sequentially, stopping on failure
3. Identifies step improvement recommendations
4. Self-validates against the Validation criteria
5. Retries from scratch if self-validation fails and attempts remain
6. Writes its own status to `table.csv` (`done` on success, `failed` on failure)

Step improvement recommendations are reported back to the manager, which applies them to the task file. Only recommendations from successful dev executions are applied; failed executions' recommendations are discarded.

### Self-validation

The dev agent validates its own work against the task's Validation criteria after each attempt. All criteria must pass for the item to be marked `done`. If validation fails and retry attempts remain, the dev agent retries from scratch. After exhausting all attempts, the item is marked `failed`.

### Resumability

If a shift is interrupted, `/nightshift-start` picks up where it left off. There are no transient states to recover from -- items are either `todo` (available for dev processing), `done`, or `failed`. On resume, `todo` items are dispatched to dev and `done`/`failed` items are skipped.

### Graceful degradation

A single item failure never stops the entire shift. The manager marks the failed item and moves on to the next one.

### Parallel execution

By default, the manager processes one item at a time. To enable parallel processing, add `parallel: true` to the Shift Configuration section of `manager.md`:

```markdown
## Shift Configuration

- name: my-batch-job
- created: 2026-02-08
- parallel: true
```

In parallel mode, the manager dispatches multiple items concurrently for each task using adaptive batch sizing. Two optional fields control batch behavior:

| Field | Default | Description |
|-------|---------|-------------|
| `current-batch-size` | 2 | Initial batch size. Updated automatically after each batch. |
| `max-batch-size` | no cap | Upper bound on batch size growth. |

```markdown
## Shift Configuration

- name: my-batch-job
- created: 2026-02-08
- parallel: true
- current-batch-size: 4
- max-batch-size: 10
```

**Adaptive sizing:** The manager doubles the batch size after a fully successful batch and halves it (minimum 1) when any item fails. After each adjustment, the manager writes the new value back to `current-batch-size` in `manager.md`, so resumed shifts pick up where they left off.

Both `current-batch-size` and `max-batch-size` are ignored when `parallel` is not `true`. Invalid values (non-positive or non-numeric) are treated as omitted.

Parallelism applies only across items for a single task. Tasks within an item remain strictly sequential per the task order.

## Template Variables

Task steps support three types of placeholders, all resolved in a single pass before execution begins.

### Column placeholders: `{column_name}`

Reference any metadata column from `table.csv`. The column name must match a header in the table exactly.

```markdown
1. Navigate to {url}
2. Fill in the title with {page_title}
```

### Environment placeholders: `{ENV:VAR_NAME}`

Reference values from an optional `.env` file in the shift directory (`.nightshift/<shift-name>/.env`). Useful for credentials, API keys, and base URLs that should not be committed to version control.

```markdown
1. Authenticate with API key {ENV:API_KEY}
2. POST to {ENV:BASE_URL}/api/pages
```

The `.env` file uses standard dotenv format:

```
# Shift environment variables
BASE_URL=https://example.com
API_KEY=sk-1234-abcd
```

Shift `.env` files are gitignored via the `.nightshift/**/.env` pattern.

### Shift placeholders: `{SHIFT:FOLDER}` / `{SHIFT:NAME}` / `{SHIFT:TABLE}`

Reference shift-level metadata. Three variables are available:

- `{SHIFT:FOLDER}` -- the shift directory path (e.g., `.nightshift/my-batch-job/`)
- `{SHIFT:NAME}` -- the shift name (e.g., `my-batch-job`)
- `{SHIFT:TABLE}` -- the full path to the shift's `table.csv` (e.g., `.nightshift/my-batch-job/table.csv`)

```markdown
1. Save the output to {SHIFT:FOLDER}output/{SHIFT:NAME}-output.json
```

### Error handling

All placeholders use fail-fast behavior. A missing column value, undefined environment variable, or unrecognized shift variable causes the dev agent to report an error immediately rather than proceeding with an unresolved placeholder.

## Agent Permissions

| Agent | Write | Edit | Bash | Delegation | Playwright |
|-------|-------|------|------|------------|------------|
| Manager | yes | yes | `qsv`, `flock` | dev only | no |
| Dev | yes | yes | `mkdir`, `qsv`, `flock` | none | yes |

## Project Layout

```
night-shift/
  src/                  # TypeScript CLI source (init command)
  bin/                  # CLI entry script
  dist/                 # Compiled output (generated by build)
  templates/
    agents/             # Manager and dev agent instructions
    commands/           # Slash command definitions
  test/                 # Integration tests
  .nightshift/          # Active and archived shifts (in target projects)
  .opencode/
    command/            # OpenSpec slash commands (this project)
    skills/             # OpenSpec workflow skills (this project)
```

## License

MIT

