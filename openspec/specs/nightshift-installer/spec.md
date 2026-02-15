### Requirement: CLI entry point
The system SHALL provide a `nightshift` CLI binary installed globally via npm (`npm install -g @johndaskovsky/nightshift`) that exposes `init` and `update` subcommands via the `commander` library.

#### Scenario: CLI is invocable after global install
- **WHEN** a user runs `npm install -g @johndaskovsky/nightshift`
- **THEN** the `nightshift` command SHALL be available on the system PATH and print usage help when invoked with `--help`

#### Scenario: Version flag
- **WHEN** a user runs `nightshift --version`
- **THEN** the CLI SHALL print the version from `package.json` and exit with code 0

#### Scenario: Unknown command
- **WHEN** a user runs `nightshift foo` where `foo` is not a registered subcommand
- **THEN** the CLI SHALL print an error message and display available commands

### Requirement: Init command scaffolds directories
The system SHALL provide a `nightshift init` command that creates the required directory structure for Nightshift in the current project.

#### Scenario: Init in a fresh project
- **WHEN** a user runs `nightshift init` in a directory that has no `.nightshift/` or `.opencode/` directories
- **THEN** the system SHALL create `.nightshift/archive/`, `.opencode/agent/`, and `.opencode/command/` directories

#### Scenario: Init preserves existing directories
- **WHEN** a user runs `nightshift init` in a directory that already has `.opencode/agent/` with user-defined agent files
- **THEN** the system SHALL NOT delete or modify existing non-Nightshift files in those directories

### Requirement: Init command generates agent files
The system SHALL write the two Nightshift agent definition files from bundled templates during `nightshift init`.

#### Scenario: Agent files are written
- **WHEN** `nightshift init` completes successfully
- **THEN** the following files SHALL exist with content matching the bundled templates: `.opencode/agent/nightshift-manager.md`, `.opencode/agent/nightshift-dev.md`

#### Scenario: Agent files overwrite previous Nightshift agents
- **WHEN** `nightshift init` runs and `.opencode/agent/nightshift-manager.md` already exists from a prior installation
- **THEN** the system SHALL overwrite it with the current template version

### Requirement: Init command generates command files
The system SHALL write the six Nightshift slash command files from bundled templates during `nightshift init`.

#### Scenario: Command files are written
- **WHEN** `nightshift init` completes successfully
- **THEN** the following files SHALL exist: `.opencode/command/nightshift-create.md`, `.opencode/command/nightshift-start.md`, `.opencode/command/nightshift-archive.md`, `.opencode/command/nightshift-add-task.md`, `.opencode/command/nightshift-test-task.md`, `.opencode/command/nightshift-update-table.md`

#### Scenario: Command files overwrite previous Nightshift commands
- **WHEN** `nightshift init` runs and command files already exist from a prior installation
- **THEN** the system SHALL overwrite them with current template versions

### Requirement: Init command summary output
The system SHALL display a summary of all actions performed after `nightshift init` completes. The summary SHALL include a note about required dependencies (`qsv` and `flock`) that must be installed separately.

#### Scenario: Successful init displays summary
- **WHEN** `nightshift init` completes without errors
- **THEN** the system SHALL print a list of created/updated files, a note that `qsv` and `flock` are required dependencies (with installation instructions), and a next-steps message suggesting the user open OpenCode and run `/nightshift-create`

#### Scenario: Init with errors displays partial summary
- **WHEN** `nightshift init` encounters a non-fatal error (e.g., file write fails due to permissions)
- **THEN** the system SHALL complete all other steps, print the summary with a warning about the failed step, and exit with a non-zero exit code

### Requirement: Update command regenerates framework files
The system SHALL provide a `nightshift update` command that regenerates all framework-managed files from the current CLI version's templates.

#### Scenario: Update overwrites agent files
- **WHEN** a user runs `nightshift update`
- **THEN** the system SHALL overwrite both agent files in `.opencode/agent/` with the current bundled templates

#### Scenario: Update overwrites command files
- **WHEN** a user runs `nightshift update`
- **THEN** the system SHALL overwrite all six command files in `.opencode/command/` with the current bundled templates

### Requirement: Update command is idempotent
The system SHALL produce identical results when `nightshift update` is run multiple times in succession.

#### Scenario: Consecutive updates produce same output
- **WHEN** a user runs `nightshift update` twice with no changes to templates between runs
- **THEN** the generated files SHALL be byte-identical after both runs

#### Scenario: Update does not touch shift data
- **WHEN** a user runs `nightshift update` and `.nightshift/` contains active shift directories with `table.csv` data
- **THEN** the system SHALL NOT read, modify, or delete any files inside `.nightshift/`

### Requirement: Non-interactive mode
The system SHALL support `--force` and `--yes` flags on both `init` and `update` commands to skip all confirmation prompts.

#### Scenario: Init with --force skips all prompts
- **WHEN** a user runs `nightshift init --force`
- **THEN** the system SHALL proceed with all operations using default choices without prompting for user input

#### Scenario: Update with --yes skips confirmation
- **WHEN** a user runs `nightshift update --yes`
- **THEN** the system SHALL regenerate all files without asking for confirmation

### Requirement: npm package structure
The system SHALL be distributed as an npm package with the correct structure for global CLI installation.

#### Scenario: Package includes required files
- **WHEN** the package is published to npm
- **THEN** the published package SHALL include `bin/nightshift.js`, `dist/` (compiled JavaScript), and `templates/` (bundled Markdown files)

#### Scenario: Package excludes development files
- **WHEN** the package is published to npm
- **THEN** the published package SHALL NOT include `src/` (TypeScript source), `node_modules/`, or test files

#### Scenario: Bin entry is executable
- **WHEN** the package is installed globally
- **THEN** `bin/nightshift.js` SHALL have a `#!/usr/bin/env node` shebang and be marked executable

### Requirement: Template bundling
The system SHALL bundle all Nightshift agent and command templates inside the npm package under a `templates/` directory.

#### Scenario: Templates directory structure
- **WHEN** the npm package is inspected
- **THEN** `templates/` SHALL contain `agents/nightshift-manager.md`, `agents/nightshift-dev.md`, `commands/nightshift-create.md`, `commands/nightshift-start.md`, `commands/nightshift-archive.md`, `commands/nightshift-add-task.md`, `commands/nightshift-test-task.md`, and `commands/nightshift-update-table.md`

#### Scenario: Templates are resolvable at runtime
- **WHEN** the CLI executes `init` or `update`
- **THEN** the system SHALL resolve the templates directory relative to the installed package location (not the current working directory)

### Requirement: Build system
The system SHALL compile TypeScript source to JavaScript using a build step before publishing.

#### Scenario: Build produces dist output
- **WHEN** `npm run build` is executed
- **THEN** the system SHALL compile all TypeScript files from `src/` to `dist/` targeting ES2022 with NodeNext module resolution

#### Scenario: Build is required before publish
- **WHEN** `npm publish` is executed
- **THEN** the `prepublishOnly` script SHALL run the build step to ensure `dist/` is up to date
