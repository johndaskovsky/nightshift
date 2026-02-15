### Requirement: CLI dependency detection
The system SHALL check for the presence of `qsv` and `flock` CLI tools during `nightshift init` and `nightshift update` by executing `qsv --version` and `flock --version`. The check SHALL use `child_process.execSync` with a timeout to avoid hanging.

#### Scenario: Both dependencies are available
- **WHEN** `nightshift init` or `nightshift update` runs dependency detection and both `qsv --version` and `flock --version` succeed
- **THEN** the system SHALL display a confirmation for each dependency in the summary output (e.g., `✓ qsv`, `✓ flock`)

#### Scenario: qsv is not installed
- **WHEN** `nightshift init` or `nightshift update` runs dependency detection and `qsv --version` fails (command not found or times out)
- **THEN** the system SHALL display a warning that qsv is not installed with the install command `brew install qsv` and a link to `https://github.com/dathere/qsv`

#### Scenario: flock is not installed
- **WHEN** `nightshift init` or `nightshift update` runs dependency detection and `flock --version` fails (command not found or times out)
- **THEN** the system SHALL display a warning that flock is not installed with the install command `brew install flock` and a link to `https://github.com/discoteq/flock`

#### Scenario: Both dependencies are missing
- **WHEN** `nightshift init` or `nightshift update` runs dependency detection and both `qsv --version` and `flock --version` fail
- **THEN** the system SHALL display warnings for both missing dependencies with their respective install instructions

### Requirement: Dependency check is non-blocking
The system SHALL treat missing dependencies as warnings, not errors. The CLI SHALL complete scaffolding successfully and exit with code 0 even when dependencies are missing, since `qsv` and `flock` are only required at shift execution time.

#### Scenario: Init succeeds with missing dependencies
- **WHEN** `nightshift init` completes and `qsv` is not installed
- **THEN** the system SHALL scaffold all directories and files normally, display the dependency warning in the summary, and exit with code 0

#### Scenario: Update succeeds with missing dependencies
- **WHEN** `nightshift update` completes and `flock` is not installed
- **THEN** the system SHALL regenerate all framework files normally, display the dependency warning in the summary, and exit with code 0

### Requirement: Dependency summary section
The system SHALL display a `--- Dependencies ---` section in the summary output of both `nightshift init` and `nightshift update`, positioned between the file list and the next-steps section.

#### Scenario: Dependencies section in init output
- **WHEN** `nightshift init` completes and displays its summary
- **THEN** the summary SHALL include a `--- Dependencies ---` section showing the status of `qsv` and `flock` (either `✓` for present or `!` with install instructions for missing)

#### Scenario: Dependencies section in update output
- **WHEN** `nightshift update` completes and displays its summary
- **THEN** the summary SHALL include a `--- Dependencies ---` section showing the status of `qsv` and `flock`

### Requirement: Shared dependency check utility
The system SHALL implement dependency checking logic in a shared utility module (`src/core/dependencies.ts`) to avoid duplicating the check across `init` and `update` commands.

#### Scenario: Utility returns structured result
- **WHEN** the dependency check utility is called
- **THEN** it SHALL return a result indicating for each dependency (`qsv`, `flock`) whether it is available (boolean) and, if available, its version string
