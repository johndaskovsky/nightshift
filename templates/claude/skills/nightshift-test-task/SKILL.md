---
name: nightshift-test-task
description: Run a single Nightshift task on a single table item for testing — without modifying table.csv or manager.md. Spawns a claude -p subprocess of /nightshift-do-task with --read-only. Use when the user invokes /nightshift-test-task.
disable-model-invocation: true
allowed-tools: Bash(qsv *) Bash(flock *) Bash(test *) Bash(ls *) Bash(claude *)
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

   Read the item's `row` column value via `flock -x .nightshift/<shift>/table.csv qsv slice --index <qsv_index> .nightshift/<shift>/table.csv | qsv select row` (where `qsv_index = item_number - 1`). Use that `row` value as `<item-id>` when invoking the do-task skill.

   Show a preview of the item via `flock -x .nightshift/<shift>/table.csv qsv slice --index <qsv_index> .nightshift/<shift>/table.csv`.

4. **Spawn the dev subprocess with --read-only**

   Invoke the `/nightshift-do-task` skill in a fresh `claude -p` subprocess with the `--read-only` flag as the 4th positional argument. This guarantees no mutation of `table.csv`, `manager.md`, or the task file. Use `--permission-mode bypassPermissions` for test-task — auto mode adds classifier overhead that isn't necessary for a one-off non-mutating run, and the read-only flag plus the do-task skill's safety boundary handle the rest.

   ```bash
   # Per-test log file (separate from manager-driven shift logs)
   mkdir -p .nightshift/<shift>/logs
   LOG_PATH=.nightshift/<shift>/logs/test-<task>-<row-value>-$(date -u +%Y-%m-%dT%H-%M-%S).jsonl

   claude -p "/nightshift-do-task <shift> <task> <row-value> --read-only. Safety: do not modify table.csv, manager.md, or any task file; this is a read-only test run." \
     --output-format stream-json \
     --verbose \
     --permission-mode bypassPermissions \
     > "$LOG_PATH" 2>&1
   ```

5. **Parse and display results**

   Find the last `{"type":"result", ...}` line in the log file and extract `status`, `attempts`, `recommendations`, and `error`. Display:

   ```
   ## Test Results: <task-name> on Item <N> (row=<row-value>)

   **Status:** <done | failed>
   **Attempts:** <number>
   **Recommendations:** <step improvements, or "None">
   **Error:** <error details if failed, omit if done>

   **Log:** <log-path>

   Note: Table state was NOT modified. This was a test run only.
   ```

   If the log file does not contain a result event (e.g. the subprocess crashed), report the subprocess's exit code and the last 20 lines of the log so the user can debug.

**Guardrails**

- NEVER modify `table.csv` during a test run.
- NEVER modify `manager.md` during a test run.
- Always pass `--read-only` as the 4th positional argument to `/nightshift-do-task` (defense in depth alongside the safety boundary prompt).
- Display detailed results so the user can debug task definitions.
- Always include the "test run only" note in output.
