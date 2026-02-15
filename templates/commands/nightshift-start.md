---
description: Start or resume execution of a Nightshift shift
---

Begin or resume executing a Nightshift shift by invoking the manager agent in a supervisor loop.

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

3. **Pre-flight dependency checks**

   Run both checks via the Bash tool:

   ```bash
   qsv --version
   flock --version
   ```

   - If `qsv` is not found: display an error and STOP. Do not proceed with shift execution.
     ```
     Error: Required dependency missing.
     Install qsv: brew install qsv (https://github.com/dathere/qsv)
     ```
   - If `flock` is not found: display an error and STOP. Do not proceed with shift execution.
     ```
     Error: Required dependency missing.
     Install flock: brew install flock (https://github.com/discoteq/flock)
     ```
   - If both are available: include both versions in the pre-flight summary and proceed.

4. **Check if shift is already complete**

   Use `flock -x` prefixed `qsv` commands to check if ALL item-task statuses are `done`. For each task column, run:

   ```bash
   flock -x .nightshift/<name>/table.csv qsv search --exact done --select <task-column> --invert-match .nightshift/<name>/table.csv | qsv count
   ```

   - If all counts are 0: report "Shift `<name>` is already complete! All items are done." and suggest `/nightshift-archive <name>`
   - If no items exist (`flock -x .nightshift/<name>/table.csv qsv count .nightshift/<name>/table.csv` returns 0): report "Shift has no items. Use `/nightshift-update-table <name>` to add items first."
   - If no task columns exist (`flock -x .nightshift/<name>/table.csv qsv headers --just-names .nightshift/<name>/table.csv` shows only metadata columns): report "Shift has no tasks. Use `/nightshift-add-task <name>` to add tasks first."

5. **Show pre-flight summary**

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

   **qsv:** v<version>
   **flock:** v<version>
   **Tasks:** <task-1>, <task-2>, ...
   **Items:** N total
   **Status:** X done, Y failed, Z remaining

   Beginning execution...
   ```

6. **Supervisor loop — invoke the manager agent**

   Use the **Task tool** to invoke the `nightshift-manager` subagent. The command thread operates as a supervisor that monitors the manager for progress reports and handles compaction recovery.

   **Initial invocation:**
   ```
   Execute Nightshift shift "<name>".

   Shift directory: .nightshift/<name>/

   Read manager.md for task order and configuration.
   Read table.csv for item statuses.
   Process all remaining items following the orchestration logic in your instructions.

   After each batch, output a progress report in this format:
   Progress: M/N
   Compacted: true|false

   Where M = items with all tasks done, N = total items.
   Report Compacted: true if you detect context compaction (e.g., you cannot confirm the shift name, directory, or current task).
   ```

   **Loop logic:**

   When the manager returns with a progress report:
   - Parse the progress report from the manager's output
   - Display `Progress: M/N` to the user

   - **If `Compacted: false`** (or not present) and items remain (`todo` items exist):
     - Re-invoke the **same manager session** using `task_id` to continue processing

   - **If `Compacted: true`**:
     - Discard the current manager session
     - Start a **fresh** manager subagent invocation (new Task tool call without `task_id`) to continue the shift

   - **If all items are `done` or `failed`** (no `todo` items remain):
     - Exit the supervisor loop and proceed to the final report

   **Termination check:** After each manager return, verify remaining work:
   ```bash
   flock -x .nightshift/<name>/table.csv qsv search --exact todo --select <task-column> .nightshift/<name>/table.csv | qsv count
   ```
   If count is 0 for all task columns, the shift is complete.

7. **Report results**

   After the supervisor loop exits, display the final status:
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
- Always check qsv and flock availability before proceeding — both are required
- Show the pre-flight summary before invoking the manager
- Operate as a supervisor loop — re-invoke the manager after each progress report
- Restart the manager with a fresh session on compaction detection
- Report results after the supervisor loop exits
- Don't invoke the manager if there's nothing to process
