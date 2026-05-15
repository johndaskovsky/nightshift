# nightshift-installer Specification

## Purpose
Defines the CLI installer: scaffolding directories, writing template files, merging settings, summary output, and idempotency.
## Requirements
### Requirement: CLI entry point
The system SHALL provide a `nightshift` CLI binary installed globally via npm (`npm install -g @johndaskovsky/nightshift`) that exposes the `init` subcommand via the `commander` library.

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
The system SHALL provide a `nightshift init` command that creates the required directory structure for Nightshift in the current project. The command SHALL always create the Claude Code directory tree alongside the shared `.nightshift/` shift directory.

#### Scenario: Init in a fresh project
- **WHEN** a user runs `nightshift init` in a directory that has no `.nightshift/` or `.claude/` directories
- **THEN** the system SHALL create `.nightshift/archive/`, `.claude/agents/`, and `.claude/skills/` directories

#### Scenario: Init preserves existing directories
- **WHEN** a user runs `nightshift init` in a directory that already has user-defined files in `.claude/agents/`
- **THEN** the system SHALL NOT delete or modify existing non-Nightshift files in those directories

### Requirement: Init command generates agent files
The system SHALL write the two Nightshift Claude Code subagent files from bundled templates during `nightshift init`.

#### Scenario: Agent files are written
- **WHEN** `nightshift init` completes successfully
- **THEN** the following files SHALL exist with content matching the bundled templates: `.claude/agents/nightshift-manager.md`, `.claude/agents/nightshift-dev.md`

#### Scenario: Agent files overwrite previous Nightshift agents
- **WHEN** `nightshift init` runs and `.claude/agents/nightshift-manager.md` already exists from a prior installation
- **THEN** the system SHALL overwrite it with the current template version

### Requirement: Init command summary output
The system SHALL display a summary of all actions performed after `nightshift init` completes. The summary SHALL include a list of files written, a dependencies section that actively verifies whether `qsv` and `flock` are installed (with install instructions for any that are missing), and a next-steps section.

#### Scenario: First-run init displays summary with next steps
- **WHEN** `nightshift init` completes without errors in a directory that has not been previously initialized
- **THEN** the system SHALL print a banner "Initializing Nightshift...", a list of created files, a `--- Dependencies ---` section showing the availability of `qsv` and `flock` (with install instructions for any that are missing), and a `--- Next Steps ---` section instructing the user to open Claude Code and run `/nightshift-create`

#### Scenario: Re-run init displays update summary
- **WHEN** `nightshift init` completes without errors in a directory that has been previously initialized
- **THEN** the system SHALL print a banner "Updating Nightshift files...", a list of updated files, the `--- Dependencies ---` section, and an "Update complete." message

#### Scenario: Init with errors displays partial summary
- **WHEN** `nightshift init` encounters a non-fatal error (e.g., file write fails due to permissions)
- **THEN** the system SHALL complete all other steps, print the summary with a warning about the failed step, and exit with a non-zero exit code

### Requirement: Init command is idempotent
The system SHALL produce identical file content when `nightshift init` is run multiple times in succession.

#### Scenario: Consecutive inits produce same output
- **WHEN** a user runs `nightshift init` twice with no changes to templates between runs
- **THEN** the generated files SHALL be byte-identical after both runs

#### Scenario: Init does not touch shift data
- **WHEN** a user runs `nightshift init` and `.nightshift/` contains active shift directories with `table.csv` data
- **THEN** the system SHALL NOT read, modify, or delete any files inside shift directories under `.nightshift/`

### Requirement: First-run detection
The system SHALL detect whether Nightshift has been previously initialized in the target directory by checking for the existence of `.claude/agents/nightshift-manager.md`. This detection SHALL be used solely for adjusting CLI output messaging and SHALL NOT affect the scaffolding behavior (files are always overwritten).

#### Scenario: Fresh directory detected as first run
- **WHEN** `nightshift init` runs and `.claude/agents/nightshift-manager.md` does not exist
- **THEN** the system SHALL use first-run messaging

#### Scenario: Previously initialized directory detected as re-run
- **WHEN** `nightshift init` runs and `.claude/agents/nightshift-manager.md` already exists
- **THEN** the system SHALL use re-run messaging

### Requirement: Non-interactive mode
The system SHALL accept the standard `--help` flag and the `--version` flag on the root command. The `init` command SHALL operate non-interactively with no confirmation prompts and SHALL accept no runtime-selection flags.

#### Scenario: Init runs without prompts
- **WHEN** a user runs `nightshift init`
- **THEN** the system SHALL proceed with all operations without prompting for user input

