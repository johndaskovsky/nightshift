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

3. **Check if shift is already complete**

   Use `flock -x` prefixed `qsv` commands to check if ALL item-task statuses are `done`. For each task column, run:

   ```bash
   flock -x .nightshift/<name>/table.csv qsv search --exact done --select <task-column> --invert-match .nightshift/<name>/table.csv | qsv count
   ```

   - If all counts are 0: report "Shift `<name>` is already complete! All items are done." and suggest `/nightshift-archive <name>`
   - If no items exist (`flock -x .nightshift/<name>/table.csv qsv count .nightshift/<name>/table.csv` returns 0): report "Shift has no items. Use `/nightshift-update-table <name>` to add items first."
   - If no task columns exist (`flock -x .nightshift/<name>/table.csv qsv headers --just-names .nightshift/<name>/table.csv` shows only metadata columns): report "Shift has no tasks. Use `/nightshift-add-task <name>` to add tasks first."

4. **Show pre-flight summary**

   Use `flock -x` prefixed `qsv` commands to build the summary:

   ```bash
   # Total items
   flock -x .nightshift/<name>/table.csv qsv count .nightshift/<name>/table.csv

   # Status counts per task
   flock -x .nightshift/<name>/table.csv qsv search --exact done --select <task-column> .nightshift/<name>/table.csv | qsv count
   flock -x .nightshift/<name>/table.csv qsv search --exact failed --select <task-column> .nightshift/<name>/table.csv | qsv count
   flock -x .nightshift/<name>/table.csv qsv search --exact todo --select <task-column> .nightshift/<name>/table.csv | qsv count

   # Pretty-print the table
   flock -x .nightshift/<name>/table.csv qsv table .nightshift/<name>/table.csv
   ```

   Display:
   ```
   ## Starting Shift: <name>

   **Tasks:** <task-1>, <task-2>, ...
   **Items:** N total
   **Status:** X done, Y failed, Z remaining

   Beginning execution...
   ```

5. **Invoke the manager agent**

   Use the **Task tool** to invoke the `nightshift-manager` subagent once. The manager runs autonomously, processing all items within a single session.

   ```
   Execute Nightshift shift "<name>".

   Shift directory: .nightshift/<name>/

   Read manager.md for task order and configuration.
   Read table.csv for item statuses.
   Process all remaining items following the orchestration logic in your instructions.
   ```

6. **Report results**

   After the manager returns, parse the manager's completion output for the final counts (the manager includes `Completed`, `Failed`, and `Total items` in its shift complete summary). Display the final status:
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
- The manager runs autonomously — do NOT gate individual batches or run termination checks between batches
- Don't invoke the manager if there's nothing to process
