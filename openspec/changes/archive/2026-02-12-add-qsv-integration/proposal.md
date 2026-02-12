## Why

Nightshift agents currently treat `table.csv` as raw text -- reading the entire file with the Read tool, mentally parsing CSV structure, and writing the full content back with Write/Edit. This approach is fragile for larger tables, error-prone when agents misparse column boundaries or quoting, and wasteful of context window on file content that could be queried precisely. [qsv](https://github.com/dathere/qsv) is a blazing-fast, full-featured CSV CLI toolkit that can select columns, filter rows, edit cells, count records, and validate structure -- all without loading the full file into the agent's context. Adding qsv as a recommended dependency gives agents structured, reliable CSV operations and reduces the chance of data corruption during table edits.

## What Changes

- Add `qsv` as an optional but strongly recommended external dependency for Nightshift.
- Document `qsv` installation via Homebrew in the README under prerequisites.
- Replace raw Read/Write CSV patterns in the manager agent with `qsv` CLI commands for reading, querying, and updating `table.csv`.
- Replace raw Read/Write CSV patterns in commands (`nightshift-add-task`, `nightshift-update-table`, `nightshift-start`, `nightshift-archive`, `nightshift-test-task`) with `qsv` CLI equivalents.
- Update the bash allowlist in agent/command definitions to permit `qsv` commands.
- Preserve the existing Read/Write fallback behavior so Nightshift still functions without `qsv` installed, but document that `qsv` is the preferred path.

## Capabilities

### New Capabilities

- `qsv-csv-operations`: Defines the qsv-based CLI patterns for reading, querying, filtering, and mutating CSV table data. Covers which qsv subcommands are used, how agents invoke them, and the fallback behavior when qsv is not installed.

### Modified Capabilities

- `nightshift-agents`: The manager agent's CSV Editing Rules change from Read/Write full-file to qsv CLI commands. The manager's bash allowlist adds `qsv*`. Dev and QA agents are unaffected (they never touch table.csv).
- `nightshift-commands`: Commands that read or modify `table.csv` (`nightshift-start`, `nightshift-add-task`, `nightshift-update-table`, `nightshift-archive`, `nightshift-test-task`) adopt qsv commands for CSV operations.
- `nightshift-shifts`: The table file format spec adds a note that `table.csv` should be qsv-compatible (standard RFC 4180 CSV), which it already is by convention but is now an explicit requirement.

## Impact

- **External dependency**: `qsv` (installed via Homebrew). Optional but strongly recommended.
- **Templates affected**: `templates/agents/nightshift-manager.md`, all six `templates/commands/nightshift-*.md` files.
- **Configuration**: `opencode.jsonc` bash allowlist gains `qsv*` for the manager agent.
- **README**: New prerequisite entry and installation instructions for qsv.
- **CLI installer**: `nightshift init` and `nightshift update` will write updated templates containing qsv instructions. The CLI package itself does not depend on qsv.
- **Backward compatibility**: Agents can fall back to Read/Write if qsv is not on PATH. No breaking changes.
