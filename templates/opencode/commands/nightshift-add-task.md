---
description: Add a task to an existing Nightshift shift
---

Add a new task file to a shift and update the table with a corresponding status column.

**Input**: The argument after `/nightshift-add-task` is the shift name, or omit to select interactively.

**Steps**

1. **Select the shift**

   If a name is provided, use it. Otherwise:
   - List directories in `.nightshift/` (excluding `archive/`)
   - If no shifts exist, report: "No active shifts. Use `/nightshift-create` first."
   - If one shift exists, auto-select it
   - If multiple shifts exist, use the **AskUserQuestion tool** to let the user pick

2. **Get task details**

   Use the **AskUserQuestion tool** (open-ended) to ask:
   > "Describe this task. What should the agent do for each item? Include the tools needed, step-by-step instructions, and how to verify success."

   From their description, derive:
   - A snake_case task name (e.g., `create_page`, `update_spreadsheet`)
   - The Configuration section (tools list)
   - The Steps section (numbered instructions)
   - The Validation section (verification criteria)

3. **Check for task name conflicts**

   If a file `<task-name>.md` already exists in the shift directory, report the conflict and suggest a different name. Use `flock -x table.csv qsv headers --just-names table.csv` to also check if a column with this name already exists in the table.

4. **Create the task file**

   Write `.nightshift/<shift-name>/<task-name>.md`:

   ```markdown
   ## Configuration

   - tools: <tool1>, <tool2>

   ## Steps

   1. <step description>
   2. <step description>
   3. <step description>

   ## Validation

   - <criterion 1>
   - <criterion 2>
   ```

5. **Update table.csv**

   Add a new status column for this task using `flock -x` prefixed `qsv enum`:

   ```bash
   flock -x table.csv qsv enum --constant todo --new-column <task-name> table.csv > table_tmp.csv && mv table_tmp.csv table.csv
   ```

   This adds a column with the task name as header, initialized to `todo` for all existing rows. If the table is empty (header only), the column header is still added.

6. **Update manager.md**

   Add the task to the `## Task Order` section:
   - If it's the first task, replace the placeholder text with `1. <task-name>`
   - Otherwise, append as the next numbered item

7. **Show result**

   Present the created task file for review and show the updated state:

   ```
   ## Task Added: <task-name>

   **Shift:** <shift-name>
   **File:** `.nightshift/<shift-name>/<task-name>.md`

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
- Always create all three sections (Configuration, Steps, Validation)
- Initialize all existing table rows with `todo` for the new task column
- Update manager.md task order to include the new task
- Validate snake_case task naming (no hyphens — hyphens break qsv column selectors)
- Never overwrite an existing task file
