## MODIFIED Requirements

### Requirement: Non-interactive mode
The system SHALL support `--force` and `--yes` flags on the `init` command, and `--yes` on the `update` command, to skip confirmation prompts. The `update` command always overwrites framework files, so `--force` is not applicable.

#### Scenario: Init with --force skips all prompts
- **WHEN** a user runs `nightshift init --force`
- **THEN** the system SHALL proceed with all operations using default choices without prompting for user input

#### Scenario: Init with --yes skips confirmation
- **WHEN** a user runs `nightshift init --yes`
- **THEN** the system SHALL proceed without asking for confirmation

#### Scenario: Update with --yes skips confirmation
- **WHEN** a user runs `nightshift update --yes`
- **THEN** the system SHALL regenerate all files without asking for confirmation

### Requirement: Build system
The system SHALL compile TypeScript source to JavaScript using a build step before publishing.

#### Scenario: Build produces dist output
- **WHEN** `pnpm run build` is executed
- **THEN** the system SHALL compile all TypeScript files from `src/` to `dist/` targeting ES2022 with NodeNext module resolution

#### Scenario: Build is required before publish
- **WHEN** `npm publish` is executed
- **THEN** the `prepublishOnly` script SHALL run the build step to ensure `dist/` is up to date
