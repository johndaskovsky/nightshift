---
name: nightshift-test-task
description: Run a single Nightshift task on a single table item for testing — without modifying table.csv or manager.md. Use when the user invokes /nightshift-test-task.
disable-model-invocation: true
allowed-tools: Bash(qsv *) Bash(flock *) Bash(test *) Bash(ls *)
argument-hint: [shift-name]
---

Execute a single Nightshift task on one item for testing purposes against shift `$ARGUMENTS`. **Do NOT modify table state.**

**Steps**

1. **Resolve the shift**

   - If `$ARGUMENTS` is non-empty, use it.
   - Otherwise, list directories in `.nightshift/` (excluding `archive/`); auto-select if exactly one exists, otherwise use **AskUserQuestion** to pick.

2. **Select the task**

   List task columns from `flock -x .nightshift/<shift>/table.csv qsv headers --just-names .nightshift/<shift>/table.csv` (or list `.md` files in the shift directory excluding `manager.md`).
   - If exactly one task exists, auto-select it.
   - Otherwise use **AskUserQuestion** to pick.

3. **Select the item**

   Determine the valid range from `flock -x .nightshift/<shift>/table.csv qsv count .nightshift/<shift>/table.csv`. Use **AskUserQuestion** to ask:
   > "Which item do you want to test? Enter an item number (1–N)."

   Show a preview of the item via `flock -x .nightshift/<shift>/table.csv qsv slice --index <qsv_index> .nightshift/<shift>/table.csv` (where `qsv_index = item_number - 1`).

4. **Spawn the dev subagent**

   Use the **Agent** tool with `subagent_type: "nightshift-dev"` and the prompt below. Pass the task file contents read from `.nightshift/<shift>/<task-name>.md` and the item row.

   ```
   You are executing Nightshift task "<task-name>" on a single item FOR TESTING.
   Do NOT modify table.csv or manager.md.

   ## Shift Directory
   .nightshift/<shift>/

   ## Task File
   <full contents of <task-name>.md>

   ## Item Data (Index <qsv_index>)
   <all column values for this item>

   Execute the steps and return structured results. Skip the State Update step
   (do NOT write to table.csv).
   ```

5. **Display results**

   ```
   ## Test Results: <task-name> on Item <N>

   ### Dev Execution
   **Status:** <SUCCESS | FAILED (step N) | FAILED (validation)>
   **Recommendations:** <step improvements, or "None">
   **Error:** <error details if failed, omit if successful>

   ### Overall: PASS / FAIL

   Note: Table state was NOT modified. This was a test run only.
   ```

**Guardrails**
- NEVER modify `table.csv` during a test run.
- NEVER modify `manager.md` during a test run.
- Display detailed results so the user can debug task definitions.
- Always include the "test run only" note in output.
