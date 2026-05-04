## ADDED Requirements

### Requirement: Init target flag
The system SHALL accept a `--target` flag (also accessible as `-t`) on `nightshift init` with permitted values `claude`, `opencode`, and `both`. The flag SHALL select which runtime surface(s) receive scaffolded files.

#### Scenario: Explicit Claude target
- **WHEN** a user runs `nightshift init --target=claude`
- **THEN** the system SHALL scaffold only the `.claude/` and `.nightshift/` directories and SHALL NOT create any `.opencode/` files

#### Scenario: Explicit OpenCode target
- **WHEN** a user runs `nightshift init --target=opencode`
- **THEN** the system SHALL scaffold only the `.opencode/` and `.nightshift/` directories and SHALL NOT create any `.claude/` files

#### Scenario: Explicit both target
- **WHEN** a user runs `nightshift init --target=both`
- **THEN** the system SHALL scaffold both `.claude/` and `.opencode/` directory trees alongside `.nightshift/`

#### Scenario: Invalid target value
- **WHEN** a user runs `nightshift init --target=foo`
- **THEN** the system SHALL print an error listing the valid values (`claude`, `opencode`, `both`) and exit with a non-zero status

#### Scenario: Short flag form
- **WHEN** a user runs `nightshift init -t claude`
- **THEN** the system SHALL behave identically to `--target=claude`

### Requirement: Init target auto-detection
The system SHALL auto-detect the install target when `--target` is omitted, by inspecting the project for existing `.claude/` and `.opencode/` directories.

#### Scenario: Auto-detect when only Claude exists
- **WHEN** `nightshift init` runs without `--target` in a project that has `.claude/` but not `.opencode/`
- **THEN** the system SHALL select `claude` as the effective target and print which target was auto-detected

#### Scenario: Auto-detect when only OpenCode exists
- **WHEN** `nightshift init` runs without `--target` in a project that has `.opencode/` but not `.claude/`
- **THEN** the system SHALL select `opencode` as the effective target

#### Scenario: Auto-detect when both exist
- **WHEN** `nightshift init` runs without `--target` in a project that has both `.claude/` and `.opencode/`
- **THEN** the system SHALL select `both` as the effective target

#### Scenario: Auto-detect when neither exists
- **WHEN** `nightshift init` runs without `--target` in a project that has neither `.claude/` nor `.opencode/`
- **THEN** the system SHALL select `both` as the effective target so the user can pick either harness later

### Requirement: Init writes Claude agent files
When the effective target includes Claude, the system SHALL write two Claude Code subagent files from bundled templates: `.claude/agents/nightshift-manager.md` and `.claude/agents/nightshift-dev.md`.

#### Scenario: Claude agent files written
- **WHEN** `nightshift init --target=claude` completes successfully
- **THEN** `.claude/agents/nightshift-manager.md` and `.claude/agents/nightshift-dev.md` SHALL exist with content matching the bundled `templates/claude/agents/` files

#### Scenario: Claude agent files overwritten on re-run
- **WHEN** `nightshift init --target=claude` runs and `.claude/agents/nightshift-manager.md` already exists from a prior installation
- **THEN** the system SHALL overwrite it with the current template version

### Requirement: Init writes Claude skill directories
When the effective target includes Claude, the system SHALL write six skill directories under `.claude/skills/`, each containing a `SKILL.md` and (where applicable) a `scripts/` subdirectory of executables. The six skills correspond to the six Nightshift commands: `nightshift-create`, `nightshift-add-task`, `nightshift-update-table`, `nightshift-start`, `nightshift-test-task`, `nightshift-archive`.

#### Scenario: Skill directories written
- **WHEN** `nightshift init --target=claude` completes successfully
- **THEN** the directories `.claude/skills/nightshift-create/`, `.claude/skills/nightshift-add-task/`, `.claude/skills/nightshift-update-table/`, `.claude/skills/nightshift-start/`, `.claude/skills/nightshift-test-task/`, and `.claude/skills/nightshift-archive/` SHALL each contain a `SKILL.md`

#### Scenario: Skill scripts marked executable
- **WHEN** the system writes a script file under `.claude/skills/<skill-name>/scripts/`
- **THEN** the file SHALL be set to mode `0755` (executable)

#### Scenario: Skill files overwritten on re-run
- **WHEN** `nightshift init --target=claude` runs and `.claude/skills/nightshift-start/SKILL.md` already exists from a prior installation
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

