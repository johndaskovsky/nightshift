# AGENTS.md

## Project Overview

This is an AI agent orchestration framework called **Nightshift** — a batch processing system where a manager agent delegates work to dev and QA agents. The codebase contains no traditional source code; it is built entirely from Markdown, YAML, CSV, and JSONC configuration files that define agent behaviors, commands, specifications, and workflows.

**Runtime:** [OpenCode](https://opencode.ai/) AI assistant with custom agents, commands, and skills.
**Package manager:** pnpm.
**Spec framework:** OpenSpec (spec-driven development workflow).

## Build / Lint / Test Commands

There is no traditional build system, test framework, or linter. All execution happens through OpenCode slash commands and the OpenSpec CLI.

### Install dependencies

```bash
pnpm install
```

### Shift commands (run inside OpenCode)

| Command | Purpose |
|---------|---------|
| `/nightshift-create <name>` | Scaffold a new shift (manager.md + table.csv) |
| `/nightshift-add-task <name>` | Add a task to an existing shift |
| `/nightshift-update-table <name>` | Bulk modify table data |
| `/nightshift-start <name>` | Begin or resume shift execution |
| `/nightshift-test-task <name>` | Test a single task on one row (no state changes) |
| `/nightshift-archive <name>` | Archive a completed shift |

### Testing a single task

The closest equivalent to "running a single test" is:

```
/nightshift-test-task <shift-name>
```

This prompts you to select a task and row, invokes the dev agent, then the QA agent, and displays results **without modifying `table.csv`**.

### OpenSpec validation

```bash
openspec validate <change-name> --strict
openspec status --json
openspec list changes
```

## Repository Structure

```
night-shift/
├── opencode.jsonc                  # Root config: permissions, MCP servers
├── .nightshift/                    # Runtime shift data
│   ├── <shift-name>/               # Active shift directories
│   │   ├── manager.md              # Shift config (tasks, column mapping)
│   │   ├── table.csv               # Item tracking (row, columns, task statuses)
│   │   └── <task-name>.md          # Task definitions (config, steps, validation)
│   └── archive/                    # Completed shifts (date-prefixed)
├── .opencode/                      # OpenCode tooling config
│   ├── agent/                      # 3 subagent definitions
│   │   ├── nightshift-manager.md   # Orchestrator (delegates, tracks state)
│   │   ├── nightshift-dev.md       # Executor (runs steps, retries, self-improves)
│   │   └── nightshift-qa.md        # Verifier (read-only, checks validation)
│   ├── command/                    # Slash command definitions
│   │   ├── nightshift-*.md         # 6 Nightshift commands
│   │   └── opsx-*.md               # 10 OpenSpec commands
│   └── skills/                     # OpenSpec workflow skills
└── openspec/                       # Specification artifacts
    ├── config.yaml                 # OpenSpec schema config
    ├── project.md                  # Project context and conventions
    ├── specs/                      # Authoritative specifications
    └── changes/                    # Change tracking and archive
```

## Architecture

### Three-agent system with strict role separation

- **Manager** (`nightshift-manager`): Sole orchestrator. Reads state, delegates to dev/qa via Task tool, writes `table.csv`. Never executes task steps directly. Can only delegate to `nightshift-dev` and `nightshift-qa`.
- **Dev** (`nightshift-dev`): Executor. Follows task steps, self-improves step definitions, self-validates, retries up to 3 attempts. Has Playwright access and can create directories. Cannot delegate.
- **QA** (`nightshift-qa`): Verifier. Read-only — no write/edit permissions. Checks validation criteria independently. Has Playwright access for verification. Cannot delegate.

### Item state machine

```
todo → in_progress → qa → done
                  ↘       ↗
                   failed
```

Status values use snake_case: `todo`, `in_progress`, `qa`, `done`, `failed`.

### Key architectural rules

- Each agent invocation gets **fresh context** (no accumulated state).
- The manager is the **sole writer** of `table.csv`.
- The dev agent may only modify the Steps section of task files.
- Never stop the entire shift for a single item failure (graceful degradation).
- On startup, reset stale `in_progress` and `qa` statuses back to `todo`.

## Code Style Guidelines

### File and directory naming

- **kebab-case** for files and directories: `nightshift-dev.md`, `nightshift-commands/`
- **snake_case** for task names: `create_page`, `update_spreadsheet` (task names become CSV column names; hyphens conflict with qsv selectors)
- **Date-prefixed** for archived changes: `2026-02-08-add-nightshift-framework/`
- **Verb-led prefixes** for change IDs: `add-`, `update-`, `remove-`, `refactor-`

### Markdown conventions

- Use `-` for unordered lists (never `*`)
- Use `**bold**` (never `__bold__`)
- Single backticks for identifiers, file names, commands, and status values
- H2 (`##`) for top-level sections, H3 (`###`) for subsections
- One blank line before headings
- Triple-backtick code blocks with language identifier when applicable
- Pipe-delimited tables with alignment row (`|---|---|`)
- No emojis
- No hard line wrapping — paragraphs are single long lines

### YAML frontmatter

All command and agent `.md` files use YAML frontmatter:

```yaml
---
description: <one-line description>
---
```

Agent files additionally include `mode: subagent` and tool/permission blocks.

### JSONC formatting (opencode.jsonc)

Project-level `opencode.jsonc` uses standard JSONC conventions:

- 2-space indentation
- Trailing commas allowed
- `//` line comments for section labels (terse, descriptive)
- Double quotes (JSON standard)

Note: Nightshift does not manage or template `opencode.jsonc` for target projects. This section applies to the project's own configuration file.

### CSV conventions

- Header row required
- `row` as first column (sequential integer)
- Status columns named after tasks (snake_case — no hyphens, which conflict with qsv selectors)
- No quoting unless needed

### Specification style

Specs use BDD-style requirement/scenario format with RFC 2119 language:

```markdown
### Requirement: <title>
The system SHALL <normative statement>.

#### Scenario: <scenario name>
- **WHEN** <condition>
- **THEN** <expected behavior>
```

### Error handling patterns

- **Validate-first with early exit**: Check preconditions before proceeding; `STOP` on conflicts.
- **Bounded retry**: Dev agent retries up to 3 total attempts (1 initial + 2 retries).
- **Graceful degradation**: Never halt the batch for a single item failure.
- **Structured error reporting**: Use explicit `FAILED (step N)` or `FAILED (validation)` status.
- **Stale state recovery**: On startup, reset `in_progress`/`qa` items back to `todo`.
- **Confirmation for destructive ops**: Use `AskUserQuestion` before archiving incomplete shifts.

### Git workflow

- **Branch**: `main` (direct commits, no branching strategy)
- **Commit style**: Imperative mood (e.g., "Add December 2025 status reports")
- **Commit grouping**: Bundle related changes together
- **No force pushing**

## Permissions Reference (from opencode.jsonc)

| Agent | write | edit | bash | task delegation | playwright |
|-------|-------|------|------|-----------------|------------|
| Manager | yes | yes | denied | dev, qa only | no |
| Dev | yes | yes | `mkdir*` only | none | yes |
| QA | no | no | denied | none | yes |

Global bash allowlist: `mkdir*`, `test*`, `cat*`, `head*`, `xargs*`, `curl*`, `openspec list*`. All others require confirmation.
