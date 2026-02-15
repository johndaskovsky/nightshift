## MODIFIED Requirements

### Requirement: SHIFT placeholder syntax
The system SHALL support `{SHIFT:FOLDER}`, `{SHIFT:NAME}`, and `{SHIFT:TABLE}` placeholders in task step definitions that resolve to shift-level metadata.

#### Scenario: SHIFT:FOLDER resolution
- **WHEN** a task step contains `{SHIFT:FOLDER}` for a shift named `create-promo-examples`
- **THEN** the dev agent SHALL substitute `{SHIFT:FOLDER}` with the shift directory path `.nightshift/create-promo-examples/`

#### Scenario: SHIFT:NAME resolution
- **WHEN** a task step contains `{SHIFT:NAME}` for a shift named `create-promo-examples`
- **THEN** the dev agent SHALL substitute `{SHIFT:NAME}` with `create-promo-examples`

#### Scenario: SHIFT:TABLE resolution
- **WHEN** a task step contains `{SHIFT:TABLE}` for a shift named `create-promo-examples`
- **THEN** the dev agent SHALL substitute `{SHIFT:TABLE}` with the full path to the shift's table file `.nightshift/create-promo-examples/table.csv`

#### Scenario: Unknown SHIFT variable
- **WHEN** a task step contains `{SHIFT:UNKNOWN}` where `UNKNOWN` is not `FOLDER`, `NAME`, or `TABLE`
- **THEN** the dev agent SHALL report an error identifying `UNKNOWN` as an unrecognized shift variable
