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

A batch processing framework for AI agents. Define a table of items, write task instructions, and let a manager-plus-dev system work through them autonomously with built-in retries, self-improvement, and self-validation.

Nightshift runs inside [Claude Code](https://code.claude.com/) as a `nightshift-manager` subagent that dispatches dev work as fresh top-level `claude -p` subprocesses. **Dev subprocesses inherit your full user-level MCP configuration** — any MCP you've installed in Claude Code (Slack, Drive, Playwright, internal company MCPs) is automatically available to every Nightshift task. It's distributed as a TypeScript CLI installer (`nightshift init`) and as a Claude Code Plugin for native plugin discovery.

## How It Works

A **shift** is a batch job. It contains a CSV table of items to process and one or more task definitions that describe what to do with each item. Two roles collaborate to execute the work:

- **Manager** (a Claude Code subagent) -- reads shift state, picks the next item, dispatches dev work as a `claude -p` subprocess via the bundled `dispatch-batch.sh` helper, applies step improvements from successful dev runs (unless `disable-self-improvement: true` is set), and reports progress. Writes `manager.md` and task files; reads `table.csv` for status information.
- **Dev** (a fresh top-level Claude session per item) -- executes task steps on a single item, self-validates, retries up to 3 times, reports step improvement recommendations (unless self-improvement is disabled), and writes its own status to `table.csv` (`done` on success, `failed` on failure). Because each dev runs as a top-level `claude -p` subprocess, it sees every user-configured MCP without any Nightshift-specific setup.

Each item-task moves through a state machine:

```
todo --> done
    \
     -> failed
```

## Prerequisites

- [Claude Code](https://code.claude.com/) v2.1.83 or later (for `--permission-mode auto`; see the [Permission mode](#permission-mode) section for the fallback path on older versions or non-eligible plans).
- [qsv](https://github.com/dathere/qsv) CSV toolkit (required) -- install via `brew install qsv` or download from [GitHub releases](https://github.com/dathere/qsv/releases) for non-Homebrew platforms
- [flock](https://github.com/discoteq/flock) file locking utility (required) -- install via `brew install flock` or use the version bundled with `util-linux` on Linux
- [jq](https://stedolan.github.io/jq/) JSON processor (required by `dispatch-batch.sh`) -- install via `brew install jq`

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

The CLI scaffolds `.claude/agents/`, `.claude/skills/`, `.claude/settings.json` (merged), and a project `CLAUDE.md` (merged via `<!-- nightshift:start -->` / `<!-- nightshift:end -->` markers), alongside the `.nightshift/` shift data directory.

To regenerate framework files after upgrading the CLI, run `nightshift init` again. It detects the existing installation and adjusts its output messaging accordingly. All framework-managed files are overwritten with the latest versions; shift data in `.nightshift/` is never touched.

### Alternative: Claude Code Plugin

The npm package also publishes a Claude Code Plugin manifest. If you prefer plugin-style distribution over the CLI installer, you can install Nightshift via Claude Code's plugin discovery (no `nightshift init` step needed). The plugin bundles the same subagent and skill files; project-scoped installs from `nightshift init` will override plugin-supplied files per [Claude Code's precedence rules](https://code.claude.com/docs/en/skills#where-skills-live).

> ⚠️ Don't run both at once: if you install Nightshift as a plugin **and** also run `nightshift init` in the same project, you'll have two copies of the skills. The CLI prints a warning when it detects a likely Nightshift plugin reference in `~/.claude/settings.json`.

### First-run note for Claude Code users

Claude Code watches skill directories for changes during a session, but creating a top-level `.claude/skills/` directory that did not exist when the session started requires restarting Claude Code. If you ran `nightshift init` while Claude Code was already running, restart it so the new skills are discovered.

## Quick Start

All commands run inside Claude Code.

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
# - disable-self-improvement: true

## Task Order

1. create_page
2. update_cms
```

The `parallel`, `current-batch-size`, `max-batch-size`, and `disable-self-improvement` fields are optional. See [Parallel Execution](#parallel-execution) and [Self-Improvement](#self-improvement) for details.

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

### Self-improvement

By default, after each successful dev execution the manager reviews the dev's step improvement recommendations and applies them to the task file. This incremental refinement improves execution reliability over time as the manager learns from each item.

To disable this cycle, add `disable-self-improvement: true` to the Shift Configuration section of `manager.md`:

```markdown
## Shift Configuration

- name: my-batch-job
- created: 2026-02-08
- disable-self-improvement: true
```

When the flag is `true`:
- The manager skips the Apply Step Improvements step after each dev result
- The dev agent skips the Identify Recommendations step and always returns `Recommendations: None`

This is useful for shifts with mature, stable task files where the self-improvement cycle adds token overhead without meaningful benefit. Omitting the flag (or setting it to `false`) restores the default behavior.

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
| Dev | yes | yes | `mkdir`, `qsv`, `flock` | none | optional (see below) |

### MCP access (Playwright, Slack, Drive, custom MCPs)

Nightshift dev work runs as a top-level `claude -p` subprocess, so it automatically inherits every MCP you have configured at the user level in Claude Code. **No Nightshift-specific MCP setup is required.** If you have a Playwright MCP, a Slack MCP, an internal company MCP, etc. installed globally, your Nightshift tasks can use them — just reference the relevant tools in your task file's `## Configuration` `tools:` line and the dev process will use them on each invocation.

To enable Playwright specifically, install the standard Playwright MCP at the user level per Claude Code's MCP setup docs. Subsequent shifts will pick it up automatically.

### Permission mode

The manager probes Claude Code's `--permission-mode auto` on each shift start and uses it when available. Auto mode reduces permission prompts while keeping classifier-driven safety guardrails (no privilege escalation, no force-push, no mass deletion, etc.). See <https://code.claude.com/docs/en/permission-modes> for the full contract.

**Auto mode requires:**

- Claude Code v2.1.83 or later
- A Max, Team, Enterprise, or API plan (not Pro)
- An eligible Sonnet 4.6, Opus 4.6, or Opus 4.7 model
- The Anthropic API provider (not Bedrock, Vertex, or Foundry)

If your environment doesn't qualify, the manager transparently falls back to `--permission-mode bypassPermissions` and prints a one-line notice in the shift's final summary. The fallback skips the classifier guardrails — tasks run with full tool access — so review your task definitions before kicking off shifts under fallback mode.

### Real-time observability

Each dev subprocess streams its work to `.nightshift/<shift>/logs/<item-id>-<task>-<timestamp>.jsonl`. While a shift is running, you can `tail -f` any log to watch a single dev process think in real time:

```bash
tail -f .nightshift/my-shift/logs/3-create_page-*.jsonl | jq .
```

Logs persist after the shift completes (handy for post-mortem). They are gitignored by default.

## Multi-repo shifts

Nightshift can target a different repository per item. Three optional fields in the task `## Configuration` section control where and how each dev subprocess runs:

- **`working_dir: <path-or-placeholder>`** — the directory each dev subprocess `cd`s into before running. Supports the same placeholder syntax as task steps (`{column}`, `{ENV:VAR}`, `{SHIFT:FOLDER|NAME|TABLE}`), so per-item paths come from a `table.csv` column.
- **`worktree: true`** — when set, the subprocess runs inside a git worktree of `working_dir` on a unique branch (`worktree-ns-<shift>-<item>-<task>-<timestamp>`). Each item gets its own isolated checkout — parallel items targeting the same repo don't clobber each other.
- **`model: <name>`** — pass a specific Claude Code model (`haiku`, `sonnet`, `opus`, or a full model ID) for this task. Useful for cost control: mechanical tasks can run on `haiku`.

### Example: refactor across 3 repos in parallel

Task definition (`.nightshift/dep-bump/upgrade.md`):

```markdown
## Configuration

- tools: bash
- model: sonnet
- working_dir: {repo_path}
- worktree: true

## Steps

1. Run `pnpm install` to refresh the lockfile
2. Run `pnpm test` to confirm the suite still passes
3. Commit the lockfile change with `git commit -am "chore: refresh lockfile"`

## Validation

- `pnpm test` exit code is 0
- A new commit exists on the current branch with message starting `chore: refresh lockfile`
```

Table (`.nightshift/dep-bump/table.csv`):

```csv
row,repo_path,name,upgrade
1,/Users/you/project-a,Project A,todo
2,/Users/you/project-b,Project B,todo
3,/Users/you/project-c,Project C,todo
```

`manager.md` enables parallel mode:

```markdown
## Shift Configuration

- name: dep-bump
- parallel: true
- current-batch-size: 3
- max-batch-size: 3

## Task Order

1. upgrade
```

### One-time workspace-trust setup

Claude Code requires you to accept its **workspace-trust dialog** in each new directory before `--worktree` works there. Do this once per target repo before starting a worktree-using shift:

```bash
for d in /Users/you/project-a /Users/you/project-b /Users/you/project-c; do
  (cd "$d" && claude)  # accept the trust dialog, then exit immediately
done
```

Trust is stored in `~/.claude.json` and persists indefinitely. The manager runs a pre-flight check before dispatching and aborts with a clear remediation message if any directory isn't trusted yet — so you'll know exactly which `(cd ... && claude)` invocations are still needed.

The trust prerequisite **only applies when `worktree: true`**. Tasks using `working_dir` alone (no worktree) skip the trust check.

### Shipping `.env` into worktrees

By default, a fresh git worktree doesn't have your repo's gitignored files (like `.env` or `.env.local`). Claude Code reads a `.worktreeinclude` file at your repo root and copies the listed gitignored files into each new worktree:

```text
# .worktreeinclude in your project root
.env
.env.local
config/secrets.json
```

See the [Claude Code worktree docs](https://code.claude.com/docs/en/worktrees#copy-gitignored-files-into-worktrees) for the full contract.

### Cleanup

Worktrees are cleaned up automatically when the dev subprocess exits successfully and leaves no uncommitted state. If the dev fails or leaves uncommitted changes, the worktree is preserved for inspection and listed in the shift's final summary. Clean up manually with:

```bash
(cd <working_dir> && git worktree remove --force .claude/worktrees/<name>)
```

Add `.claude/worktrees/` to each target repo's `.gitignore` so worktree contents don't appear as untracked files in the main checkout.

## Project Layout

```
night-shift/
  src/                       # TypeScript CLI source (init command)
  bin/                       # CLI entry script
  dist/                      # Compiled output (generated by build)
  templates/
    claude/
      agents/                # Claude Code subagent definitions
      skills/                # Claude Code skill directories (SKILL.md + scripts/)
      CLAUDE.md              # CLAUDE.md template fragment
      settings.json          # .claude/settings.json template fragment
  .claude-plugin/            # Claude Code Plugin manifest
  agents/                    # (build output) plugin-bundled subagents
  skills/                    # (build output) plugin-bundled skills
  test/                      # Integration tests (init + shift execution)
  .nightshift/               # Active and archived shifts (in target projects)
```

## License

MIT

