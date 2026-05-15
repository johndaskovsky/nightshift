---
name: nightshift-start
description: Start or resume execution of a Nightshift shift by forking into the nightshift-manager subagent. Use when the user invokes /nightshift-start.
disable-model-invocation: true
context: fork
agent: nightshift-manager
allowed-tools: Bash(qsv *) Bash(flock *) Bash(test *)
argument-hint: [shift-name]
---

Execute Nightshift shift `$ARGUMENTS`.

## Pre-flight

Run the bundled pre-flight script to check shift state and emit a JSON summary:

```!
${CLAUDE_SKILL_DIR}/scripts/preflight.sh $ARGUMENTS
```

If the pre-flight reports any of these conditions, **stop without forking the manager** and report the message back to the user:

- `error: shift_not_found` → "Shift `$ARGUMENTS` does not exist. Use `/nightshift-create $ARGUMENTS` first."
- `error: no_items` → "Shift `$ARGUMENTS` has no items. Use `/nightshift-update-table $ARGUMENTS` to add items."
- `error: no_tasks` → "Shift `$ARGUMENTS` has no tasks. Use `/nightshift-add-task $ARGUMENTS` to add tasks."
- `status: complete` → "Shift `$ARGUMENTS` is already complete. Use `/nightshift-archive $ARGUMENTS` to archive it."

## Pre-flight summary

```!
${CLAUDE_SKILL_DIR}/scripts/preflight.sh $ARGUMENTS --human
```

## Your task

Read the manager.md and table.csv inside `.nightshift/$ARGUMENTS/`. Process all remaining items autonomously following the orchestration logic in your system prompt.

- Shift directory: `.nightshift/$ARGUMENTS/`
- Manager file: `.nightshift/$ARGUMENTS/manager.md` (read for task order, parallel config, disable-self-improvement flag)
- Table file: `.nightshift/$ARGUMENTS/table.csv` (read for item statuses; do not write status transitions — the dev subagent does that)
- Optional environment: `.nightshift/$ARGUMENTS/.env`

Run all `todo` items to completion (or failure after retries), apply step improvements as you go, and emit the final shift-complete summary when done.
