## ADDED Requirements

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

### Requirement: Manager processes tasks in order
The manager SHALL process tasks for each item in the order specified in the Task Order section of `manager.md`. A subsequent task for an item SHALL NOT begin until all preceding tasks for that item are `done`.

#### Scenario: Sequential task processing per item
- **WHEN** a shift has tasks "create-page" then "update-spreadsheet" and item row 5 has `create-page: done` and `update-spreadsheet: todo`
- **THEN** the manager SHALL process "update-spreadsheet" for row 5

#### Scenario: Blocked task skipped
- **WHEN** item row 5 has `create-page: failed` and `update-spreadsheet: todo`
- **THEN** the manager SHALL NOT process "update-spreadsheet" for row 5 since the prerequisite task failed

### Requirement: Manager is the sole writer of table state
The manager agent SHALL be the only agent that writes to `table.csv`. The dev and qa agents SHALL report results back to the manager, which then updates the table. All table writes SHALL use `qsv edit -i` or `qsv` output piped to the table file.

#### Scenario: Dev reports to manager
- **WHEN** the dev agent finishes executing steps
- **THEN** it SHALL return results to the manager without directly modifying table.csv

#### Scenario: QA reports to manager
- **WHEN** the qa agent finishes verification
- **THEN** it SHALL return pass/fail results to the manager without directly modifying table.csv

### Requirement: Dev agent role
The system SHALL define a `nightshift-dev` subagent that executes task steps on a single table item. The dev agent SHALL receive the task steps, item metadata, shift metadata, environment variables (if a `.env` file exists), and tool configuration from the manager. After execution, the dev agent SHALL run self-validation against the Validation criteria, retry up to 2 times if self-validation fails (refining its approach in-memory across retries), and report step improvement recommendations to the manager.

#### Scenario: Dev executes task steps
- **WHEN** the dev agent is invoked for task "create-page" on item row 5
- **THEN** it SHALL follow the Steps section of the task file, substituting `{column_name}` placeholders with values from row 5's metadata columns, `{ENV:VAR_NAME}` placeholders with values from the shift's `.env` file, and `{SHIFT:FOLDER}` and `{SHIFT:NAME}` placeholders with the shift directory path and shift name respectively

#### Scenario: Dev has scoped tool access
- **WHEN** the dev agent is invoked with task configuration listing `tools: playwright, google_workspace`
- **THEN** it SHALL have access to those MCP tools plus default tools (read, write, edit, glob, grep)

#### Scenario: Dev returns structured results
- **WHEN** the dev agent completes execution
- **THEN** it SHALL return to the manager: step-by-step outcomes, captured values, any error details, self-validation results, attempt count, and step improvement recommendations

#### Scenario: Dev processes one item at a time
- **WHEN** the dev agent is invoked
- **THEN** it SHALL process exactly one item (one table row) per invocation, operating with a fresh context each time

#### Scenario: Dev reports recommendations instead of editing task file
- **WHEN** the dev agent completes step execution and identifies potential improvements to the steps
- **THEN** it SHALL include the improvements as recommendations in its result output and SHALL NOT directly edit the Steps section of the task file

### Requirement: QA agent role
The system SHALL define a `nightshift-qa` subagent that verifies task completion against validation criteria. The QA agent SHALL receive the validation criteria, item metadata, and the dev agent's reported results.

#### Scenario: QA checks all validation criteria
- **WHEN** the qa agent is invoked for task "create-page" on item row 5
- **THEN** it SHALL evaluate each criterion in the Validation section independently and report pass/fail per criterion

#### Scenario: QA returns pass when all criteria met
- **WHEN** all validation criteria pass for an item-task
- **THEN** the qa agent SHALL return a pass result to the manager

#### Scenario: QA returns fail with details
- **WHEN** any validation criterion fails for an item-task
- **THEN** the qa agent SHALL return a fail result to the manager with details about which criteria failed and why

#### Scenario: QA has scoped tool access
- **WHEN** the qa agent is invoked with task configuration listing `tools: playwright, google_workspace`
- **THEN** it SHALL have access to those MCP tools plus default tools (read, write, edit, glob, grep) for verification purposes

#### Scenario: QA does not modify application state
- **WHEN** the qa agent verifies task completion
- **THEN** it SHALL only read and observe — it SHALL NOT create, modify, or delete any resources outside of reporting its findings

### Requirement: Fresh context per item
Each dev and qa agent invocation SHALL operate with a fresh context containing only the task instructions and current item metadata — not the full shift history or other item results.

