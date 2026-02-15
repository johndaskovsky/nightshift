---
description: Make bulk changes to a Nightshift shift table
---

Bulk modify the table.csv of a shift — add rows, update metadata, or reset failed items.

**Input**: The argument after `/nightshift-update-table` is the shift name, or omit to select interactively.

**Steps**

1. **Select the shift**

   If a name is provided, use it. Otherwise:
   - List directories in `.nightshift/` (excluding `archive/`)
   - Auto-select if only one exists, otherwise prompt for selection

2. **Show current table state**

   Use `flock -x` prefixed `qsv` commands to display the table summary:

   ```bash
   # Row count
   flock -x table.csv qsv count table.csv

   # Column names
   flock -x table.csv qsv headers --just-names table.csv

   # Status distribution per task column
   flock -x table.csv qsv search --exact todo --select <task-column> table.csv | qsv count
   flock -x table.csv qsv search --exact done --select <task-column> table.csv | qsv count
   flock -x table.csv qsv search --exact failed --select <task-column> table.csv | qsv count

   # Pretty-print
   flock -x table.csv qsv table table.csv
   ```

3. **Determine the operation**

   Use the **AskUserQuestion tool** to ask:
   > "What do you want to do?"

   Options:
   - "Add rows" — append new items to the table
   - "Update metadata" — modify metadata column values
   - "Reset failed items" — change `failed` statuses back to `todo`

4. **Execute the operation**

   **Add rows:**
   - Ask user for the data (they can paste CSV, describe items, or point to a data source)
   - Assign sequential row numbers continuing from the last row (use `flock -x table.csv qsv count table.csv` to determine the next row number)
   - Set all task status columns to `todo` for new rows
   - Write the new rows to a temporary CSV file with matching headers
   - Append using `flock -x` prefixed `qsv cat rows`:
     ```bash
     flock -x table.csv qsv cat rows table.csv newrows.csv > table_tmp.csv && mv table_tmp.csv table.csv
     ```
   - Clean up the temporary file

   **Update metadata:**
   - Ask which column and which rows to update
   - Show a preview of the changes
   - Confirm before applying
   - Update cells using `flock -x` prefixed `qsv edit -i` (remember `qsv_index = row_number - 1`):
     ```bash
     flock -x table.csv qsv edit -i table.csv <column> <qsv_index> <new_value>
     ```

   **Reset failed items:**
   - Ask which task column to reset (or all tasks)
   - Find failed items using `flock -x` prefixed `qsv search`:
     ```bash
     flock -x table.csv qsv search --exact failed --select <task-column> table.csv
     ```
   - Show how many items will be reset
   - Confirm before applying
   - Reset each failed item to `todo` using `flock -x` prefixed `qsv edit -i`:
     ```bash
     flock -x table.csv qsv edit -i table.csv <task-column> <qsv_index> todo
     ```

5. **Confirm destructive changes**

   For operations that modify existing data (update metadata, reset failed):
   - Show a summary: "This will change N cells in M rows"
   - Use the **AskUserQuestion tool**: "Apply these changes?"
   - Only proceed on confirmation

6. **Show result**

   ```
   ## Table Updated: <shift-name>

   **Operation:** <what was done>
   **Rows affected:** N
   **Current state:** X total items, Y todo, Z done, W failed
   ```

**Guardrails**
- Always confirm before modifying existing data
- Preserve row numbering continuity when adding rows
- Set all task columns to `todo` for new rows
- Never reorder existing rows
- Show the user what will change before applying
