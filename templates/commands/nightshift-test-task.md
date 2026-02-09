---
description: Run a single Nightshift task on a single table row for testing
---

Execute a single task on one item for testing purposes — without modifying the table state.

**Input**: The argument after `/nightshift-test-task` is the shift name, or omit to select interactively.

**Steps**

1. **Select the shift**

   If a name is provided, use it. Otherwise:
   - List directories in `.nightshift/` (excluding `archive/`)
   - Auto-select if only one exists, otherwise prompt for selection

2. **Select the task**

   List task files (`.md` files excluding `manager.md`) in the shift directory.
   - If one task exists, auto-select it
   - If multiple tasks exist, use the **AskUserQuestion tool** to let the user pick

3. **Select the row**

   Read `table.csv` and show available rows. Use the **AskUserQuestion tool** to ask:
   > "Which row do you want to test? Enter a row number."

   Show a preview of the row's metadata columns to help them choose.

4. **Execute the task (dev agent)**

   Use the **Task tool** to invoke the `nightshift-dev` subagent with:
   ```
   You are executing Nightshift task "<task-name>" on a single item FOR TESTING.
   Do NOT modify table.csv or manager.md.

   ## Shift Directory
   .nightshift/<shift-name>/

   ## Task File
   <full contents of task-name.md>

   ## Item Data (Row <N>)
   <all column values for this row>

   Execute the steps and return structured results.
   ```

5. **Verify the task (qa agent)**

   Use the **Task tool** to invoke the `nightshift-qa` subagent with:
   ```
   You are verifying Nightshift task "<task-name>" on a single item FOR TESTING.

   ## Task Validation Criteria
   <Validation section from task file>

   ## Item Data (Row <N>)
   <all column values>

   ## Dev Results
   <dev agent's returned results>

   Check each criterion and return structured results.
   ```

6. **Display results (without updating table)**

   ```
   ## Test Results: <task-name> on Row <N>

   ### Dev Execution
   <step-by-step results from dev agent>

   ### QA Verification
   <per-criterion results from qa agent>

   ### Overall: PASS / FAIL

   Note: Table state was NOT modified. This was a test run only.
   ```

**Guardrails**
- NEVER modify table.csv during a test run
- NEVER modify manager.md during a test run
- Always run both dev and qa agents to get the full picture
- Display detailed results so the user can debug task definitions
- Include the "test run only" note in output
