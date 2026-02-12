## MODIFIED Requirements

### Requirement: Manager agent role
The system SHALL define a `nightshift-manager` subagent that orchestrates shift execution. The manager SHALL read `manager.md`, `table.csv`, and the shift's `.env` file (if present), determine which items need processing, and delegate work to the dev and qa agents. The manager SHALL pass environment variable key-value pairs to the dev agent as part of the delegation context. The manager SHALL be responsible for applying step improvements to task files based on dev agent recommendations. The manager SHALL use `qsv` CLI commands for all CSV operations on `table.csv`.

#### Scenario: Manager reads shift state
- **WHEN** the manager agent is invoked for a shift
- **THEN** it SHALL read `manager.md` for task order and parallel configuration, query `table.csv` using `qsv` commands for item statuses, and read `.env` for environment variables (if the file exists) before making any delegation decisions

#### Scenario: Manager delegates to dev
- **WHEN** the manager identifies an item-task with status `todo`
- **THEN** it SHALL invoke the nightshift-dev agent with the task file contents (including Validation section), the item's row metadata (extracted via `qsv slice` and `qsv select`), environment variables from `.env` (if present), shift metadata (shift name, shift directory path), and instructions about self-validation and retry behavior, and update the item-task status to `in_progress` using `qsv edit -i`

#### Scenario: Manager delegates to qa
- **WHEN** the dev agent completes work on an item-task
- **THEN** the manager SHALL invoke the nightshift-qa agent with the task's validation criteria and the item's row metadata, and update the item-task status to `qa` using `qsv edit -i`

#### Scenario: Manager updates status after qa
- **WHEN** the qa agent returns a pass result
- **THEN** the manager SHALL update the item-task status to `done` in table.csv using `qsv edit -i`

#### Scenario: Manager handles qa failure
- **WHEN** the qa agent returns a fail result
- **THEN** the manager SHALL update the item-task status to `failed` in table.csv using `qsv edit -i` and record the failure reason

#### Scenario: Manager handles dev failure after retries
- **WHEN** the dev agent returns a failure result (after exhausting retries)
- **THEN** the manager SHALL update the item-task status to `failed` in table.csv using `qsv edit -i` and record the failure details including attempt count

#### Scenario: Manager updates progress section
- **WHEN** an item-task status changes
- **THEN** the manager SHALL update the Progress section in `manager.md` with current counts derived from `qsv search` and `qsv count` operations on `table.csv`

#### Scenario: Manager applies step improvements
- **WHEN** the manager receives results from dev agent(s) containing a Recommendations section
- **THEN** the manager SHALL review the recommendations, synthesize non-contradictory improvements, and apply a single coherent update to the Steps section of the task file before delegating the next item or batch

#### Scenario: Manager deduplicates recommendations from parallel batch
- **WHEN** the manager receives recommendations from multiple concurrent dev agents in a parallel batch
- **THEN** it SHALL identify common patterns, deduplicate similar suggestions, resolve contradictions, and apply one unified update to the Steps section

### Requirement: Manager is the sole writer of table state
The manager agent SHALL be the only agent that writes to `table.csv`. The dev and qa agents SHALL report results back to the manager, which then updates the table. All table writes SHALL use `qsv edit -i` or `qsv` output piped to the table file.

#### Scenario: Dev reports to manager
- **WHEN** the dev agent finishes executing steps
- **THEN** it SHALL return results to the manager without directly modifying table.csv

#### Scenario: QA reports to manager
- **WHEN** the qa agent finishes verification
- **THEN** it SHALL return pass/fail results to the manager without directly modifying table.csv

## ADDED Requirements

### Requirement: Manager agent qsv bash permissions
The manager agent SHALL have `qsv*` commands allowed in its bash permission configuration, as an exception to the default deny-all bash policy.

#### Scenario: Manager can execute qsv commands
- **WHEN** the manager agent needs to read or modify `table.csv`
- **THEN** it SHALL execute `qsv` subcommands via the Bash tool without permission denial

#### Scenario: Manager cannot execute non-qsv bash commands
- **WHEN** the manager agent attempts to run a bash command that does not match the `qsv*` pattern
- **THEN** the command SHALL be denied by the permission policy
