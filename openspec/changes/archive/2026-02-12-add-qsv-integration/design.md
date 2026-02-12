## Context

Nightshift agents currently perform all CSV operations using OpenCode's Read and Write/Edit tools, treating `table.csv` as raw text. The manager agent reads the entire file, mentally parses the CSV structure, modifies cells in-memory, and writes the full content back. Commands (`nightshift-start`, `nightshift-add-task`, `nightshift-update-table`, `nightshift-archive`, `nightshift-test-task`) follow the same pattern. This works but is fragile -- agents can misparse column boundaries, corrupt quoting, or waste context window loading full file contents when they only need a single cell value.

[qsv](https://github.com/dathere/qsv) is a blazing-fast CSV CLI toolkit (installable via `brew install qsv`) that provides structured operations: selecting columns, filtering rows, editing individual cells, counting records, and appending data -- all from the command line.

The manager agent currently has `bash: "*": deny` in its permissions. Commands inherit global permissions where `bash: "*": "ask"`. Both need updating to allow `qsv*` commands.

## Goals / Non-Goals

**Goals:**

- Replace raw Read/Write CSV operations with `qsv` CLI commands in the manager agent and all Nightshift commands
- Add `qsv` as a strongly recommended dependency with Homebrew install instructions in the README
- Add `qsv*` to the bash allowlist for the manager agent and in the global permissions
- Maintain the existing constraint that the manager is the sole writer of `table.csv`
- Ensure all CSV operations produce valid RFC 4180 output

**Non-Goals:**

- Making qsv a hard/mandatory dependency -- Nightshift should not crash if qsv is absent, but we do not need to maintain a full parallel Read/Write codepath. A pre-flight check that warns if qsv is missing is sufficient.
- Using advanced qsv features (Polars, Luau scripting, geospatial, etc.) -- only basic CSV manipulation commands are in scope
- Changing the dev or QA agent permissions -- they never touch `table.csv` directly
- Changing the table.csv format or adding new columns/metadata

## Decisions

### Decision 1: qsv subcommand mapping

Each CSV operation in Nightshift maps to a specific qsv subcommand:

| Operation | Current approach | qsv command |
|---|---|---|
| Read a cell value | Read full file, parse mentally | `qsv slice --index N \| qsv select col` |
| Update a cell | Read full, modify, Write full | `qsv edit -i table.csv col row value` |
| Count rows | Read full file, count lines | `qsv count table.csv` |
| Filter by status | Read full, scan mentally | `qsv search --exact val --select col table.csv` |
| Get headers | Read full file, read first line | `qsv headers --just-names table.csv` |
| Add a column | Read full, insert header+values, Write | `qsv enum --constant val --new-column name table.csv` |
| Append rows | Read full, append text, Write | `qsv cat rows table.csv newrows.csv` |
| Display table | Read tool output | `qsv table table.csv` |
| Check if value exists | Read full, scan | `qsv search --exact val --select col --quick table.csv` |

**Rationale:** These are the core subcommands from qsv's standard build (no feature flags required). They cover every CSV operation Nightshift currently performs. The Homebrew build includes all of these by default.

**Alternatives considered:**
- `csvkit` (Python-based): Slower, requires Python runtime, heavier install
- `miller` (`mlr`): Capable but less focused on CSV, more complex syntax
- `xsv`: Predecessor to qsv, unmaintained since 2018

### Decision 2: qsv edit for cell updates with in-place flag

Use `qsv edit -i table.csv <column> <row-index> <value>` for all status updates. The `-i` flag modifies the file in-place and creates a `.bak` backup automatically.

**Row index mapping:** qsv uses 0-based row indices (excluding header). Nightshift's `row` column uses 1-based numbering. The agent must subtract 1 from the row number when calling qsv edit. For example, to update row 3's `create-page` status: `qsv edit -i table.csv create-page 2 done`.

**Rationale:** In-place editing with automatic backup is safer than the current read-modify-write cycle, which has no backup. The `.bak` file provides a rollback point if something goes wrong.

**Alternative considered:** Pipe to stdout and redirect (`qsv edit table.csv col row val > tmp && mv tmp table.csv`). More error-prone, no automatic backup.

### Decision 3: Bash permission changes

Two permission layers need updating:

1. **Manager agent frontmatter** (`templates/agents/nightshift-manager.md`): Change `bash: "*": deny` to allow `qsv*` commands. The updated permission block:
   ```yaml
   permission:
     bash:
       "*": deny
       "qsv*": allow
   ```

2. **Global permissions** (`opencode.jsonc`): Add `"qsv*": "allow"` to the bash permission block so commands can also use qsv without prompting.

**Rationale:** The manager needs bash access specifically for qsv. The deny-all-except pattern keeps the security posture tight. Commands inherit global permissions, so the global allowlist covers them.

**Alternative considered:** Only updating global permissions and removing the manager's deny-all. Rejected because the manager should remain locked down to specific tools.

### Decision 4: Pre-flight qsv availability check

The `/nightshift-start` command already performs pre-flight checks. Add a qsv availability check:

```bash
qsv --version
```

If qsv is not found on PATH, display a warning with install instructions but do not block execution. This is an advisory check, not a hard gate.

**Rationale:** Keeps qsv optional per the proposal. Users who cannot install qsv (e.g., restricted environments) can still use Nightshift, though they would need to fall back to manual CSV handling or the legacy Read/Write approach documented in the agent's fallback instructions.

### Decision 5: Template update strategy

All qsv command patterns are embedded directly in the agent and command Markdown templates (in `templates/`). The CLI package (`nightshift init` / `nightshift update`) copies these templates as-is. No runtime logic or conditional templating is needed.

The manager agent's "CSV Editing Rules" section is replaced with a "CSV Operations" section documenting the qsv commands to use for each operation type.

**Rationale:** Nightshift's architecture is entirely Markdown-driven. Agent behavior is defined by instructions in the template, not by code. Changing the instructions changes the behavior.

### Decision 6: Cleanup of .bak files

`qsv edit -i` creates `.bak` files on every in-place edit. Over a shift with hundreds of edits, this produces many `table.csv.bak` files (each overwriting the previous). Since qsv overwrites the single `.bak` file each time, there is only ever one backup file. No cleanup logic is needed during the shift. The archive command can optionally exclude `.bak` files.

## Risks / Trade-offs

- **[External dependency]** qsv must be installed separately. Users who skip the README prerequisites will see errors. **Mitigation:** Pre-flight warning in `/nightshift-start` with `brew install qsv` instruction. Clear README documentation.

- **[0-based vs 1-based indexing]** qsv slice/edit use 0-based indices; Nightshift's `row` column is 1-based. Off-by-one errors are likely during initial implementation. **Mitigation:** Document the mapping explicitly in the manager agent's CSV Operations section. Include the formula: `qsv_index = row_number - 1`.

- **[Homebrew-only on macOS/Linux]** qsv is available via Homebrew, but Windows users need manual binary download. **Mitigation:** README documents Homebrew as primary path; link to qsv's GitHub releases for other platforms. Nightshift's primary audience uses macOS.

- **[In-place edit atomicity]** `qsv edit -i` is not atomic -- a crash mid-write could corrupt the file. **Mitigation:** The `.bak` file provides recovery. This is no worse than the current Write tool approach, which also has no atomicity guarantee.

- **[Agent must learn new patterns]** The manager agent's LLM must correctly generate qsv commands from the instructions. Malformed commands will fail at the bash level rather than silently corrupting data. **Mitigation:** This is actually an improvement -- explicit failure is better than silent corruption. The template provides exact command patterns to copy.
