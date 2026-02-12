## 1. Permissions and Configuration

- [x] 1.1 Add `"qsv*": "allow"` to the global bash permission block in `opencode.jsonc`
- [x] 1.2 Add `"qsv*": allow` to the manager agent's bash permission in `templates/agents/nightshift-manager.md` as an exception to the deny-all policy
- [x] 1.3 Add qsv as a recommended prerequisite in `README.md` with `brew install qsv` install instructions and a link to the qsv GitHub releases page for non-Homebrew platforms

## 2. Core qsv Operations in Manager Agent

- [x] 2.1 Replace the "CSV Editing Rules" section in `templates/agents/nightshift-manager.md` with a "CSV Operations" section documenting qsv subcommand patterns for each operation type (read cell, update cell, count rows, filter by status, get headers, display table)
- [x] 2.2 Document the 0-based index mapping (`qsv_index = row_number - 1`) in the CSV Operations section with explicit examples
- [x] 2.3 Update all status-write instructions in the manager template to use `qsv edit -i table.csv <column> <index> <value>` instead of Read/Edit/Write patterns
- [x] 2.4 Update progress tracking instructions to use `qsv search` and `qsv count` for deriving current counts

## 3. Command Updates -- nightshift-start

- [x] 3.1 Add a pre-flight qsv availability check (`qsv --version`) to `templates/commands/nightshift-start.md` that warns if qsv is missing but does not block execution
- [x] 3.2 Update pre-flight table summary display to use `qsv count`, `qsv search`, and `qsv table` instead of reading the full file with the Read tool
- [x] 3.3 Update stale status detection to use `qsv search --exact in_progress` and `qsv search --exact qa` to find items needing reset

## 4. Command Updates -- nightshift-add-task

- [x] 4.1 Update `templates/commands/nightshift-add-task.md` to use `qsv enum --constant todo --new-column <task-name>` for adding new status columns to `table.csv`
- [x] 4.2 Update column existence check to use `qsv headers --just-names` instead of reading the file header

## 5. Command Updates -- nightshift-update-table

- [x] 5.1 Update `templates/commands/nightshift-update-table.md` to use `qsv cat rows` for appending new rows to `table.csv`
- [x] 5.2 Update individual cell modifications to use `qsv edit -i` for status and metadata updates
- [x] 5.3 Update failed-item reset logic to use `qsv search --exact failed --select <task-column>` to identify rows, then `qsv edit -i` to reset each to `todo`

## 6. Command Updates -- nightshift-archive and nightshift-test-task

- [x] 6.1 Update `templates/commands/nightshift-archive.md` to use `qsv search --exact done --invert-match` for detecting incomplete items before archiving
- [x] 6.2 Update `templates/commands/nightshift-test-task.md` to use `qsv slice --index <N>` for reading a single row and `qsv select` for extracting specific columns
- [x] 6.3 Update task and row selection prompts in test-task to use `qsv headers --just-names` for listing task columns and `qsv count` for determining valid row range

## 7. Spec Sync

- [x] 7.1 Sync the new `qsv-csv-operations` spec to `openspec/specs/qsv-csv-operations/spec.md`
- [x] 7.2 Sync delta changes from `nightshift-agents` spec to `openspec/specs/nightshift-agents/spec.md`
- [x] 7.3 Sync delta changes from `nightshift-commands` spec to `openspec/specs/nightshift-commands/spec.md`
- [x] 7.4 Sync delta changes from `nightshift-shifts` spec to `openspec/specs/nightshift-shifts/spec.md`
