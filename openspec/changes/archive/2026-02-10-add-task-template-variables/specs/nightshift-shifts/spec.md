## MODIFIED Requirements

### Requirement: Shift directory structure
The system SHALL store shifts in a `.nightshift/` directory at the repository root. Each shift SHALL be a subdirectory containing a `manager.md`, `table.csv`, one or more task files, and an optional `.env` file for environment variables. The `.env` file SHALL be excluded from version control.

#### Scenario: New shift directory layout
- **WHEN** a shift named "create-promo-examples" is created
- **THEN** the directory `.nightshift/create-promo-examples/` SHALL exist containing at minimum `manager.md` and `table.csv`

#### Scenario: Shift directory with .env file
- **WHEN** a user creates a `.env` file in `.nightshift/create-promo-examples/`
- **THEN** the file SHALL be recognized as the shift's environment variable source and SHALL be excluded from version control by the `.gitignore` pattern

#### Scenario: Archive directory exists
- **WHEN** the `.nightshift/` directory is initialized
- **THEN** a `.nightshift/archive/` subdirectory SHALL exist for storing completed shifts
