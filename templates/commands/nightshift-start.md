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

   Read `table.csv` and check if ALL item-task statuses are `done`:
   - If complete: report "Shift `<name>` is already complete! All items are done." and suggest `/nightshift-archive <name>`
   - If no items exist (table has only header): report "Shift has no items. Use `/nightshift-update-table <name>` to add items first."
   - If no task columns exist: report "Shift has no tasks. Use `/nightshift-add-task <name>` to add tasks first."

4. **Show pre-flight summary**

   Read `manager.md` and `table.csv` to display:
   ```
   ## Starting Shift: <name>

   **Tasks:** <task-1>, <task-2>, ...
   **Items:** N total
   **Status:** X done, Y failed, Z remaining

   Beginning execution...
   ```

5. **Invoke the manager agent**

   Use the **Task tool** to invoke the `nightshift-manager` subagent with:
   ```
   Execute Nightshift shift "<name>".

   Shift directory: .nightshift/<name>/

   Read manager.md for task order and configuration.
   Read table.csv for item statuses.
   Process all remaining items following the orchestration logic in your instructions.
   ```

6. **Report results**

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
