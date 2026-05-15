## MODIFIED Requirements

### Requirement: Manager agent role
The system SHALL define a `nightshift-manager` subagent that orchestrates shift execution. The manager SHALL read `manager.md`, `table.csv`, and the shift's `.env` file (if present), determine which items need processing, resolve per-task execution-config fields (`model`, `working_dir`, `worktree`) using item data and shift metadata, and dispatch work to dev subprocesses via the Bash tool (`${CLAUDE_SKILL_DIR}/scripts/dispatch-batch.sh`). The manager SHALL be responsible for applying step improvements to task files based on dev subprocess recommendations, unless `disable-self-improvement: true` is set in the Shift Configuration section of `manager.md`. The manager SHALL use `qsv` CLI commands for all CSV operations on `table.csv`. The manager SHALL process all remaining items autonomously within a single session, returning to the supervisor only when all work is complete.

#### Scenario: Manager reads shift state
- **WHEN** the manager agent is invoked for a shift
- **THEN** it SHALL read `manager.md` for task order, parallel configuration, and the `disable-self-improvement` flag; query `table.csv` using `qsv` commands for item statuses; and read `.env` for environment variables (if the file exists) before making any dispatch decisions

#### Scenario: Manager reads task execution config
- **WHEN** the manager reads `<task-name>.md` to dispatch work for that task
- **THEN** it SHALL parse the Configuration section for the fields `tools`, `model`, `working_dir`, and `worktree`, treating each as optional

#### Scenario: Manager resolves placeholders in working_dir
- **WHEN** a task's `working_dir` value contains placeholders (`{column}`, `{ENV:VAR}`, `{SHIFT:FOLDER|NAME|TABLE}`)
- **THEN** the manager SHALL substitute placeholders per-item using that item's row data, shift environment variables, and shift metadata, producing a fully-resolved literal path before manifest construction

#### Scenario: Manager performs trust pre-flight before worktree batches
- **WHEN** any item in the next batch has `worktree: true`
- **THEN** the manager SHALL collect the set of unique resolved `working_dir` values, probe each by running `claude --worktree probe-trust-<random-suffix> -p "exit"` from that directory, and abort the shift with a clear remediation message if any directory is untrusted; the manager SHALL NOT dispatch any items in the batch until trust is accepted for all directories

#### Scenario: Manager skips trust pre-flight when worktree is not used
- **WHEN** no items in the next batch have `worktree: true`
- **THEN** the manager SHALL skip the trust probe entirely

#### Scenario: Manager dispatches dev subprocess with execution-config fields
- **WHEN** the manager identifies item(s) to dispatch
- **THEN** it SHALL invoke `${CLAUDE_SKILL_DIR}/scripts/dispatch-batch.sh` with a JSON manifest containing the shift name, the items array (each entry including `item_id`, `task`, resolved `working_dir`, `worktree` boolean, `worktree_name`, and `model`), the resolved `permission_mode`, and the log directory; the helper SHALL spawn one `claude -p "/nightshift-do-task <shift> <task> <id>" --output-format stream-json --verbose --permission-mode <mode>` subprocess per item, with `--model` and `--worktree` appended per-item where set, and with cwd set to `working_dir` where set

#### Scenario: Manager fails working_dir-not-found items without retry
- **WHEN** an item's resolved `working_dir` does not exist as a directory
- **THEN** the manager SHALL write `failed` to that item's status in `table.csv`, record the failure with error message `working_dir does not exist: <path>`, and SHALL NOT retry the item

#### Scenario: Manager handles dev failure after retries
- **WHEN** a dev subprocess returns a result with `status: failed` and the item has exhausted its retry budget
- **THEN** the manager SHALL log the `error` field from the parsed result event and proceed to the next item or batch

#### Scenario: Manager surfaces preserved worktrees in completion summary
- **WHEN** the manager finishes a shift and the dispatch helper reported any `worktree_preserved` entries
- **THEN** the manager's final shift summary SHALL list each preserved worktree path so the user knows where to inspect leftover state and how to clean up (`git worktree remove --force <path>` per repo)

#### Scenario: Manager applies step improvements
- **WHEN** the manager parses dev results containing a `recommendations` field that is not "None" AND `disable-self-improvement` is not `true`
- **THEN** the manager SHALL review the recommendations, synthesize non-contradictory improvements, and apply a single coherent update to the Steps section of the task file before dispatching the next item or batch

#### Scenario: Manager skips step improvements when flag is set
- **WHEN** the manager receives results from dev subprocesses AND `disable-self-improvement: true` is set in `manager.md`
- **THEN** the manager SHALL skip the Apply Step Improvements step entirely and proceed to the next item or batch without reading or acting on the `recommendations` field

#### Scenario: Manager deduplicates recommendations from parallel batch
- **WHEN** the manager receives recommendations from multiple concurrent dev subprocesses in a parallel batch AND `disable-self-improvement` is not `true`
- **THEN** it SHALL identify common patterns, deduplicate similar suggestions, resolve contradictions, and apply one unified update to the Steps section

#### Scenario: Manager yields to supervisor on completion
- **WHEN** the manager has processed all items and no `todo` items remain across any task column
- **THEN** the manager SHALL derive final counts from `table.csv` using `qsv search` and `qsv count` operations and output a completion summary to the supervisor
