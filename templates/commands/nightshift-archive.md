---
description: Archive a completed Nightshift shift
---

Move a completed (or partially completed) shift to the archive directory with a date prefix.

**Input**: The argument after `/nightshift-archive` is the shift name, or omit to select interactively.

**Steps**

1. **Select the shift**

   If a name is provided, use it. Otherwise:
   - List directories in `.nightshift/` (excluding `archive/`)
   - If no shifts exist, report: "No active shifts to archive."
   - If one shift exists, auto-select it
   - If multiple shifts exist, use the **AskUserQuestion tool** to let the user pick

2. **Validate the shift exists**

   Check `.nightshift/<name>/` exists. If not, report the error.

3. **Check for incomplete items**

   Read `table.csv` and check for items NOT in `done` status:
   - If incomplete items exist, warn:
     ```
     Warning: Shift has incomplete items:
     - X items with status "todo"
     - Y items with status "failed"
     - Z items with status "in_progress"
     ```
     Use the **AskUserQuestion tool** to confirm:
     > "Archive anyway?"
     Options: "Yes, archive with incomplete items" / "No, cancel"

   - If user cancels, STOP

4. **Check for archive name collision**

   The target is `.nightshift/archive/YYYY-MM-DD-<name>/` using today's date.
   - If the target already exists, report: "Archive target already exists: `.nightshift/archive/YYYY-MM-DD-<name>/`. Cannot overwrite."
   - STOP if collision found

5. **Move to archive**

   Use bash to move the shift directory:
   ```bash
   mv .nightshift/<name> .nightshift/archive/YYYY-MM-DD-<name>
   ```

6. **Confirm**

   ```
   ## Shift Archived

   **Shift:** <name>
   **Location:** `.nightshift/archive/YYYY-MM-DD-<name>/`

   All files preserved (manager.md, table.csv, task files).
   ```

**Guardrails**
- Always use today's date in ISO YYYY-MM-DD format for the archive prefix
- Never overwrite an existing archive
- Warn about incomplete items but allow archiving with confirmation
- Preserve all files in the move (manager.md, table.csv, all task .md files)
