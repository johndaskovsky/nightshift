## MODIFIED Requirements

### Requirement: Test execution order
The system SHALL execute tests in a fixed sequential order that respects dependencies between commands: `init`, `nightshift-start`, `nightshift-start-parallel`.

#### Scenario: Sequential execution
- **WHEN** the test runner starts
- **THEN** tests SHALL execute in the defined order, with each test starting only after the previous test completes

#### Scenario: Continuing after failure
- **WHEN** a test fails
- **THEN** the runner SHALL continue executing subsequent tests rather than aborting the suite

## REMOVED Requirements

### Requirement: Nightshift-create command test
**Reason**: Test was removed from the implementation. The nightshift-create command relies on interactive OpenCode command execution that requires testing infrastructure not yet available.
**Migration**: No migration needed; the test may be re-added when interactive command testing is supported.

### Requirement: Nightshift-add-task command test
**Reason**: Test was removed from the implementation. The nightshift-add-task command relies on interactive OpenCode command execution that requires testing infrastructure not yet available.
**Migration**: No migration needed; the test may be re-added when interactive command testing is supported.

### Requirement: Nightshift-update-table command test
**Reason**: Test was removed from the implementation. The nightshift-update-table command relies on interactive OpenCode command execution that requires testing infrastructure not yet available.
**Migration**: No migration needed; the test may be re-added when interactive command testing is supported.

### Requirement: Nightshift-test-task command test
**Reason**: Test was removed from the implementation. The nightshift-test-task command relies on interactive OpenCode command execution that requires testing infrastructure not yet available.
**Migration**: No migration needed; the test may be re-added when interactive command testing is supported.

### Requirement: Nightshift-archive command test
**Reason**: Test was removed from the implementation. The nightshift-archive command relies on interactive OpenCode command execution that requires testing infrastructure not yet available.
**Migration**: No migration needed; the test may be re-added when interactive command testing is supported.
