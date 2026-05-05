---
name: nightshift-create
description: Create a new Nightshift shift — a structured unit of batch agent work — with manager.md and an empty table.csv. Use when the user invokes /nightshift-create.
disable-model-invocation: true
allowed-tools: Bash(qsv *) Bash(flock *) Bash(mkdir *) Bash(test *)
argument-hint: [shift-name]
---

Create a new Nightshift shift named `$ARGUMENTS`.

**Steps**

1. **Resolve the shift name**

   - If `$ARGUMENTS` is non-empty, treat it as the shift name.
   - If `$ARGUMENTS` is empty, use the **AskUserQuestion** tool (open-ended) to ask:
     > "What will this shift do? Describe the batch work and I'll derive a name."
   - Derive a kebab-case name from their description (e.g., "create promo example pages" → `create-promo-examples`).

2. **Validate the name**

   - Must be kebab-case: lowercase letters, numbers, and hyphens only.
   - If invalid, report the error and ask for a valid name.

3. **Check for conflicts**

   - If `.nightshift/<name>/` already exists, report: "Shift `<name>` already exists. Use `/nightshift-start <name>` to resume it."
   - STOP if conflict found.

4. **Run the bundled init script**

   ```bash
   ${CLAUDE_SKILL_DIR}/scripts/init-shift.sh <name>
   ```

   The script creates `.nightshift/<name>/` containing:
   - `manager.md` with default Shift Configuration and an empty Task Order.
   - `table.csv` empty (no header row — columns are added when tasks are defined).

5. **Ask about initial tasks**

   Use the **AskUserQuestion** tool to ask:
   > "Shift `<name>` created! Do you want to add a task now?"

   Options: "Yes, add a task" / "No, I'll add tasks later"

   If yes, guide them through the `/nightshift-add-task <name>` flow.

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
- `{column_name}` — table item column value
- `{ENV:VAR_NAME}` — environment variable from `.env`
- `{SHIFT:FOLDER}` — shift directory path
- `{SHIFT:NAME}` — shift name
- `{SHIFT:TABLE}` — full path to table.csv
```

**Guardrails**
- Always validate kebab-case naming.
- Never overwrite an existing shift.
- Use today's date (ISO YYYY-MM-DD) for the `created` field — the script handles this.
