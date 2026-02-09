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

   Read and display `table.csv` summary:
   - Number of rows
   - Column names
   - Status distribution per task column (how many todo, done, failed, etc.)

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
   - Assign sequential row numbers continuing from the last row
   - Set all task status columns to `todo` for new rows
   - Append to table.csv

   **Update metadata:**
   - Ask which column and which rows to update
   - Show a preview of the changes
   - Confirm before applying
   - Update the specified cells while preserving all status columns

   **Reset failed items:**
   - Ask which task column to reset (or all tasks)
   - Show how many items will be reset
   - Confirm before applying
   - Change `failed` → `todo` for the specified task column(s)

5. **Confirm destructive changes**

   For operations that modify existing data (update metadata, reset failed):
   - Show a summary: "This will change N cells in M rows"
   - Use the **AskUserQuestion tool**: "Apply these changes?"
   - Only proceed on confirmation

6. **Update progress in manager.md**

   After modifying the table, recalculate and update the `## Progress` section in manager.md with current counts.

7. **Show result**

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
- Update manager.md progress after any change
- Show the user what will change before applying
