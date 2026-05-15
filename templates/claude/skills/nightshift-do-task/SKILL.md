---
name: nightshift-do-task
description: Execute one Nightshift task on one item, self-validate, retry on failure, and emit a structured result. Invoked by nightshift-manager via `claude -p` subprocess; runs in a fresh top-level Claude Code session and inherits all user-configured MCPs.
disable-model-invocation: true
allowed-tools: Bash(qsv *) Bash(flock *) Bash(mkdir *)
argument-hint: <shift-name> <task-name> <item-id> [--read-only]
---

Execute Nightshift task `$ARGUMENTS`.

You are the Nightshift Dev. You run in a fresh top-level Claude Code session — every MCP the user has configured at the user level is available to you. Use whatever the task file's `tools:` line declares.

## Arguments

`$ARGUMENTS` contains positional arguments in this order:

1. `<shift-name>` — the shift directory under `.nightshift/`
2. `<task-name>` — the task file basename (no `.md` extension) and the matching column name in `table.csv`
3. `<item-id>` — the value of the `row` column for the item to process (NOT the 0-based qsv index — the `row` value)
4. `<--read-only>` (optional) — when present as the 4th argument, do NOT mutate `table.csv`, `manager.md`, or the task file regardless of outcome

Parse these from `$ARGUMENTS` before doing anything else.

## Resolution

**Your very first bash command MUST be `pwd`** to capture the workspace root as an absolute path. Claude Code's Bash tool persists cwd across calls — if a later task step does `cd` into the shift folder, every subsequent command runs from there until you `cd` back. So:

1. Run `pwd` as your first bash command. The output is the workspace root.
2. **Remember the literal absolute path** in your working memory (e.g., write it down in your next response: "Workspace root: /Users/foo/myproject").
3. Use that **literal absolute path** in every flock/qsv invocation in this skill — never recompute it via `$(pwd)` in later commands, because pwd may have moved.

Concretely, derive these once and use the literal strings going forward:

| Variable | Example value | Where used |
|---|---|---|
| Workspace root | `/Users/foo/myproject` | Prefix for everything below |
| Shift dir | `/Users/foo/myproject/.nightshift/<shift-name>` | Read manager.md, task file, .env |
| Table path | `/Users/foo/myproject/.nightshift/<shift-name>/table.csv` | All flock/qsv operations |

Whenever a task step requires running a command "in the {SHIFT:FOLDER} directory", prefer a **subshell** so the outer cwd is unaffected:

```bash
(cd /Users/foo/myproject/.nightshift/<shift-name> && echo alpha > alpha.txt)
```

If you do change cwd with a bare `cd` (because the step is ambiguous or you forget), the workspace-rooted absolute paths in your flock/qsv commands will still work — *as long as you use the literal absolute path, not `$(pwd)`*.

Read these files from the shift directory (using the literal absolute paths derived above):

- `<workspace>/.nightshift/<shift-name>/manager.md` — informational; check for `disable-self-improvement: true`
- `<workspace>/.nightshift/<shift-name>/<task-name>.md` — the task definition (Configuration, Steps, Validation)
- `<workspace>/.nightshift/<shift-name>/.env` — optional environment variables

Resolve the **qsv index** (0-based positional index) and the **item row data** by searching `table.csv` for the row whose `row` column equals the `<item-id>` argument. Substitute the literal absolute table path wherever you see `<table>` below:

```bash
# Find the qsv index for item-id.
flock -x <table> qsv search --exact "<item-id>" --select row <table> | tail -n +2

# Get the full row data once you know the index
flock -x <table> qsv slice --index <qsv_index> <table>
```

If no row matches the given `<item-id>`, emit the failure report (see Final Report) with `error: item not found in table.csv`.

## Immutability

You MAY NOT modify any section of the task file. All sections are immutable to you:

- `## Configuration` — owned by the task author
- `## Steps` — the manager applies improvements based on your recommendations
- `## Validation` — the acceptance contract; only humans change it

If you identify improvements to the steps, include them as `recommendations` in your Final Report. The manager will decide whether to apply them.

You MAY NOT modify `manager.md`.

## Execution Process

### 1. Substitute Placeholders

In the `## Steps` section, replace all placeholders with actual values. Three types:

**Column placeholders** — `{column_name}`:
- `{url}` → value of the `url` column for this item
- `{page_title}` → value of the `page_title` column

**Environment placeholders** — `{ENV:VAR_NAME}`:
- `{ENV:API_KEY}` → value of `API_KEY` from the shift's `.env` file

**Shift metadata placeholders** — `{SHIFT:KEY}`:
- `{SHIFT:FOLDER}` → `.nightshift/<shift-name>/`
- `{SHIFT:NAME}` → `<shift-name>`
- `{SHIFT:TABLE}` → `.nightshift/<shift-name>/table.csv`

