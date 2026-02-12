---
description: Start or resume execution of a Nightshift shift
---

Begin or resume executing a Nightshift shift by invoking the manager agent.

**Input**: The argument after `/nightshift-start` is the shift name, or omit to select interactively.

**Steps**

1. **Select the shift**

   If a name is provided, use it. Otherwise:
   - List directories in `.nightshift/` (excluding `archive/`)
   - If no shifts exist, report: "No active shifts. Use `/nightshift-create` to create one."
   - If one shift exists, auto-select it
   - If multiple shifts exist, use the **AskUserQuestion tool** to let the user pick

2. **Validate the shift exists**

   - Check `.nightshift/<name>/` exists
   - Check `manager.md` and `table.csv` exist within it
   - If missing, report the error and suggest `/nightshift-create`

3. **Pre-flight qsv check**

   Run `qsv --version` via the Bash tool:
   - If qsv is available: include the version in the pre-flight summary
   - If qsv is not found: display a warning and recommend installation, but do not block execution

   ```
   Warning: qsv is not installed. CSV operations will be less reliable.
   Install with: brew install qsv
   See: https://github.com/dathere/qsv/releases
   ```

4. **Check if shift is already complete**

   Use `qsv` to check if ALL item-task statuses are `done`. For each task column, run:

   ```bash
   qsv search --exact done --select <task-column> --invert-match table.csv | qsv count
   ```

   - If all counts are 0: report "Shift `<name>` is already complete! All items are done." and suggest `/nightshift-archive <name>`
   - If no items exist (`qsv count table.csv` returns 0): report "Shift has no items. Use `/nightshift-update-table <name>` to add items first."
   - If no task columns exist (`qsv headers --just-names table.csv` shows only metadata columns): report "Shift has no tasks. Use `/nightshift-add-task <name>` to add tasks first."

5. **Handle stale statuses**

   Check for items stuck in transient states from interrupted runs:

   ```bash
   # For each task column:
   qsv search --exact in_progress --select <task-column> table.csv
   qsv search --exact qa --select <task-column> table.csv
   ```

   If any matches are found, report them in the pre-flight summary so the user knows they will be reset to `todo` by the manager.

6. **Show pre-flight summary**

   Use `qsv` to build the summary:

   ```bash
   # Total items
   qsv count table.csv

   # Status counts per task
   qsv search --exact done --select <task-column> table.csv | qsv count
   qsv search --exact failed --select <task-column> table.csv | qsv count
   qsv search --exact todo --select <task-column> table.csv | qsv count

   # Pretty-print the table
   qsv table table.csv
   ```

   Display:
   ```
   ## Starting Shift: <name>

   **qsv:** v<version> (or "not installed — recommended: brew install qsv")
   **Tasks:** <task-1>, <task-2>, ...
   **Items:** N total
   **Status:** X done, Y failed, Z remaining
   [If stale statuses found] **Stale:** N items will be reset to todo

   Beginning execution...
   ```

7. **Invoke the manager agent**

   Use the **Task tool** to invoke the `nightshift-manager` subagent with:
   ```
   Execute Nightshift shift "<name>".

   Shift directory: .nightshift/<name>/

   Read manager.md for task order and configuration.
   Read table.csv for item statuses.
   Process all remaining items following the orchestration logic in your instructions.
   ```

8. **Report results**

   After the manager completes, display the final status:
   ```
   ## Shift Execution Complete

   **Shift:** <name>
   **Completed:** N
   **Failed:** N
   **Remaining:** N

   [If all done] All items complete! Archive with `/nightshift-archive <name>`
   [If failures] Some items failed. Review table.csv for details.
   [If remaining] Shift paused. Resume with `/nightshift-start <name>`
   ```

**Guardrails**
- Always validate the shift directory structure before starting
- Show the pre-flight summary before invoking the manager
- Report results after the manager finishes
- Don't invoke the manager if there's nothing to process