### Requirement: Init detects Claude install via manager subagent
When determining whether the current run is a first-run or re-run for the Claude target, the system SHALL check for the existence of `.claude/agents/nightshift-manager.md` (parallel to the existing `.opencode/agent/nightshift-manager.md` check for the OpenCode target).

#### Scenario: Fresh Claude install detected as first run
- **WHEN** `nightshift init --target=claude` runs and `.claude/agents/nightshift-manager.md` does not exist
- **THEN** the system SHALL use first-run messaging for the Claude portion of the install

#### Scenario: Existing Claude install detected as re-run
- **WHEN** `nightshift init --target=claude` runs and `.claude/agents/nightshift-manager.md` already exists
- **THEN** the system SHALL use re-run messaging for the Claude portion of the install

### Requirement: Init summary output covers all targets
The system SHALL extend the post-init summary output to list created/updated files for every effective target. The Dependencies section (qsv/flock) and Next Steps section SHALL be tailored to the effective target(s).

#### Scenario: Both-target summary lists both trees
- **WHEN** `nightshift init --target=both` completes successfully
- **THEN** the summary output SHALL list files written under `.opencode/` and `.claude/`, and the Next Steps section SHALL mention both OpenCode and Claude Code as valid harnesses

#### Scenario: Claude-only summary suggests Claude Code
- **WHEN** `nightshift init --target=claude` completes successfully on a fresh install
- **THEN** the Next Steps section SHALL instruct the user to open Claude Code and run `/nightshift-create`, and SHALL NOT mention OpenCode

#### Scenario: Claude install requests session restart on first run
- **WHEN** `nightshift init --target=claude` completes a first-run install
- **THEN** the Next Steps section SHALL note that an already-running Claude Code session must be restarted for newly-created skill directories to be discovered

## MODIFIED Requirements

### Requirement: Init command scaffolds directories
The system SHALL provide a `nightshift init` command that creates the required directory structure for Nightshift in the current project. The set of directories created SHALL depend on the effective target (`opencode`, `claude`, or `both`).

#### Scenario: Init in a fresh project with default target
- **WHEN** a user runs `nightshift init` in a directory that has no `.nightshift/`, `.opencode/`, or `.claude/` directories
- **THEN** the system SHALL select `both` as the effective target and SHALL create `.nightshift/archive/`, `.opencode/agent/`, `.opencode/command/`, `.claude/agents/`, and `.claude/skills/` directories

#### Scenario: Init in a fresh project with OpenCode target
- **WHEN** a user runs `nightshift init --target=opencode` in a directory that has no `.nightshift/` or `.opencode/` directories
- **THEN** the system SHALL create `.nightshift/archive/`, `.opencode/agent/`, and `.opencode/command/` directories and SHALL NOT create `.claude/`

#### Scenario: Init in a fresh project with Claude target
- **WHEN** a user runs `nightshift init --target=claude` in a directory that has no `.nightshift/` or `.claude/` directories
- **THEN** the system SHALL create `.nightshift/archive/`, `.claude/agents/`, and `.claude/skills/` directories and SHALL NOT create `.opencode/`

#### Scenario: Init preserves existing directories
- **WHEN** a user runs `nightshift init` in a directory that already has user-defined files in `.opencode/agent/` or `.claude/agents/`
- **THEN** the system SHALL NOT delete or modify existing non-Nightshift files in those directories

### Requirement: Init command summary output
The system SHALL display a summary of all actions performed after `nightshift init` completes. The summary SHALL include a list of files written for the effective target(s), a dependencies section that actively verifies whether `qsv` and `flock` are installed (with install instructions for any that are missing), and a next-steps section tailored to the effective target.

#### Scenario: First-run init displays summary with next steps
- **WHEN** `nightshift init` completes without errors in a directory that has not been previously initialized
- **THEN** the system SHALL print a banner "Initializing Nightshift...", a list of created files for each effective target, a `--- Dependencies ---` section showing the availability of `qsv` and `flock` (with install instructions for any that are missing), and a `--- Next Steps ---` section tailored to the effective target

#### Scenario: Re-run init displays update summary
- **WHEN** `nightshift init` completes without errors in a directory that has been previously initialized
- **THEN** the system SHALL print a banner "Updating Nightshift files...", a list of updated files for each effective target, the `--- Dependencies ---` section, and an "Update complete." message

#### Scenario: Init with errors displays partial summary
- **WHEN** `nightshift init` encounters a non-fatal error (e.g., file write fails due to permissions)
- **THEN** the system SHALL complete all other steps, print the summary with a warning about the failed step, and exit with a non-zero exit code