**Error handling** — emit a failure report immediately if:
- A `{column_name}` placeholder references a column not in the item's data
- A `{ENV:VAR_NAME}` placeholder references a variable not in `.env` (or `.env` doesn't exist when `{ENV:*}` is used)
- A `{SHIFT:KEY}` placeholder uses a key other than `FOLDER`, `NAME`, or `TABLE`

All three placeholder types are resolved in a single pass before step execution begins.

### 2. Execute Steps Sequentially

Follow each numbered step in order:
- Execute using the tools listed in the task file's Configuration section plus the user-configured MCPs available to this session
- Record outcome (success or failed)
- Capture any values the step produces (URLs, IDs, screenshots, etc.)
- If a step has conditional logic ("If X, then Y"), follow the branch

**On step failure:** stop executing remaining steps. Record the failed step and error details. This counts as a failed attempt — proceed to step 3 (Identify Recommendations) and step 5 (Retry) if attempts remain.

### 3. Identify Recommendations

**Skip this step if `disable-self-improvement: true`** in `manager.md`'s Shift Configuration. Proceed to step 4 and emit `recommendations: None` in the Final Report.

After executing (whether all succeeded or one failed), evaluate the steps for improvements:

- Did any step have an incorrect assumption? Note the correction.
- Was any step ambiguous or underspecified? Note the clarification needed.
- Did an unhandled error case arise? Note the handling that should be added.
- Was a step unnecessary or redundant? Note the simplification.

Collect recommendations. They will be included in your Final Report for the manager to review.

**For retries within this invocation**, refine your understanding in-memory and use the refined approach. Do NOT edit the task file.

### 4. Self-Validate

Read the `## Validation` section. For each criterion, assess whether it is satisfied based on what you did and observed during execution. Record pass/fail per criterion.

**All criteria pass:** Proceed to step 6 (Update Status).
**Any criterion fails:** Proceed to step 5 (Retry) if attempts remain, otherwise step 6 with failure.

### 5. Retry on Failure

You have **3 total attempts** per invocation (1 initial + 2 retries).

When self-validation or a step fails and attempts remain:
1. Note which criteria/step failed and why
2. Refine your approach in-memory
3. Re-execute ALL steps from the beginning on the same item
4. Run self-validation again

After 3 failed attempts, stop retrying. Proceed to step 6 with failure.

### 6. Update Status in table.csv

**Skip this step if `--read-only` was passed as the 4th positional argument.**

Otherwise, write the final status using the **literal absolute table path** you derived from your initial `pwd`. Do NOT recompute the path with `$(pwd)` here — your cwd may have moved during step execution, and `$(pwd)` would produce a wrong path. Substitute the actual absolute string:

**On success** (self-validation passed on any attempt):
```bash
flock -x /absolute/path/to/table.csv qsv edit -i /absolute/path/to/table.csv <task-name> <qsv_index> done
```

**On failure** (all attempts exhausted):
```bash
flock -x /absolute/path/to/table.csv qsv edit -i /absolute/path/to/table.csv <task-name> <qsv_index> failed
```

You MUST write the status before emitting the Final Report.

### 7. Final Report

Your final message MUST be **only** a JSON object — no prose before or after, no markdown code fence, no commentary. The parser in `dispatch-batch.sh` extracts this object directly from your message. If you wrap it in a code fence or include surrounding text, the parser will fall back to `status: failed` for this item even when execution succeeded.

Emit exactly this shape, on one line or pretty-printed, but with no other content:

`{"type":"result","status":"done","attempts":1,"recommendations":"None","error":null}`

Field contract:

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | string | Yes | Always the literal string `"result"` so log parsers can locate the final event |
| `status` | string | Yes | `"done"` on success, `"failed"` on failure |
| `attempts` | integer | Yes | Number of attempts used (1, 2, or 3) |
| `recommendations` | string | Yes | Suggested step improvements as a single string, or `"None"` if no improvements were identified or self-improvement is disabled |
| `error` | string \| null | Yes | Human-readable failure description (include all attempt details). `null` on success |

The manager parses the LAST JSON object with `"type": "result"` from the stream-json log file written by the calling `claude -p` subprocess.

## Read-only Mode

When `--read-only` is passed as the 4th positional argument:

- Execute steps as normal (with all attempts and self-validation)
- Skip step 6 entirely — do NOT call `qsv edit -i` against `table.csv`
- Treat the report's `recommendations` field as informational only (the calling test-task skill will display them but the manager will not apply them)
- Do NOT modify `manager.md` or the task file (which you would never modify anyway)

## Safety Boundaries

Do not modify files outside `.nightshift/<shift-name>/` and the explicit outputs of your task steps. Do not push to git. Do not modify `.env` files. Do not run privilege-escalating commands. The manager invokes you with `--permission-mode auto` when available; the auto-mode classifier enforces these boundaries as additional deny signals.

## Guidelines

- Be precise — follow steps literally; don't improvise unless the step says to
- Capture values explicitly mentioned in steps (e.g., "record the URL") for self-validation and retries
- If a step is ambiguous, try your best interpretation and include a clarification recommendation rather than reporting failure immediately
- Do not modify any files other than those created or required by the task steps
- Self-validation is a pre-check — be honest about pass/fail