#### Scenario: Dev gets clean context
- **WHEN** the manager delegates item row 10 to the dev agent
- **THEN** the dev agent SHALL receive only: the task file content, row 10's metadata from table.csv, and any task-specific configuration — not results from rows 1-9

#### Scenario: QA gets clean context
- **WHEN** the manager delegates item row 10 to the qa agent
- **THEN** the qa agent SHALL receive only: the task's validation criteria, row 10's metadata, and the dev agent's results for row 10

### Requirement: Dev agent self-validation
The dev agent SHALL evaluate the task's Validation criteria after completing step execution and before reporting results to the manager. This self-validation SHALL use the same criteria as the QA agent.

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

### Requirement: Dev agent retry loop
The dev agent SHALL retry execution when self-validation fails, up to a bounded maximum of 3 total attempts (1 initial + 2 retries) per item. The dev agent SHALL refine its approach in-memory across retries but SHALL NOT write refinements to the task file.

#### Scenario: First retry after self-validation failure
- **WHEN** the dev agent's self-validation fails on the first attempt
- **THEN** the dev agent SHALL refine its approach in-memory based on the failure, re-execute all steps from the beginning on the same item, and run self-validation again

#### Scenario: Second retry after repeated failure
- **WHEN** the dev agent's self-validation fails on the second attempt
- **THEN** the dev agent SHALL refine its approach in-memory again, re-execute, and run self-validation one final time (attempt 3 of 3)

#### Scenario: Retry limit exceeded
- **WHEN** the dev agent has exhausted all 3 attempts and self-validation still fails
- **THEN** the dev agent SHALL report failure to the manager with `overall_status: "FAILED"` and include details from all attempts and final recommendations

#### Scenario: Step execution failure during retry
- **WHEN** a step fails during a retry attempt (not a validation failure)
- **THEN** the dev agent SHALL count this as a failed attempt, refine its approach in-memory, and retry if attempts remain

### Requirement: Dev agent step self-improvement
The dev agent SHALL retain in-memory self-improvement during retries within a single invocation but SHALL NOT directly edit the Steps section of the task file. Instead, the dev agent SHALL report step improvement recommendations to the manager in its result output.

#### Scenario: Dev refines approach in-memory during retries
- **WHEN** the dev agent identifies during execution that steps could be improved (e.g., a step was ambiguous, an error case was unhandled, an assumption was wrong)
- **THEN** the dev agent SHALL refine its understanding of the steps in-memory for use in subsequent retry attempts within the same invocation

#### Scenario: Dev preserves step intent in recommendations
- **WHEN** the dev agent formulates recommendations
- **THEN** the recommendations SHALL preserve the original intent and goals of the task while suggesting improvements to execution reliability

#### Scenario: Dev does not write to task file
- **WHEN** the dev agent identifies step improvements
- **THEN** it SHALL NOT edit the Steps section of the task file directly, and SHALL instead include the improvements in its Recommendations output section

#### Scenario: Recommendations reported regardless of outcome
- **WHEN** the dev agent completes execution (success or failure)
- **THEN** it SHALL include any identified step improvements in the Recommendations section of its output, even if execution failed

### Requirement: Dev agent extended output contract
The dev agent's result format SHALL include metadata about retry attempts, self-validation results, and step improvement recommendations.

#### Scenario: Output includes attempt count
- **WHEN** the dev agent returns results to the manager
- **THEN** the results SHALL include an `Attempts` section showing the total number of attempts made (1-3)

#### Scenario: Output includes self-validation results
- **WHEN** the dev agent returns results to the manager
- **THEN** the results SHALL include a `Self-Validation` section showing pass/fail per criterion from the final attempt

#### Scenario: Output includes recommendations
- **WHEN** the dev agent returns results to the manager
- **THEN** the results SHALL include a `Recommendations` section listing any suggested step improvements, or explicitly stating "None" if no improvements were identified

#### Scenario: Output does not include steps refined flag
- **WHEN** the dev agent returns results to the manager
- **THEN** the results SHALL NOT include a `Steps Refined` flag, as the dev agent no longer modifies the task file directly

### Requirement: Manager agent qsv bash permissions
The manager agent SHALL have `qsv*` commands allowed in its bash permission configuration, as an exception to the default deny-all bash policy.

#### Scenario: Manager can execute qsv commands
- **WHEN** the manager agent needs to read or modify `table.csv`
- **THEN** it SHALL execute `qsv` subcommands via the Bash tool without permission denial

#### Scenario: Manager cannot execute non-qsv bash commands
- **WHEN** the manager agent attempts to run a bash command that does not match the `qsv*` pattern
- **THEN** the command SHALL be denied by the permission policy
