## ADDED Requirements

### Requirement: Per-shift environment file
The system SHALL support an optional `.env` file in each shift directory (`.nightshift/<shift-name>/.env`) for defining key-value environment variables scoped to that shift.

#### Scenario: Valid .env file format
- **WHEN** a `.env` file exists in a shift directory
- **THEN** the system SHALL parse it as standard dotenv format — one `KEY=VALUE` per line, with `#` lines treated as comments and blank lines ignored

#### Scenario: .env file is optional
- **WHEN** a shift directory has no `.env` file AND no task steps reference `{ENV:*}` placeholders
- **THEN** the shift SHALL execute normally without error

#### Scenario: Missing .env when ENV placeholders used
- **WHEN** a task step references `{ENV:VAR_NAME}` AND no `.env` file exists in the shift directory
- **THEN** the dev agent SHALL report an error immediately identifying the missing `.env` file

### Requirement: ENV placeholder syntax
The system SHALL support `{ENV:VAR_NAME}` placeholders in task step definitions that resolve to values from the shift's `.env` file.

#### Scenario: ENV placeholder resolution
- **WHEN** a task step contains `{ENV:API_KEY}` AND the shift's `.env` file contains `API_KEY=sk-1234`
- **THEN** the dev agent SHALL substitute `{ENV:API_KEY}` with `sk-1234` before executing the step

#### Scenario: Missing ENV variable
- **WHEN** a task step contains `{ENV:MISSING_VAR}` AND the shift's `.env` file does not contain a `MISSING_VAR` entry
- **THEN** the dev agent SHALL report an error immediately identifying the missing environment variable `MISSING_VAR`

#### Scenario: ENV variable name is case-sensitive
- **WHEN** a task step contains `{ENV:api_key}` AND the `.env` file contains `API_KEY=value` but not `api_key=value`
- **THEN** the dev agent SHALL report an error for the missing variable `api_key`

### Requirement: SHIFT placeholder syntax
The system SHALL support `{SHIFT:FOLDER}` and `{SHIFT:NAME}` placeholders in task step definitions that resolve to shift-level metadata.

#### Scenario: SHIFT:FOLDER resolution
- **WHEN** a task step contains `{SHIFT:FOLDER}` for a shift named `create-promo-examples`
- **THEN** the dev agent SHALL substitute `{SHIFT:FOLDER}` with the shift directory path `.nightshift/create-promo-examples/`

#### Scenario: SHIFT:NAME resolution
- **WHEN** a task step contains `{SHIFT:NAME}` for a shift named `create-promo-examples`
- **THEN** the dev agent SHALL substitute `{SHIFT:NAME}` with `create-promo-examples`

#### Scenario: Unknown SHIFT variable
- **WHEN** a task step contains `{SHIFT:UNKNOWN}` where `UNKNOWN` is not `FOLDER` or `NAME`
- **THEN** the dev agent SHALL report an error identifying `UNKNOWN` as an unrecognized shift variable

### Requirement: Variable resolution in single pass
The system SHALL resolve all placeholder types (`{SHIFT:*}`, `{ENV:*}`, `{column_name}`) in a single substitution pass over the task step text, before step execution begins.

#### Scenario: Mixed placeholder types in one step
- **WHEN** a task step contains `Navigate to {ENV:BASE_URL} and update {title} in {SHIFT:FOLDER}`
- **THEN** the dev agent SHALL resolve all three placeholder types before executing the step

#### Scenario: No cross-type collisions
- **WHEN** a table column is named `ENV` and a task step contains `{ENV}`
- **THEN** the dev agent SHALL resolve `{ENV}` as a column name placeholder (unprefixed syntax), not as an environment variable prefix

### Requirement: Gitignore for shift .env files
The system SHALL ensure shift `.env` files are excluded from version control by adding `.nightshift/**/.env` to the repository's `.gitignore`.

#### Scenario: .env files gitignored
- **WHEN** a user creates a `.env` file in any shift directory
- **THEN** git SHALL not track the file due to the `.gitignore` pattern `.nightshift/**/.env`