### Requirement: First-run detection
The system SHALL detect whether Nightshift has been previously initialized in the target directory by checking for the existence of marker files appropriate to the effective target: `.opencode/agent/nightshift-manager.md` for OpenCode and `.claude/agents/nightshift-manager.md` for Claude. This detection SHALL be used solely for adjusting CLI output messaging and SHALL NOT affect the scaffolding behavior (files are always overwritten).

#### Scenario: Fresh OpenCode directory detected as first run
- **WHEN** `nightshift init` runs targeting OpenCode and `.opencode/agent/nightshift-manager.md` does not exist
- **THEN** the system SHALL use first-run messaging for the OpenCode portion of the install

#### Scenario: Previously initialized OpenCode directory detected as re-run
- **WHEN** `nightshift init` runs targeting OpenCode and `.opencode/agent/nightshift-manager.md` already exists
- **THEN** the system SHALL use re-run messaging for the OpenCode portion of the install

#### Scenario: Fresh Claude directory detected as first run
- **WHEN** `nightshift init` runs targeting Claude and `.claude/agents/nightshift-manager.md` does not exist
- **THEN** the system SHALL use first-run messaging for the Claude portion of the install

#### Scenario: Previously initialized Claude directory detected as re-run
- **WHEN** `nightshift init` runs targeting Claude and `.claude/agents/nightshift-manager.md` already exists
- **THEN** the system SHALL use re-run messaging for the Claude portion of the install

### Requirement: Non-interactive mode
The system SHALL accept the `--target` (or `-t`) flag, the standard `--help` flag, and the `--version` flag. The `init` command SHALL operate non-interactively with no confirmation prompts.

#### Scenario: Init runs without prompts
- **WHEN** a user runs `nightshift init` (with or without `--target`)
- **THEN** the system SHALL proceed with all operations without prompting for user input

### Requirement: Template bundling
The system SHALL bundle all Nightshift agent, command, and skill templates inside the npm package under a `templates/` directory, organized by runtime target.

#### Scenario: Templates directory structure
- **WHEN** the npm package is inspected
- **THEN** `templates/opencode/` SHALL contain `agents/nightshift-manager.md`, `agents/nightshift-dev.md`, `commands/nightshift-create.md`, `commands/nightshift-start.md`, `commands/nightshift-archive.md`, `commands/nightshift-add-task.md`, `commands/nightshift-test-task.md`, and `commands/nightshift-update-table.md`; AND `templates/claude/` SHALL contain `agents/nightshift-manager.md`, `agents/nightshift-dev.md`, `skills/nightshift-create/SKILL.md`, `skills/nightshift-add-task/SKILL.md`, `skills/nightshift-update-table/SKILL.md`, `skills/nightshift-start/SKILL.md`, `skills/nightshift-test-task/SKILL.md`, `skills/nightshift-archive/SKILL.md`, plus per-skill `scripts/` subdirectories where applicable, a `CLAUDE.md` template, and a `settings.json` template fragment

#### Scenario: Templates are resolvable at runtime
- **WHEN** the CLI executes `init`
- **THEN** the system SHALL resolve the templates directory relative to the installed package location (not the current working directory) and select the appropriate `opencode/` or `claude/` subdirectory based on the effective target

### Requirement: npm package structure
The system SHALL be distributed as an npm package with the correct structure for global CLI installation, and the same package SHALL include a Claude Code Plugin manifest so the package can also be installed via Claude Code's plugin discovery.

#### Scenario: Package includes required CLI files
- **WHEN** the package is published to npm
- **THEN** the published package SHALL include `bin/nightshift.js`, `dist/` (compiled JavaScript), and `templates/` (bundled Markdown files for both runtimes)

#### Scenario: Package includes plugin manifest and bundled artifacts
- **WHEN** the package is published to npm
- **THEN** the published package SHALL include `.claude-plugin/plugin.json`, an `agents/` directory containing the Claude subagent files, and a `skills/` directory containing the Claude skill directories, all materialized from `templates/claude/`

#### Scenario: Package excludes development files
- **WHEN** the package is published to npm
- **THEN** the published package SHALL NOT include `src/` (TypeScript source), `node_modules/`, or test files

#### Scenario: Bin entry is executable
- **WHEN** the package is installed globally
- **THEN** `bin/nightshift.js` SHALL have a `#!/usr/bin/env node` shebang and be marked executable
