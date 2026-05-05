---
name: nightshift-add-task
description: Add a task definition to an existing Nightshift shift, registering it in manager.md and adding a status column to table.csv. Use when the user invokes /nightshift-add-task.
disable-model-invocation: true
allowed-tools: Bash(qsv *) Bash(flock *) Bash(mv *) Bash(test *) Bash(ls *)
argument-hint: [shift-name]
---

Add a new task file to shift `$ARGUMENTS` and update the table with a corresponding status column.

**Steps**

1. **Resolve the shift**

   - If `$ARGUMENTS` is non-empty, treat it as the shift name.
   - Otherwise, list directories in `.nightshift/` (excluding `archive/`):
     - If none exist, report "No active shifts. Use `/nightshift-create` first." and stop.
     - If exactly one exists, auto-select it.
     - If multiple exist, use the **AskUserQuestion** tool to let the user pick.

2. **Get task details**

   Use the **AskUserQuestion** tool (open-ended) to ask:
   > "Describe this task. What should the agent do for each item? Include the tools needed, step-by-step instructions, and how to verify success."

   From the response, derive:
   - A snake_case task name (e.g., `create_page`, `update_spreadsheet`). Hyphens break qsv column selectors — never use them.
   - A Configuration section listing tools.
   - A Steps section with numbered instructions referencing `{column_name}`, `{ENV:VAR}`, `{SHIFT:FOLDER|NAME|TABLE}` template variables as appropriate.
   - A Validation section with verification criteria.

3. **Check for task-name conflicts**

   - If `.nightshift/<shift>/<task-name>.md` already exists, report the conflict and ask for a different name.
   - Run `flock -x .nightshift/<shift>/table.csv qsv headers --just-names .nightshift/<shift>/table.csv` and confirm the task name is not already a column header.

4. **Create the task file**

   Write `.nightshift/<shift>/<task-name>.md`:

   ```markdown
   ## Configuration

   - tools: <tool1>, <tool2>

   ## Steps

   1. <step description>
   2. <step description>

   ## Validation

   - <criterion 1>
   - <criterion 2>
   ```

5. **Add status column to table.csv**

   ```bash
   flock -x .nightshift/<shift>/table.csv qsv enum --constant todo --new-column <task-name> .nightshift/<shift>/table.csv > .nightshift/<shift>/table_tmp.csv && mv .nightshift/<shift>/table_tmp.csv .nightshift/<shift>/table.csv
   ```

   This adds a column with the task name as header, initialized to `todo` for all existing rows. If the table is empty, only the header is added.

6. **Update manager.md task order**

   - If `## Task Order` currently shows the placeholder `(no tasks yet — use ...)`, replace it with `1. <task-name>`.
   - Otherwise, append as the next numbered item.

7. **Show result**

   ```
   ## Task Added: <task-name>

   **Shift:** <shift>
   **File:** `.nightshift/<shift>/<task-name>.md`

   ### Configuration
   - tools: <tools>

   ### Steps
   1. ...

   ### Validation
   - ...

   Table updated: <N> items now have `<task-name>: todo`
   Manager updated: task order now includes `<task-name>`
   ```

**Guardrails**
- Always create all three sections (Configuration, Steps, Validation).
- Initialize all existing table rows with `todo` for the new column.
- Validate snake_case task naming. No hyphens.
- Never overwrite an existing task file.
