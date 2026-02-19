## ADDED Requirements

### Requirement: Disable self-improvement flag
The system SHALL support an optional `disable-self-improvement` field in the `## Shift Configuration` section of `manager.md`. When set to `true`, the manager SHALL skip the Apply Step Improvements step and the dev agent SHALL skip the Identify Recommendations step, always returning `Recommendations: None`.

#### Scenario: Flag absent — self-improvement enabled by default
- **WHEN** a `manager.md` file does not contain a `disable-self-improvement` field
- **THEN** the manager agent SHALL run the Apply Step Improvements step as normal and the dev agent SHALL run the Identify Recommendations step as normal

#### Scenario: Flag set to true — self-improvement disabled
- **WHEN** a `manager.md` file contains `disable-self-improvement: true` in the Shift Configuration section
- **THEN** the manager agent SHALL skip the Apply Step Improvements step and the dev agent SHALL skip the Identify Recommendations step, always returning `Recommendations: None`

#### Scenario: Flag set to false — self-improvement enabled
- **WHEN** a `manager.md` file contains `disable-self-improvement: false` in the Shift Configuration section
- **THEN** the manager agent SHALL behave as if the flag is absent: self-improvement runs as normal

#### Scenario: Dev returns None recommendations when flag is set
- **WHEN** a dev agent is invoked for a shift with `disable-self-improvement: true`
- **THEN** the dev agent SHALL return `Recommendations: None` without executing the Identify Recommendations step
