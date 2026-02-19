## ADDED Requirements

### Requirement: Gitignore file generation
The system SHALL generate a `.nightshift/.gitignore` file during both `nightshift init` and `nightshift update` that prevents transient backup files from being committed to version control.

#### Scenario: Init creates .gitignore
- **WHEN** a user runs `nightshift init` in a directory that has no `.nightshift/.gitignore`
- **THEN** the system SHALL create `.nightshift/.gitignore` containing the line `table.csv.bak`

#### Scenario: Update creates .gitignore
- **WHEN** a user runs `nightshift update` in a directory that has no `.nightshift/.gitignore`
- **THEN** the system SHALL create `.nightshift/.gitignore` containing the line `table.csv.bak`

#### Scenario: Existing .gitignore is overwritten
- **WHEN** a user runs `nightshift init` or `nightshift update` and `.nightshift/.gitignore` already exists with different content
- **THEN** the system SHALL overwrite it with the current framework-managed content

### Requirement: Gitignore content
The `.nightshift/.gitignore` file SHALL contain ignore patterns for transient files produced during shift execution.

#### Scenario: Default ignore patterns
- **WHEN** the `.nightshift/.gitignore` file is generated
- **THEN** it SHALL contain the line `table.csv.bak`

### Requirement: Gitignore idempotency
The system SHALL produce identical `.nightshift/.gitignore` content when `init` or `update` is run multiple times in succession.

#### Scenario: Consecutive runs produce same output
- **WHEN** a user runs `nightshift init` twice with no intervening changes
- **THEN** the `.nightshift/.gitignore` file SHALL be byte-identical after both runs

### Requirement: Gitignore summary output
The system SHALL include the `.nightshift/.gitignore` file in the summary output of both `init` and `update` commands, using the same created/updated labeling as other scaffolded files.

#### Scenario: Init summary includes .gitignore
- **WHEN** `nightshift init` completes successfully
- **THEN** the summary SHALL list `.nightshift/.gitignore` with a created or updated label

#### Scenario: Update summary includes .gitignore
- **WHEN** `nightshift update` completes successfully
- **THEN** the summary SHALL list `.nightshift/.gitignore` with a created or updated label
