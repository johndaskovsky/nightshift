<!-- nightshift:start -->
## Nightshift

This project has [Nightshift](https://github.com/johndaskovsky/nightshift) installed for Claude Code. Nightshift is a long-running unsupervised batch agent framework. A **shift** is a batch job: a CSV table of items plus one or more task definitions describing what to do with each item. Two subagents collaborate to execute the work — `nightshift-manager` orchestrates, `nightshift-dev` executes one item at a time.

### Subagents

- `nightshift-manager` (`.claude/agents/nightshift-manager.md`) — orchestrates a shift. Reads `manager.md` and `table.csv`, picks the next `todo` item, delegates to `nightshift-dev`, applies step improvements. Restricted to spawning only `nightshift-dev` (no other subagents).
- `nightshift-dev` (`.claude/agents/nightshift-dev.md`) — executes the steps of a single task on a single item. Self-validates, retries up to 3 times, writes its own status to `table.csv`. Has a commented-out Playwright MCP example for browser automation; uncomment to enable.

### Skills

| Skill | Purpose |
|---|---|
| `/nightshift-create <name>` | Scaffold a new shift (manager.md + empty table.csv) |
| `/nightshift-add-task <name>` | Add a task definition to a shift |
| `/nightshift-update-table <name>` | Add rows, modify metadata, or reset failed items |
| `/nightshift-start <name>` | Begin or resume execution (forks into `nightshift-manager`) |
| `/nightshift-test-task <name>` | Dry-run one task on one item without state changes |
| `/nightshift-archive <name>` | Move a completed shift to `.nightshift/archive/YYYY-MM-DD-<name>/` |

All skills set `disable-model-invocation: true`, so Claude does not auto-invoke them — type `/skill-name` explicitly.

### Conventions

- **Shift names**: kebab-case (e.g., `create-promo-examples`).
- **Task names**: snake_case (e.g., `create_page`) — hyphens conflict with qsv column selectors.
- **Status values**: `todo`, `done`, `failed`. The dev subagent writes its own status; the manager never writes status transitions.
- **CSV operations**: always use `flock -x table.csv qsv …` — never read or write `table.csv` with the Read/Write/Edit tools directly.

### Prerequisites

- [`qsv`](https://github.com/dathere/qsv) — `brew install qsv`
- [`flock`](https://github.com/discoteq/flock) — `brew install flock`

### Reference

See <https://github.com/johndaskovsky/nightshift#readme> for the complete framework documentation.
<!-- nightshift:end -->
