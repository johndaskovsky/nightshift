## MODIFIED Requirements

### Requirement: CLI init test using local build
The system SHALL include a test that validates the `nightshift init` command by running it against the locally-built CLI from the project's `dist/` directory rather than the published npm package.

#### Scenario: Build before init test
- **WHEN** the init test begins execution
- **THEN** the runner SHALL execute `pnpm build` to compile the current TypeScript source to `dist/` before invoking the CLI

#### Scenario: Init scaffolds expected directories
- **WHEN** the init test runs `nightshift init` in the workspace directory using the local build
- **THEN** the following directories SHALL exist in the workspace: `.nightshift/archive/`, `.opencode/agent/`, `.opencode/command/`

#### Scenario: Init scaffolds expected agent files
- **WHEN** the init test runs `nightshift init` in the workspace directory
- **THEN** the following files SHALL exist: `.opencode/agent/nightshift-manager.md`, `.opencode/agent/nightshift-dev.md`

#### Scenario: Init scaffolds expected command files
- **WHEN** the init test runs `nightshift init` in the workspace directory
- **THEN** the following files SHALL exist: `.opencode/command/nightshift-create.md`, `.opencode/command/nightshift-add-task.md`, `.opencode/command/nightshift-update-table.md`, `.opencode/command/nightshift-start.md`, `.opencode/command/nightshift-test-task.md`, `.opencode/command/nightshift-archive.md`

### Requirement: Nightshift-create command test
The system SHALL include a test that validates the `nightshift-create` command produces the expected shift structure.

#### Scenario: Create command produces shift files
- **WHEN** the runner executes `nightshift-create` with a test shift name in an initialized workspace
- **THEN** the following artifacts SHALL exist: `.nightshift/<shift-name>/manager.md`, `.nightshift/<shift-name>/table.csv`

#### Scenario: Create command manager file structure
- **WHEN** the runner validates the created `manager.md`
- **THEN** the file SHALL contain the sections `## Shift Configuration` and `## Task Order`

#### Scenario: Create command table structure
- **WHEN** the runner validates the created `table.csv`
- **THEN** the file SHALL contain a header row with at minimum the `row` column