#### Scenario: Unknown flag rejected
- **WHEN** a user runs `nightshift init --target=claude` (or any other unrecognized flag)
- **THEN** commander SHALL print an "unknown option" error and exit with a non-zero status

### Requirement: npm package structure
The system SHALL be distributed as an npm package with the correct structure for global CLI installation, and the same package SHALL include a Claude Code Plugin manifest so the package can also be installed via Claude Code's plugin discovery.

#### Scenario: Package includes required CLI files
- **WHEN** the package is published to npm
- **THEN** the published package SHALL include `bin/nightshift.js`, `dist/` (compiled JavaScript), and `templates/claude/` (bundled Markdown files for the Claude Code runtime)

#### Scenario: Package includes plugin manifest and bundled artifacts
- **WHEN** the package is published to npm
- **THEN** the published package SHALL include `.claude-plugin/plugin.json`, an `agents/` directory containing the Claude subagent files, and a `skills/` directory containing the Claude skill directories, all materialized from `templates/claude/`

#### Scenario: Package excludes development files
- **WHEN** the package is published to npm
- **THEN** the published package SHALL NOT include `src/` (TypeScript source), `node_modules/`, or test files

#### Scenario: Package excludes legacy OpenCode templates
- **WHEN** the package is published to npm
- **THEN** the published package SHALL NOT contain any `templates/opencode/` directory

#### Scenario: Bin entry is executable
- **WHEN** the package is installed globally
- **THEN** `bin/nightshift.js` SHALL have a `#!/usr/bin/env node` shebang and be marked executable

### Requirement: Template bundling
The system SHALL bundle all Nightshift agent, skill, and Claude Code project-file templates inside the npm package under `templates/claude/`.

#### Scenario: Templates directory structure
- **WHEN** the npm package is inspected
- **THEN** `templates/claude/` SHALL contain `agents/nightshift-manager.md`, `skills/nightshift-create/SKILL.md`, `skills/nightshift-add-task/SKILL.md`, `skills/nightshift-update-table/SKILL.md`, `skills/nightshift-start/SKILL.md`, `skills/nightshift-start/scripts/dispatch-batch.sh`, `skills/nightshift-test-task/SKILL.md`, `skills/nightshift-archive/SKILL.md`, `skills/nightshift-do-task/SKILL.md`, plus per-skill `scripts/` subdirectories where applicable, a `CLAUDE.md` template, and a `settings.json` template fragment. `templates/claude/` SHALL NOT contain `agents/nightshift-dev.md`.

#### Scenario: Templates are resolvable at runtime
- **WHEN** the CLI executes `init`
- **THEN** the system SHALL resolve the templates directory relative to the installed package location (not the current working directory)

### Requirement: Build system
The system SHALL compile TypeScript source to JavaScript using a build step before publishing.

#### Scenario: Build produces dist output
- **WHEN** `pnpm run build` is executed
- **THEN** the system SHALL compile all TypeScript files from `src/` to `dist/` targeting ES2022 with NodeNext module resolution

#### Scenario: Build is required before publish
- **WHEN** `npm publish` is executed
- **THEN** the `prepublishOnly` script SHALL run the build step to ensure `dist/` is up to date

### Requirement: Init writes Claude agent files
The system SHALL write one Claude Code subagent file from bundled templates: `.claude/agents/nightshift-manager.md`. The dev role is no longer a subagent in 3.x — there SHALL NOT be a `.claude/agents/nightshift-dev.md` file written by init.

#### Scenario: Claude manager subagent written
- **WHEN** `nightshift init` completes successfully
- **THEN** `.claude/agents/nightshift-manager.md` SHALL exist with content matching the bundled `templates/claude/agents/nightshift-manager.md`

#### Scenario: No dev subagent written
- **WHEN** `nightshift init` completes successfully
- **THEN** `.claude/agents/nightshift-dev.md` SHALL NOT be written

#### Scenario: Manager file overwritten on re-run
- **WHEN** `nightshift init` runs and `.claude/agents/nightshift-manager.md` already exists from a prior installation
- **THEN** the system SHALL overwrite it with the current template version

### Requirement: Init writes Claude skill directories
The system SHALL write seven skill directories under `.claude/skills/`, each containing a `SKILL.md` and (where applicable) a `scripts/` subdirectory of executables. The seven skills are: `nightshift-create`, `nightshift-add-task`, `nightshift-update-table`, `nightshift-start`, `nightshift-test-task`, `nightshift-archive`, and `nightshift-do-task`.

