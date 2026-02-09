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
   - A kebab-case task name
   - The Configuration section (tools list)
   - The Steps section (numbered instructions)
   - The Validation section (verification criteria)

3. **Check for task name conflicts**

   If a file `<task-name>.md` already exists in the shift directory, report the conflict and suggest a different name.

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

   Read `table.csv` and add a new column for this task:
   - Column header: the task name (e.g., `create-page`)
   - All existing rows get status `todo` in this column
   - If the table is empty (header only), just add the column header

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
- Validate kebab-case task naming
- Never overwrite an existing task file
