---
name: nightshift-archive
description: Archive a Nightshift shift by moving its directory to .nightshift/archive/YYYY-MM-DD-<name>/. Use when the user invokes /nightshift-archive.
disable-model-invocation: true
allowed-tools: Bash(qsv *) Bash(flock *) Bash(test *) Bash(ls *)
argument-hint: [shift-name]
---

Archive shift `$ARGUMENTS`.

**Steps**

1. **Resolve the shift**

   - If `$ARGUMENTS` is non-empty, use it.
   - Otherwise, list directories in `.nightshift/` (excluding `archive/`); auto-select if exactly one exists, otherwise use **AskUserQuestion** to pick.
   - If no active shifts exist, report "No active shifts to archive." and stop.

2. **Validate the shift exists**

   Check `.nightshift/<shift>/` exists. If not, report the error and stop.

3. **Check for incomplete items**

   For each task column (from `flock -x .nightshift/<shift>/table.csv qsv headers --just-names .nightshift/<shift>/table.csv`):

   ```bash
   flock -x .nightshift/<shift>/table.csv qsv search --exact done --select <task-column> --invert-match .nightshift/<shift>/table.csv | qsv count
   ```

   If any non-done items exist, break down by status:

   ```bash
   flock -x .nightshift/<shift>/table.csv qsv search --exact todo --select <task-column> .nightshift/<shift>/table.csv | qsv count
   flock -x .nightshift/<shift>/table.csv qsv search --exact failed --select <task-column> .nightshift/<shift>/table.csv | qsv count
   ```

   Warn the user with the breakdown and use **AskUserQuestion** to confirm:
   > "Archive anyway?"

   Options: "Yes, archive with incomplete items" / "No, cancel". If the user cancels, stop.

4. **Run the bundled archive script**

   ```bash
   ${CLAUDE_SKILL_DIR}/scripts/archive.sh <shift>
   ```

   The script computes today's date in ISO format and moves the directory atomically. It exits non-zero on collision (`.nightshift/archive/YYYY-MM-DD-<shift>/` already exists).

5. **Confirm**

   ```
   ## Shift Archived

   **Shift:** <shift>
   **Location:** `.nightshift/archive/YYYY-MM-DD-<shift>/`

   All files preserved (manager.md, table.csv, task files).
   ```

**Guardrails**
- Always use today's date in ISO `YYYY-MM-DD` format for the archive prefix.
- Never overwrite an existing archive.
- Warn about incomplete items but allow archiving with explicit confirmation.
- Preserve all files in the move (manager.md, table.csv, all task `.md` files).