#### Scenario: Skill directories written
- **WHEN** `nightshift init` completes successfully
- **THEN** the directories `.claude/skills/nightshift-create/`, `.claude/skills/nightshift-add-task/`, `.claude/skills/nightshift-update-table/`, `.claude/skills/nightshift-start/`, `.claude/skills/nightshift-test-task/`, `.claude/skills/nightshift-archive/`, and `.claude/skills/nightshift-do-task/` SHALL each contain a `SKILL.md`

#### Scenario: Dispatch helper installed alongside start skill
- **WHEN** `nightshift init` completes successfully
- **THEN** `.claude/skills/nightshift-start/scripts/dispatch-batch.sh` SHALL exist with mode `0755`

#### Scenario: Skill scripts marked executable
- **WHEN** the system writes a script file under `.claude/skills/<skill-name>/scripts/`
- **THEN** the file SHALL be set to mode `0755` (executable)

#### Scenario: Skill files overwritten on re-run
- **WHEN** `nightshift init` runs and `.claude/skills/nightshift-start/SKILL.md` already exists from a prior installation
- **THEN** the system SHALL overwrite it with the current template version

### Requirement: Init writes Claude settings.json
When the effective target includes Claude, the system SHALL ensure `.claude/settings.json` exists with `permissions.allow` entries for `Bash(qsv *)` and `Bash(flock *)`.

#### Scenario: settings.json created in greenfield
- **WHEN** `nightshift init --target=claude` runs and `.claude/settings.json` does not exist
- **THEN** the system SHALL create the file with `permissions.allow` containing both required entries and SHALL NOT include any other keys

#### Scenario: settings.json merged when user-authored
- **WHEN** `nightshift init --target=claude` runs and `.claude/settings.json` exists with user-authored permissions or other settings
- **THEN** the system SHALL preserve all existing keys and entries, add `Bash(qsv *)` and `Bash(flock *)` to `permissions.allow` if absent, and write the result back

#### Scenario: settings.json idempotent merge
- **WHEN** `nightshift init --target=claude` runs twice in a project
- **THEN** the second run SHALL NOT duplicate the `Bash(qsv *)` or `Bash(flock *)` entries in `permissions.allow`

#### Scenario: Malformed settings.json halts init
- **WHEN** `nightshift init --target=claude` runs and `.claude/settings.json` exists but is not valid JSON
- **THEN** the system SHALL abort with a clear error naming the file, SHALL NOT overwrite it, and SHALL exit with a non-zero status

### Requirement: Init writes CLAUDE.md
When the effective target includes Claude, the system SHALL ensure a project-level `CLAUDE.md` exists with a Nightshift-managed section delimited by `<!-- nightshift:start -->` and `<!-- nightshift:end -->` markers.

#### Scenario: CLAUDE.md created when absent
- **WHEN** `nightshift init --target=claude` runs and `CLAUDE.md` does not exist
- **THEN** the system SHALL create `CLAUDE.md` containing the Nightshift section wrapped by the two markers

#### Scenario: CLAUDE.md section replaced when markers present
- **WHEN** `nightshift init --target=claude` runs and `CLAUDE.md` exists with both markers
- **THEN** the system SHALL replace only the content between the markers and preserve all other content

#### Scenario: CLAUDE.md section appended when markers absent
- **WHEN** `nightshift init --target=claude` runs and `CLAUDE.md` exists without the markers
- **THEN** the system SHALL append a new Nightshift section (with markers) to the end of the file and print a warning informing the user that the section was appended rather than merged

### Requirement: Init removes stale nightshift-dev subagent
The system SHALL detect and clean up the legacy `.claude/agents/nightshift-dev.md` subagent file (from Nightshift 2.x installs) when `nightshift init` runs in a project that previously had 2.x scaffolded.

#### Scenario: Unmodified stale file silently removed
- **WHEN** `nightshift init` runs and `.claude/agents/nightshift-dev.md` exists with content matching a known 2.x template hash (or trivially matching the 2.x bundled template)
- **THEN** the file SHALL be deleted silently and the action SHALL appear in the init summary as `removed: .claude/agents/nightshift-dev.md (legacy)`

#### Scenario: User-modified stale file renamed with backup
- **WHEN** `nightshift init` runs and `.claude/agents/nightshift-dev.md` exists with content that does not match a known 2.x template
- **THEN** the file SHALL be renamed to `.claude/agents/nightshift-dev.md.bak.<ISO-timestamp>`, a warning SHALL be surfaced in the init summary explaining the rename, and the warning SHALL point the user at the migration notes in CHANGELOG.md

