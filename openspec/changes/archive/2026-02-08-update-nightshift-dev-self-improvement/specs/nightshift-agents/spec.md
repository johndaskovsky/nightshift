## ADDED Requirements

### Requirement: Dev agent self-validation
The dev agent SHALL evaluate the task's Validation criteria after completing step execution and before reporting results to the manager. This self-validation SHALL use the same criteria as the QA agent.

#### Scenario: Dev runs self-validation after steps complete
- **WHEN** the dev agent successfully completes all task steps for an item
- **THEN** it SHALL read the Validation section from the task file and evaluate each criterion against the execution outcomes

#### Scenario: Self-validation passes
- **WHEN** the dev agent's self-validation determines all criteria are met
- **THEN** the dev agent SHALL report success to the manager, including self-validation results in its output

#### Scenario: Self-validation fails triggers retry
- **WHEN** the dev agent's self-validation determines one or more criteria are not met AND the retry limit has not been reached
- **THEN** the dev agent SHALL refine the Steps section, re-execute the steps on the same item, and re-run self-validation

#### Scenario: Self-validation failure after retry limit
- **WHEN** the dev agent's self-validation fails AND the maximum number of attempts (3) has been reached
- **THEN** the dev agent SHALL report failure to the manager with details from all attempts

### Requirement: Dev agent retry loop
The dev agent SHALL retry execution when self-validation fails, up to a bounded maximum of 3 total attempts (1 initial + 2 retries) per item.

#### Scenario: First retry after self-validation failure
- **WHEN** the dev agent's self-validation fails on the first attempt
- **THEN** the dev agent SHALL refine the Steps section based on the failure, re-execute all steps from the beginning on the same item, and run self-validation again

#### Scenario: Second retry after repeated failure
- **WHEN** the dev agent's self-validation fails on the second attempt
- **THEN** the dev agent SHALL refine steps again, re-execute, and run self-validation one final time (attempt 3 of 3)

#### Scenario: Retry limit exceeded
- **WHEN** the dev agent has exhausted all 3 attempts and self-validation still fails
- **THEN** the dev agent SHALL report failure to the manager with `overall_status: "FAILED"` and include details from all attempts

#### Scenario: Step execution failure during retry
- **WHEN** a step fails during a retry attempt (not a validation failure)
- **THEN** the dev agent SHALL count this as a failed attempt, refine steps, and retry if attempts remain

### Requirement: Dev agent step self-improvement
After executing task steps on an item, the dev agent SHALL update the Steps section of the task file to reflect improvements discovered during execution. The dev agent SHALL NOT modify the Configuration or Validation sections.

#### Scenario: Dev refines steps based on execution feedback
- **WHEN** the dev agent identifies during execution that steps could be improved (e.g., a step was ambiguous, an error case was unhandled, an assumption was wrong)
- **THEN** the dev agent SHALL update the Steps section in the task `.md` file with clearer, more robust instructions

#### Scenario: Dev preserves step intent
- **WHEN** the dev agent refines steps
- **THEN** the refined steps SHALL preserve the original intent and goals of the task while improving execution reliability

#### Scenario: Self-improvement occurs before self-validation
- **WHEN** the dev agent completes step execution on an item
- **THEN** it SHALL first refine steps (if improvements are identified), then run self-validation on the execution outcomes

### Requirement: Dev agent extended output contract
The dev agent's result format SHALL include metadata about retry attempts and self-validation results, in addition to the existing output contract fields.

#### Scenario: Output includes attempt count
- **WHEN** the dev agent returns results to the manager
- **THEN** the results SHALL include an `Attempts` section showing the total number of attempts made (1-3)

#### Scenario: Output includes self-validation results
- **WHEN** the dev agent returns results to the manager
- **THEN** the results SHALL include a `Self-Validation` section showing pass/fail per criterion from the final attempt

#### Scenario: Output includes step refinement flag
- **WHEN** the dev agent refined steps during execution
- **THEN** the results SHALL indicate that steps were refined, so the manager and QA have visibility into task file changes

## MODIFIED Requirements

### Requirement: Dev agent role
The system SHALL define a `nightshift-dev` subagent that executes task steps on a single table item. The dev agent SHALL receive the task steps, item metadata, and tool configuration from the manager. After execution, the dev agent SHALL refine the Steps section of the task file, run self-validation against the Validation criteria, and retry up to 2 times if self-validation fails.

#### Scenario: Dev executes task steps
- **WHEN** the dev agent is invoked for task "create-page" on item row 5
- **THEN** it SHALL follow the Steps section of the task file, substituting `{column_name}` placeholders with values from row 5's metadata columns

#### Scenario: Dev has scoped tool access
- **WHEN** the dev agent is invoked with task configuration listing `tools: playwright, google_workspace`
- **THEN** it SHALL have access to those MCP tools plus default tools (read, write, edit, glob, grep)

#### Scenario: Dev returns structured results
- **WHEN** the dev agent completes execution
- **THEN** it SHALL return to the manager: step-by-step outcomes, captured values, any error details, self-validation results, attempt count, whether steps were refined, and whether execution completed or was halted by a failure

#### Scenario: Dev processes one item at a time
- **WHEN** the dev agent is invoked
- **THEN** it SHALL process exactly one item (one table row) per invocation, operating with a fresh context each time

#### Scenario: Dev self-improves and self-validates
- **WHEN** the dev agent completes step execution
- **THEN** it SHALL refine the Steps section if improvements are identified, run self-validation against the Validation criteria, and retry execution if self-validation fails (up to 3 total attempts)

### Requirement: Manager delegates to dev
The manager SHALL delegate item-task execution to the dev agent. The delegation prompt SHALL inform the dev agent of its self-improvement, self-validation, and retry responsibilities.

#### Scenario: Manager delegates to dev
- **WHEN** the manager identifies an item-task with status `todo`
- **THEN** it SHALL invoke the nightshift-dev agent with the task file contents (including Validation section), the item's row metadata, and instructions about self-improvement, self-validation, and retry behavior, and update the item-task status to `in_progress`

### Requirement: Manager handles qa failure
The manager SHALL handle QA failures. When the QA agent returns a fail result, the manager SHALL update the item-task status to `failed` in table.csv and record the failure reason.

#### Scenario: Manager handles qa failure
- **WHEN** the qa agent returns a fail result
- **THEN** the manager SHALL update the item-task status to `failed` in table.csv and record the failure reason

#### Scenario: Manager handles dev failure after retries
- **WHEN** the dev agent returns a failure result (after exhausting retries)
- **THEN** the manager SHALL update the item-task status to `failed` in table.csv and record the failure details including attempt count
