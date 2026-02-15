---
description: Create a new Nightshift shift with manager, table, and optional task files
---

Create a new Nightshift shift — a structured unit of batch agent work.

**Input**: The argument after `/nightshift-create` is the shift name (kebab-case), or omit for interactive mode.

**Steps**

1. **Get shift name**

   If a name is provided as argument, use it. Otherwise, use the **AskUserQuestion tool** (open-ended) to ask:
   > "What will this shift do? Describe the batch work and I'll derive a name."

   Derive a kebab-case name from their description (e.g., "create promo example pages" -> `create-promo-examples`).

2. **Validate the name**

   - Must be kebab-case: lowercase letters, numbers, and hyphens only
   - If invalid, report the error and ask for a valid name

3. **Check for conflicts**

   - If `.nightshift/<name>/` already exists, report: "Shift `<name>` already exists. Use `/nightshift-start <name>` to resume it."
   - STOP if conflict found

4. **Create the shift directory and files**

   Create `.nightshift/<name>/` with these files:

   **manager.md:**
   ```markdown
   ## Shift Configuration

   - name: <name>
   - created: <YYYY-MM-DD>
   <!-- - parallel: true -->
   <!-- - current-batch-size: 2 -->
   <!-- - max-batch-size: 10 -->

   ## Task Order

   (no tasks yet — use `/nightshift-add-task <name>` to add tasks)
   ```

   **table.csv:**
   ```
   row
   ```

   (Just the header row with the `row` column — items and task columns added later.)

5. **Ask about initial tasks**

   Use the **AskUserQuestion tool** to ask:
   > "Shift `<name>` created! Do you want to add a task now?"

   Options: "Yes, add a task" / "No, I'll add tasks later"

   If yes, guide them through `/nightshift-add-task <name>` flow (describe the task, create the file, update table and manager).

**Output**

```
## Shift Created: <name>

**Location:** `.nightshift/<name>/`
**Files:** manager.md, table.csv

### Next Steps
- `/nightshift-add-task <name>` — add tasks to the shift
- `/nightshift-update-table <name>` — add items to the table
- `/nightshift-start <name>` — begin execution (after adding tasks and items)

### Environment Variables (Optional)
Create `.nightshift/<name>/.env` to define environment variables for this shift.
Use `{ENV:VAR_NAME}` in task steps to reference them. The `.env` file is gitignored.

Available template variables in task steps:
- `{column_name}` — table row column value
- `{ENV:VAR_NAME}` — environment variable from `.env`
- `{SHIFT:FOLDER}` — shift directory path
- `{SHIFT:NAME}` — shift name
```

**Guardrails**
- Always validate kebab-case naming
- Never overwrite an existing shift
- Create both manager.md and table.csv even if no tasks or items are defined yet
- Use today's date (ISO YYYY-MM-DD) for the created field
