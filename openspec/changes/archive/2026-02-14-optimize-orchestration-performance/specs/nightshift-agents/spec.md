## MODIFIED Requirements

### Requirement: Manager agent role
The system SHALL define a `nightshift-manager` subagent that orchestrates shift execution. The manager SHALL read `manager.md`, `table.csv`, and the shift's `.env` file (if present), determine which items need processing, and delegate work to the dev and qa agents. The manager SHALL pass environment variable key-value pairs to the dev agent as part of the delegation context. The manager SHALL be responsible for applying step improvements to task files based on dev agent recommendations. The manager SHALL use `qsv` CLI commands for all CSV operations on `table.csv`. The manager SHALL process all remaining batches autonomously within a single session, only returning to the supervisor when it detects compaction or completes all work.

#### Scenario: Manager reads shift state
- **WHEN** the manager agent is invoked for a shift
- **THEN** it SHALL read `manager.md` for task order and parallel configuration, query `table.csv` using `qsv` commands for item statuses, and read `.env` for environment variables (if the file exists) before making any delegation decisions

#### Scenario: Manager delegates to dev
- **WHEN** the manager identifies an item-task with status `todo`
- **THEN** it SHALL invoke the nightshift-dev agent with the task file contents (including Validation section), the item's row metadata (extracted via `qsv slice` and `qsv select`), environment variables from `.env` (if present), shift metadata (shift name, shift directory path), and instructions about self-validation and retry behavior

#### Scenario: Manager delegates to qa
- **WHEN** the dev agent completes work on an item-task with `overall_status` indicating success
- **THEN** the manager SHALL verify the dev wrote `qa` status to `table.csv` and invoke the nightshift-qa agent with the task's validation criteria, the item's row metadata, and state update parameters

#### Scenario: Manager handles qa result
- **WHEN** the qa agent returns a result
- **THEN** the manager SHALL read the `overall_status` field from the QA output and log the `summary` if the result is `FAIL`

#### Scenario: Manager handles dev failure after retries
- **WHEN** the dev agent returns a result with `overall_status` containing `FAILED`
- **THEN** the manager SHALL log the `error` field from the dev output and skip QA for this item

#### Scenario: Manager updates progress section
- **WHEN** an item-task status changes
- **THEN** the manager SHALL update the Progress section in `manager.md` with current counts derived from `qsv search` and `qsv count` operations on `table.csv`

#### Scenario: Manager applies step improvements
- **WHEN** the manager receives results from dev agent(s) containing a `recommendations` field that is not "None"
- **THEN** the manager SHALL review the recommendations, synthesize non-contradictory improvements, and apply a single coherent update to the Steps section of the task file before delegating the next item or batch

#### Scenario: Manager deduplicates recommendations from parallel batch
- **WHEN** the manager receives recommendations from multiple concurrent dev agents in a parallel batch
- **THEN** it SHALL identify common patterns, deduplicate similar suggestions, resolve contradictions, and apply one unified update to the Steps section

#### Scenario: Manager continues autonomously between batches
- **WHEN** the manager completes a batch and compaction detection reports `Compacted: false`
- **THEN** the manager SHALL proceed directly to the next batch without returning to the supervisor

#### Scenario: Manager yields to supervisor on compaction
- **WHEN** the manager completes a batch and compaction detection reports `Compacted: true`
- **THEN** the manager SHALL output `Progress: M/N` and `Compacted: true` and return to the supervisor

#### Scenario: Manager yields to supervisor on completion
- **WHEN** the manager completes a batch and no `todo` items remain across any task column
- **THEN** the manager SHALL output a final summary with `Progress: M/N` and `Compacted: false` and return to the supervisor

### Requirement: Dev agent extended output contract
The dev agent's result format returned to the manager SHALL include only the fields the manager acts on: `overall_status`, `recommendations`, and `error` (if failed). Verbose fields (per-step outcomes, captured values, self-validation details, attempt count) SHALL NOT be included in the output returned to the manager. The dev agent SHALL still use these fields internally for retry decisions and self-validation.

#### Scenario: Output includes overall status
- **WHEN** the dev agent returns results to the manager
- **THEN** the results SHALL include an `overall_status` field with value `SUCCESS`, `FAILED (step N)`, or `FAILED (validation)`

#### Scenario: Output includes recommendations
- **WHEN** the dev agent returns results to the manager
- **THEN** the results SHALL include a `recommendations` field listing any suggested step improvements, or explicitly stating "None" if no improvements were identified

#### Scenario: Output includes error on failure
- **WHEN** the dev agent returns results with `overall_status` containing `FAILED`
- **THEN** the results SHALL include an `error` field with the full failure description including details from all attempts

#### Scenario: Output excludes verbose fields
- **WHEN** the dev agent returns results to the manager
- **THEN** the results SHALL NOT include `Steps`, `Captured Values`, `Self-Validation`, or `Attempts` sections

### Requirement: QA agent role
The system SHALL define a `nightshift-qa` subagent that verifies task completion against validation criteria. The QA agent SHALL receive the validation criteria, item metadata, and state update parameters. The QA agent SHALL NOT receive the dev agent's results.

#### Scenario: QA checks all validation criteria
- **WHEN** the qa agent is invoked for task "create_page" on item row 5
- **THEN** it SHALL evaluate each criterion in the Validation section independently using its own tools (Read, Glob, Grep, Playwright, MCP tools as configured) and report pass/fail per criterion internally

#### Scenario: QA returns pass when all criteria met
- **WHEN** all validation criteria pass for an item-task
- **THEN** the qa agent SHALL return a result with `overall_status: "PASS"` and a `summary` field

#### Scenario: QA returns fail with summary
- **WHEN** any validation criterion fails for an item-task
- **THEN** the qa agent SHALL return a result with `overall_status: "FAIL"` and a `summary` field explaining which criteria failed and why

#### Scenario: QA has scoped tool access
- **WHEN** the qa agent is invoked with task configuration listing `tools: playwright, google_workspace`
- **THEN** it SHALL have access to those MCP tools plus default tools (read, write, edit, glob, grep) for verification purposes

#### Scenario: QA does not modify application state
- **WHEN** the qa agent verifies task completion
- **THEN** it SHALL only read and observe — it SHALL NOT create, modify, or delete any resources outside of reporting its findings

#### Scenario: QA output excludes per-criterion details
- **WHEN** the qa agent returns results to the manager
- **THEN** the results SHALL NOT include a per-criterion `Criteria` section in the output returned to the manager

### Requirement: QA receives item data only
The QA agent SHALL receive only the validation criteria from the task file, the item's row metadata, and state update parameters. The QA agent SHALL NOT receive the dev agent's results. QA SHALL verify task completion independently using its own tools and the item data.

#### Scenario: QA prompt excludes dev results
- **WHEN** the manager delegates to the QA agent
- **THEN** the delegation prompt SHALL NOT include a `## Dev Results` section

#### Scenario: QA verifies independently
- **WHEN** the QA agent checks a validation criterion
- **THEN** it SHALL use its own tools to verify the criterion against observable state, using the item data (column values) as context for what to check
