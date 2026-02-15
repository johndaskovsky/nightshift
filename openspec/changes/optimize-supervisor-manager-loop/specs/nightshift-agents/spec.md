## MODIFIED Requirements

### Requirement: Manager agent role
The system SHALL define a `nightshift-manager` subagent that orchestrates shift execution. The manager SHALL read `manager.md`, `table.csv`, and the shift's `.env` file (if present), determine which items need processing, and delegate work to the dev agent. The manager SHALL pass environment variable key-value pairs to the dev agent as part of the delegation context. The manager SHALL be responsible for applying step improvements to task files based on dev agent recommendations. The manager SHALL use `qsv` CLI commands for all CSV operations on `table.csv`. The manager SHALL process all remaining items autonomously within a single session, returning to the supervisor only when all work is complete.

#### Scenario: Manager reads shift state
- **WHEN** the manager agent is invoked for a shift
- **THEN** it SHALL read `manager.md` for task order and parallel configuration, query `table.csv` using `qsv` commands for item statuses, and read `.env` for environment variables (if the file exists) before making any delegation decisions

#### Scenario: Manager delegates to dev
- **WHEN** the manager identifies an item-task with status `todo`
- **THEN** it SHALL invoke the nightshift-dev agent with the task file contents (including Validation section), the item's row metadata (extracted via `qsv slice` and `qsv select`), environment variables from `.env` (if present), shift metadata (shift name, shift directory path), and instructions about self-validation and retry behavior

#### Scenario: Manager handles dev failure after retries
- **WHEN** the dev agent returns a result with `overall_status` containing `FAILED`
- **THEN** the manager SHALL log the `error` field from the dev output and proceed to the next item or batch

#### Scenario: Manager applies step improvements
- **WHEN** the manager receives results from dev agent(s) containing a `recommendations` field that is not "None"
- **THEN** the manager SHALL review the recommendations, synthesize non-contradictory improvements, and apply a single coherent update to the Steps section of the task file before delegating the next item or batch

#### Scenario: Manager deduplicates recommendations from parallel batch
- **WHEN** the manager receives recommendations from multiple concurrent dev agents in a parallel batch
- **THEN** it SHALL identify common patterns, deduplicate similar suggestions, resolve contradictions, and apply one unified update to the Steps section

#### Scenario: Manager yields to supervisor on completion
- **WHEN** the manager has processed all items and no `todo` items remain across any task column
- **THEN** the manager SHALL derive final counts from `table.csv` using `qsv search` and `qsv count` operations and output a completion summary to the supervisor

### Requirement: Decentralized status writes
The dev agent SHALL write its own status transitions to `table.csv` using `flock -x` prefixed `qsv edit -i` commands. The manager SHALL NOT write status transitions — it reads `table.csv` for status information and writes only to `manager.md` (configuration and task order) and task files (step improvements).

#### Scenario: Dev writes status on success
- **WHEN** the dev agent successfully completes execution and self-validation
- **THEN** it SHALL write `done` status to `table.csv` using `flock -x <table_path> qsv edit -i <table_path> <task_column> <qsv_index> done`

#### Scenario: Dev writes status on failure
- **WHEN** the dev agent fails after exhausting retries
- **THEN** it SHALL write `failed` status to `table.csv` using `flock -x <table_path> qsv edit -i <table_path> <task_column> <qsv_index> failed`

### Requirement: Fresh context per item
Each dev agent invocation SHALL operate with a fresh context containing only the task instructions and current item metadata — not the full shift history or other item results.

#### Scenario: Dev gets clean context
- **WHEN** the manager delegates item row 10 to the dev agent
- **THEN** the dev agent SHALL receive only: the task file content, row 10's metadata from table.csv, and any task-specific configuration — not results from rows 1-9

### Requirement: Dev agent self-validation
The dev agent SHALL evaluate the task's Validation criteria after completing step execution and before reporting results to the manager. This self-validation is the sole determination of item success or failure.

#### Scenario: Dev runs self-validation after steps complete
- **WHEN** the dev agent successfully completes all task steps for an item
- **THEN** it SHALL read the Validation section from the task file and evaluate each criterion against the execution outcomes

#### Scenario: Self-validation passes
- **WHEN** the dev agent's self-validation determines all criteria are met
- **THEN** the dev agent SHALL report success to the manager, including self-validation results and any recommendations in its output

#### Scenario: Self-validation fails triggers retry
- **WHEN** the dev agent's self-validation determines one or more criteria are not met AND the retry limit has not been reached
- **THEN** the dev agent SHALL refine its approach in-memory, re-execute the steps on the same item, and re-run self-validation

#### Scenario: Self-validation failure after retry limit
- **WHEN** the dev agent's self-validation fails AND the maximum number of attempts (3) has been reached
- **THEN** the dev agent SHALL report failure to the manager with details from all attempts and any recommendations gathered

## REMOVED Requirements

### Requirement: QA agent role
**Reason**: The dev agent's self-validation and 3-attempt retry loop provide sufficient verification. The QA agent added a redundant verification step that invoked a full agent per item without meaningfully improving accuracy.
**Migration**: The dev agent now writes `done` directly on success instead of `qa`. Validation criteria remain in task files and are used by the dev agent's self-validation.

### Requirement: QA receives item data only
**Reason**: Removed along with the QA agent role. No QA agent exists to receive data.
**Migration**: None required.

### Requirement: Manager updates progress section
**Reason**: The `## Progress` section in `manager.md` was a denormalized cache of data already canonical in `table.csv`. The manager now derives counts directly from `table.csv` via qsv at completion time.
**Migration**: The manager outputs completion counts derived from `qsv search` and `qsv count` operations on `table.csv` instead of reading them from `manager.md`.

### Requirement: Manager delegates to qa
**Reason**: Removed along with the QA agent role.
**Migration**: The dev agent writes terminal status (`done`/`failed`) directly.

### Requirement: Manager handles qa result
**Reason**: Removed along with the QA agent role.
**Migration**: None required.

### Requirement: Manager continues autonomously between batches
**Reason**: The compaction detection check that gated batch continuation has been removed. The manager always continues autonomously — this is now the default behavior, not a conditional scenario.
**Migration**: The manager processes batches in a simple loop until all items are processed.

### Requirement: Manager yields to supervisor on compaction
**Reason**: Compaction detection was an unfalsifiable self-check that added overhead without reliable detection. The existing resume logic in `table.csv` handles interrupted sessions.
**Migration**: If the manager errors out or the session is interrupted, the user re-runs `/nightshift-start` and the resume logic processes remaining `todo` items.

### Requirement: QA writes status on pass
**Reason**: Removed along with the QA agent role.
**Migration**: The dev agent writes `done` on success.

### Requirement: QA writes status on fail
**Reason**: Removed along with the QA agent role.
**Migration**: The dev agent writes `failed` on failure.

### Requirement: QA gets clean context
**Reason**: Removed along with the QA agent role.
**Migration**: None required.
