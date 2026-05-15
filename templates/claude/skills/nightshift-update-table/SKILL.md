---
name: nightshift-update-table
description: Make bulk changes to a Nightshift shift's table.csv — add rows, update metadata, or reset failed items. Use when the user invokes /nightshift-update-table.
disable-model-invocation: true
allowed-tools: Bash(qsv *) Bash(flock *) Bash(mv *) Bash(rm *) Bash(test *) Bash(ls *)
argument-hint: [shift-name]
---

Bulk-modify the `table.csv` of shift `$ARGUMENTS`.

**Steps**

1. **Resolve the shift**

   - If `$ARGUMENTS` is non-empty, use it.
   - Otherwise, list directories in `.nightshift/` (excluding `archive/`); auto-select if exactly one exists, otherwise use **AskUserQuestion** to pick.

2. **Show current table state**

   ```bash
   flock -x .nightshift/<shift>/table.csv qsv count .nightshift/<shift>/table.csv
   flock -x .nightshift/<shift>/table.csv qsv headers --just-names .nightshift/<shift>/table.csv
   flock -x .nightshift/<shift>/table.csv qsv table .nightshift/<shift>/table.csv
   ```

   Per task column, also show counts:

   ```bash
   flock -x .nightshift/<shift>/table.csv qsv search --exact todo --select <task-column> .nightshift/<shift>/table.csv | qsv count
   flock -x .nightshift/<shift>/table.csv qsv search --exact done --select <task-column> .nightshift/<shift>/table.csv | qsv count
   flock -x .nightshift/<shift>/table.csv qsv search --exact failed --select <task-column> .nightshift/<shift>/table.csv | qsv count
   ```

3. **Determine the operation**

   Use **AskUserQuestion**:
   > "What do you want to do?"

   Options:
   - "Add rows" — append new items.
   - "Update metadata" — modify metadata column values.
   - "Reset failed items" — change `failed` statuses back to `todo`.

4. **Execute the operation**

   **Add rows:**
   - Ask the user for the data (CSV paste, description, data source).
   - Set all task status columns to `todo` for new rows.
   - Write to a temp CSV with matching headers, then append:
     ```bash
     flock -x .nightshift/<shift>/table.csv qsv cat rows .nightshift/<shift>/table.csv .nightshift/<shift>/newrows.csv > .nightshift/<shift>/table_tmp.csv && mv .nightshift/<shift>/table_tmp.csv .nightshift/<shift>/table.csv
     ```
   - Remove the temp file.

   **Update metadata:**
   - Ask which column and which rows.
   - Show a preview of the changes.
   - Confirm via **AskUserQuestion** before applying.
   - Update cells:
     ```bash
     flock -x .nightshift/<shift>/table.csv qsv edit -i .nightshift/<shift>/table.csv <column> <qsv_index> <new_value>
     ```

   **Reset failed items:**
   - Ask which task column (or all).
   - List failed items:
     ```bash
     flock -x .nightshift/<shift>/table.csv qsv search --exact failed --select <task-column> .nightshift/<shift>/table.csv
     ```
   - Show how many will be reset; confirm via **AskUserQuestion**.
   - Reset each:
     ```bash
     flock -x .nightshift/<shift>/table.csv qsv edit -i .nightshift/<shift>/table.csv <task-column> <qsv_index> todo
     ```

5. **Show result**

   ```
   ## Table Updated: <shift>

   **Operation:** <what was done>
   **Rows affected:** N
   **Current state:** X total items, Y todo, Z done, W failed
   ```

**Guardrails**
- Always confirm before modifying existing data.
- Preserve item ordering when adding rows.
- Set all task columns to `todo` for new rows.
- Never reorder existing rows.
- Always show the diff before applying destructive changes.
