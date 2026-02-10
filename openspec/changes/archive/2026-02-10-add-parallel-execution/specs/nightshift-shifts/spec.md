## MODIFIED Requirements

### Requirement: Manager file format
The system SHALL use `manager.md` as the shift execution manifest. The file SHALL contain a Shift Configuration section, a Task Order section, and a Progress section. The Shift Configuration section SHALL support an optional `parallel` field.

#### Scenario: Manager file structure
- **WHEN** a manager.md file is read
- **THEN** it SHALL contain a `## Shift Configuration` section with `name` and `created` fields (and optionally `parallel`), a `## Task Order` section with a numbered list of task names, and a `## Progress` section with `Total items`, `Completed`, `Failed`, and `Remaining` counts

#### Scenario: Task order references valid task files
- **WHEN** the Task Order section lists task name "create-page"
- **THEN** a corresponding file `create-page.md` SHALL exist in the shift directory

#### Scenario: Parallel field enabled
- **WHEN** a manager.md file contains `parallel: true` in the Shift Configuration section
- **THEN** the manager agent SHALL use adaptive batch sizing to process multiple rows concurrently for each task

#### Scenario: Parallel field omitted
- **WHEN** a manager.md file does not contain a `parallel` field in the Shift Configuration section
- **THEN** the manager agent SHALL process rows sequentially (batch size of 1)

#### Scenario: Parallel field set to false
- **WHEN** a manager.md file contains `parallel: false` in the Shift Configuration section
- **THEN** the manager agent SHALL process rows sequentially, equivalent to omitting the field
