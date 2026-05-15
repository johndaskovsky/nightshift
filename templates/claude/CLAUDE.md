<!-- nightshift:start -->
## Nightshift

This project has [Nightshift](https://github.com/johndaskovsky/nightshift) installed for Claude Code. Nightshift is a long-running unsupervised batch agent framework. A **shift** is a batch job: a CSV table of items plus one or more task definitions describing what to do with each item.

### Architecture (Nightshift 3.x)

- **`nightshift-manager` subagent** (`.claude/agents/nightshift-manager.md`) — orchestrates a shift. Reads `manager.md` and `table.csv`, picks the next `todo` item, dispatches dev work as a `claude -p` subprocess via the bundled `dispatch-batch.sh` helper, applies step improvements. Has no `Agent` tool — cannot delegate to other subagents.
- **`nightshift-do-task` skill** (`.claude/skills/nightshift-do-task/SKILL.md`) — executes one task on one item. Invoked by the manager as a top-level `claude -p` subprocess so it inherits every user-configured MCP (Slack, Drive, Playwright, internal MCPs, etc.) without any per-task setup. Self-validates, retries up to 3 times, writes its own status to `table.csv`, and emits a structured JSON result event.
- **`dispatch-batch.sh`** (`.claude/skills/nightshift-start/scripts/dispatch-batch.sh`) — bundled helper that spawns N concurrent `claude -p` processes for parallel batches (or one for serial), parses each result event, and emits a consolidated JSON document for the manager.

### Skills

| Skill | Purpose |
|---|---|
| `/nightshift-create <name>` | Scaffold a new shift (manager.md + empty table.csv) |
| `/nightshift-add-task <name>` | Add a task definition to a shift |
| `/nightshift-update-table <name>` | Add rows, modify metadata, or reset failed items |
| `/nightshift-start <name>` | Begin or resume execution (forks into `nightshift-manager`) |
| `/nightshift-test-task <name>` | Dry-run one task on one item without state changes (uses `--read-only`) |
| `/nightshift-archive <name>` | Move a completed shift to `.nightshift/archive/YYYY-MM-DD-<name>/` |
| `/nightshift-do-task <shift> <task> <id> [--read-only]` | Internal — invoked by the manager as a subprocess; runs one task on one item |

All skills set `disable-model-invocation: true`, so Claude does not auto-invoke them — type `/skill-name` explicitly.

### Multi-repo shifts (3.1.0+)

Tasks can target a different repository per item via `working_dir: {repo_path}` in `## Configuration` (with a `repo_path` column in `table.csv`). Add `worktree: true` to isolate each run in its own git worktree on a unique branch. Add `model: haiku|sonnet|opus` to pick a model per task. See the project README for the full recipe.

### MCP access

Dev subprocesses inherit your **top-level Claude Code MCP configuration**. To make Playwright (or Slack, Drive, any other MCP) available to Nightshift task steps, configure it once at the user level — no Nightshift-specific setup is needed.

### Permission mode

The manager probes for `--permission-mode auto` availability on each shift start and uses it when available; otherwise it falls back to `--permission-mode bypassPermissions`. Auto mode requires Claude Code v2.1.83+, a Max/Team/Enterprise/API plan, an eligible Sonnet/Opus model, and the Anthropic API provider — see <https://code.claude.com/docs/en/permission-modes>.

### Conventions

- **Shift names**: kebab-case (e.g., `create-promo-examples`).
- **Task names**: snake_case (e.g., `create_page`) — hyphens conflict with qsv column selectors.
- **Item IDs**: the value of the `row` column (typically a sequential integer; can be any unique string).
- **Status values**: `todo`, `done`, `failed`. Dev subprocesses write their own status; the manager never writes status transitions.
- **CSV operations**: always use `flock -x table.csv qsv …` — never read or write `table.csv` with the Read/Write/Edit tools directly.

### Observability

Each dev subprocess writes its stream-json output to `.nightshift/<shift>/logs/<item-id>-<task>-<timestamp>.jsonl`. While a shift is running, `tail -f` any log file to watch a dev work in real time. Logs are gitignored.

### Prerequisites

- [`qsv`](https://github.com/dathere/qsv) — `brew install qsv`
- [`flock`](https://github.com/discoteq/flock) — `brew install flock`
- [`jq`](https://stedolan.github.io/jq/) — required by `dispatch-batch.sh`. `brew install jq`

### Reference

See <https://github.com/johndaskovsky/nightshift#readme> for the complete framework documentation.
<!-- nightshift:end -->
