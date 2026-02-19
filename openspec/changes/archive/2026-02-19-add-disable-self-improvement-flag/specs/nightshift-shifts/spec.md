## MODIFIED Requirements

### Requirement: Manager file format
The system SHALL use `manager.md` as the shift execution manifest. The file SHALL contain a Shift Configuration section and a Task Order section. The Shift Configuration section SHALL support an optional `parallel` field, an optional `current-batch-size` field, an optional `max-batch-size` field, and an optional `disable-self-improvement` field. The `current-batch-size` and `max-batch-size` fields SHALL only be meaningful when `parallel: true` is set.

#### Scenario: Manager file structure
- **WHEN** a manager.md file is read
- **THEN** it SHALL contain a `## Shift Configuration` section with `name` and `created` fields (and optionally `parallel`, `current-batch-size`, `max-batch-size`, and `disable-self-improvement`), and a `## Task Order` section with a numbered list of task names

#### Scenario: Task order references valid task files
- **WHEN** the Task Order section lists task name "create_page"
- **THEN** a corresponding file `create_page.md` SHALL exist in the shift directory

#### Scenario: Parallel field enabled
- **WHEN** a manager.md file contains `parallel: true` in the Shift Configuration section
- **THEN** the manager agent SHALL use adaptive batch sizing to process multiple rows concurrently for each task

#### Scenario: Parallel field omitted
- **WHEN** a manager.md file does not contain a `parallel` field in the Shift Configuration section
- **THEN** the manager agent SHALL process rows sequentially (batch size of 1)

#### Scenario: Parallel field set to false
- **WHEN** a manager.md file contains `parallel: false` in the Shift Configuration section
- **THEN** the manager agent SHALL process rows sequentially, equivalent to omitting the field

#### Scenario: Current-batch-size field present with parallel
- **WHEN** a manager.md file contains `parallel: true` and `current-batch-size: 4` in the Shift Configuration section
- **THEN** the manager agent SHALL use 4 as the initial batch size for adaptive batch sizing

#### Scenario: Current-batch-size field absent with parallel
- **WHEN** a manager.md file contains `parallel: true` but does not contain a `current-batch-size` field
- **THEN** the manager agent SHALL use the default initial batch size of 2

#### Scenario: Max-batch-size field present with parallel
- **WHEN** a manager.md file contains `parallel: true` and `max-batch-size: 10` in the Shift Configuration section
- **THEN** the manager agent SHALL not allow the adaptive batch size to exceed 10

#### Scenario: Max-batch-size field absent with parallel
- **WHEN** a manager.md file contains `parallel: true` but does not contain a `max-batch-size` field
- **THEN** the manager agent SHALL allow the adaptive batch size to grow without an upper bound

#### Scenario: Batch size fields without parallel
- **WHEN** a manager.md file contains `current-batch-size` or `max-batch-size` but does not contain `parallel: true`
- **THEN** the fields SHALL be ignored and the manager agent SHALL process rows sequentially

#### Scenario: Manager updates current-batch-size during execution
- **WHEN** the manager agent adjusts the batch size after completing a batch
- **THEN** it SHALL update the `current-batch-size` field in the Shift Configuration section of `manager.md` to reflect the new batch size

#### Scenario: Disable-self-improvement field present
- **WHEN** a manager.md file contains `disable-self-improvement: true` in the Shift Configuration section
- **THEN** the manager agent SHALL skip the Apply Step Improvements step and pass the flag to dev agents so they skip the Identify Recommendations step

#### Scenario: Disable-self-improvement field absent
- **WHEN** a manager.md file does not contain a `disable-self-improvement` field
- **THEN** the manager agent SHALL run the self-improvement cycle as normal (default behavior)
