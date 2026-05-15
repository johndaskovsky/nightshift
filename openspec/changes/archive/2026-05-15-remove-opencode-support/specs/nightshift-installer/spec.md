## MODIFIED Requirements

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
- **THEN** `templates/claude/` SHALL contain `agents/nightshift-manager.md`, `agents/nightshift-dev.md`, `skills/nightshift-create/SKILL.md`, `skills/nightshift-add-task/SKILL.md`, `skills/nightshift-update-table/SKILL.md`, `skills/nightshift-start/SKILL.md`, `skills/nightshift-test-task/SKILL.md`, `skills/nightshift-archive/SKILL.md`, plus per-skill `scripts/` subdirectories where applicable, a `CLAUDE.md` template, and a `settings.json` template fragment

#### Scenario: Templates are resolvable at runtime
- **WHEN** the CLI executes `init`
- **THEN** the system SHALL resolve the templates directory relative to the installed package location (not the current working directory)

## REMOVED Requirements

### Requirement: Init command generates command files
**Reason:** Removed when OpenCode support was dropped. The Claude Code surface uses skills (covered by `Init writes Claude skill directories`), not OpenCode slash command files.
**Migration:** Users who relied on `.opencode/command/nightshift-*.md` artifacts should stay on the 1.x release line.

### Requirement: Init target flag
**Reason:** Removed when OpenCode support was dropped. With one runtime there is no target to choose; `nightshift init` always scaffolds Claude Code.
**Migration:** Drop `--target=claude` from invocations (the flag is now an unknown option). `--target=opencode` and `--target=both` are unsupported in 2.x; affected users should stay on 1.x.

### Requirement: Init target auto-detection
**Reason:** Removed when OpenCode support was dropped. Auto-detection existed only to choose between OpenCode and Claude Code; with one runtime it is unnecessary.
**Migration:** None — `nightshift init` unconditionally installs Claude Code.

### Requirement: Init detects Claude install via manager subagent
**Reason:** Merged into `First-run detection`. The OpenCode-vs-Claude marker-file distinction is gone now that `.claude/agents/nightshift-manager.md` is the only first-run marker.
**Migration:** Behavior is unchanged for Claude users; the `.opencode/agents/nightshift-manager.md` marker is no longer consulted.

### Requirement: Init summary output covers all targets
**Reason:** Merged into `Init command summary output`. With one runtime, the "both targets" scenario is no longer meaningful.
**Migration:** Summary output now describes only the Claude target.
