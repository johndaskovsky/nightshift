## 1. Global Configuration

- [x] 1.1 Add `"flock*": "allow"` to the global bash permissions in `opencode.jsonc`

## 2. Agent Templates -- Permission Changes

- [x] 2.1 Add `"qsv*": allow` and `"flock*": allow` to the dev agent bash permissions in `templates/agents/nightshift-dev.md`
- [x] 2.2 Add `"qsv*": allow` and `"flock*": allow` to the QA agent bash permissions in `templates/agents/nightshift-qa.md`
- [x] 2.3 Add `"flock*": allow` to the manager agent bash permissions in `templates/agents/nightshift-manager.md`

## 3. State Machine -- Remove `in_progress`

- [x] 3.1 Update the manager template to remove all references to `in_progress` status (state machine docs, status setting, stale-state recovery)
- [x] 3.2 Update the dev agent template to remove any `in_progress` references
- [x] 3.3 Update the QA agent template to remove any `in_progress` references

## 4. Decentralized State Management -- Dev Agent

- [x] 4.1 Add a `## State Update` section to the dev agent template with instructions to write `qa` on success or `failed` on failure using `flock -x <table_path> qsv edit -i`
- [x] 4.2 Document the `table_path`, `task_column`, and `qsv_index` parameters the dev agent receives from the manager

## 5. Decentralized State Management -- QA Agent

- [x] 5.1 Add a `## State Update` section to the QA agent template with instructions to write `done` on pass or `failed` on fail using `flock -x <table_path> qsv edit -i`
- [x] 5.2 Document the `table_path`, `task_column`, and `qsv_index` parameters the QA agent receives from the manager

## 6. Decentralized State Management -- Manager Agent

- [x] 6.1 Remove all `qsv edit -i` status-transition writes from the manager template (manager no longer writes `in_progress`, `qa`, `done`, or `failed`)
- [x] 6.2 Update manager delegation prompts to include `table_path`, `task_column`, and `qsv_index` in a `## State Update` section for both dev and QA invocations
- [x] 6.3 Update the manager to read updated statuses from `table.csv` after dev agents return (using `flock -x` qsv search) to determine which items are `qa` vs `failed`

## 7. flock Wrapping -- All qsv Operations

- [x] 7.1 Prefix all `qsv` commands in the manager template with `flock -x <table_path>`
- [x] 7.2 Prefix all `qsv` commands in the dev agent template with `flock -x <table_path>`
- [x] 7.3 Prefix all `qsv` commands in the QA agent template with `flock -x <table_path>`
- [x] 7.4 Prefix all `qsv` commands in command templates (`nightshift-start.md`, `nightshift-add-task.md`, `nightshift-update-table.md`, `nightshift-create.md`) with `flock -x <table_path>`

## 8. Template Variable -- `{SHIFT:TABLE}`

- [x] 8.1 Add `{SHIFT:TABLE}` to the dev agent template's placeholder resolution section, resolving to the full path of the shift's `table.csv`
- [x] 8.2 Update the valid `{SHIFT:KEY}` list from `FOLDER, NAME` to `FOLDER, NAME, TABLE` in the dev agent template's error handling section
- [x] 8.3 Update the manager delegation prompt to pass the table path so `{SHIFT:TABLE}` can be resolved

## 9. Conditional Recommendation Incorporation

- [x] 9.1 Update the manager template to check `overall_status` before applying dev recommendations -- only apply from `SUCCESS` processes
- [x] 9.2 Add explicit instruction to discard recommendations from dev processes with `FAILED` status

## 10. Manager Progress Reporting

- [x] 10.1 Add progress reporting instructions to the manager template: output `Progress: M/N` and `Compacted: true|false` after each batch
- [x] 10.2 Add compaction detection logic to the manager template: check for expected context (shift name, directory, current task) at the start of each batch

## 11. nightshift-start Supervisor Loop

- [x] 11.1 Update `templates/commands/nightshift-start.md` to replace single Task tool invocation with a supervisor loop that re-invokes the manager after each progress report
- [x] 11.2 Add compaction recovery logic: discard manager session and start fresh when `Compacted: true` is detected
- [x] 11.3 Add loop termination condition: exit when no `todo` items remain

## 12. Pre-flight Dependency Checks

- [x] 12.1 Update `templates/commands/nightshift-start.md` pre-flight to require `qsv` (error instead of warning if missing)
- [x] 12.2 Add `flock` pre-flight check to `templates/commands/nightshift-start.md` (error if `flock --version` fails, with install instructions)

## 13. Parallel Execution Updates

- [x] 13.1 Remove `in_progress` claim mechanism from the manager template's parallel batch dispatch phase
- [x] 13.2 Update batch collection phase in the manager template to read statuses from `table.csv` instead of relying on manager-written states
- [x] 13.3 Update QA dispatch in parallel mode to dispatch for items where dev wrote `qa` status

## 14. Resume Logic Simplification

- [x] 14.1 Remove stale-state recovery from the manager template (no more resetting `in_progress` or `qa` to `todo` on startup)
- [x] 14.2 Add logic for the manager to dispatch QA agents for items with `qa` status on resume (treating `qa` as a durable state)

## 15. README Updates

- [x] 15.1 Update the state machine diagram to show 4 states: `todo -> qa -> done | failed` (remove `in_progress`)
- [x] 15.2 Update Prerequisites section: change qsv from "optional but strongly recommended" to required; add flock as a required dependency with install instructions
- [x] 15.3 Add `{SHIFT:TABLE}` to the Template Variables section alongside `{SHIFT:FOLDER}` and `{SHIFT:NAME}`
- [x] 15.4 Update the Agent Permissions table to show dev and QA with `qsv`, `flock` bash access
- [x] 15.5 Update Execution Details sections: remove `in_progress` references from Resumability, update agent role descriptions in How It Works
- [x] 15.6 Update example `table.csv` snippets to remove `in_progress` status values

## 16. AGENTS.md Updates

- [x] 16.1 Update the state machine in AGENTS.md to show 4 states (remove `in_progress`)
- [x] 16.2 Update the permissions table to reflect dev and QA bash access (`qsv*`, `flock*`)
- [x] 16.3 Update "Key architectural rules" to reflect decentralized state management (manager no longer sole writer of `table.csv`)
