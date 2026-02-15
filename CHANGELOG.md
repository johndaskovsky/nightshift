# Changelog

All notable changes to this project will be documented in this file.

## [0.1.3] - 2026-02-12

### Added

- Integrate qsv for CSV operations

Add qsv as an optional but recommended CSV CLI and update Nightshift to use qsv subcommands for all table.csv operations. This change adds README install instructions, updates global and manager bash allowlists (opencode.jsonc and manager template), implements a pre-flight qsv check for /nightshift-start, and replaces Read/Write patterns in command and agent templates with qsv commands (edit, slice, select, search, enum, cat, headers, table, count). New spec and change docs were added under openspec/changes (design, proposal, specs, tasks) and a new qsv-csv-operations spec was added; existing openspec specs for agents, commands, and shifts were updated to reflect the qsv-based behavior. Backward compatibility: qsv is advisory (warn if missing) and the manager remains the sole writer of table.csv using qsv edit -i (which creates a .bak backup).
- Add testing framework and test runner

Introduce an end-to-end test framework for Nightshift: add a TypeScript test runner (test/run-tests.ts) and test workspace with benchmarks (test/benchmarks.json) and .gitignore. Add a pnpm "test" script to package.json to run the suite via tsx. Include OpenSpec change docs (design, proposal, specs, tasks) describing test requirements, benchmark handling, accuracy tracking, and sequential command tests that invoke commands via `opencode run --command --format json`. Also update opencode.jsonc to allow opencode* and add supporting test fixtures and logging (test-log.jsonl).
- Add manager batch-size config; snake_case tasks

Introduce configurable adaptive batch sizing and migrate task/column naming to snake_case. Adds optional current-batch-size and max-batch-size fields (read/write) for parallel mode and specifies default/validation/behavior in new openspec change files and updated specs. Update manager and create templates to read/cap/persist batch size, change qsv commands and examples to use snake_case task names, and make QA run concurrently in parallel mode. Tests and fixtures updated (including a new nightshift-start-parallel test), and benchmark metadata adjusted.

## [0.1.2] - 2026-02-10

### Added

- Add License section with MIT license
- Support shift .env and placeholder types

Ignore per-shift .env files and document .env usage and new placeholder types. Updates .gitignore to exclude .nightshift/**/.env. Extend nightshift-dev and nightshift-manager docs to: parse .env into environment variables, include shift metadata (FOLDER/NAME), describe three placeholder types ({column}, {ENV:VAR}, {SHIFT:KEY}), add error-handling rules for unresolved placeholders, and ensure manager reads and supplies .env/metadata in the delegation prompt. Update nightshift-create docs to mention creating .nightshift/<name>/.env and list available template variables.
- Add .env support and shift placeholders to templates

Add support for per-shift environment variables and shift metadata across Nightshift templates. The manager now reads an optional .env from the shift directory and passes environment key-value pairs plus shift metadata (FOLDER, NAME) to the nightshift-dev agent. The developer template documents three placeholder types ({column_name}, {ENV:VAR_NAME}, {SHIFT:FOLDER|NAME}), resolves all placeholders in a single pass, and requires immediate errors for unresolved placeholders or invalid SHIFT keys. Documentation for creating a .env and the available template variables was also added to the nightshift-create command template.
- Add recommendations flow and parallel batching

Update Nightshift agent templates to change how dev agents propose step changes and to add parallel batch processing for managers. Dev agents now report "Recommendations" and must not modify task files (refine approach in-memory for retries); their output field `steps_refined` was replaced with `recommendations`. Manager now becomes the sole writer of task files and applies validated recommendations, supports a parallel mode (configurable via `parallel: true`) with adaptive batch sizing and N parallel dev Task tool calls per batch; QA remains sequential. Minor docs: clarify immutability rules, retry behavior, structured output format, and add a commented `parallel` option to the nightshift-create command template.
- Add specs

Add archived OpenSpec change sets (designs, proposals, tasks, and specs) for Nightshift core, dev self-improvement, installer, parallel execution, task-template-variables, and agent-config updates. Add new top-level openspec specs and config.yaml to document nightshift agents, commands, shifts, tasks, parallel execution, and task-template-variables. Also include task checklists and templates for implementing manager/dev/qa subagents and slash commands. Tweak .gitignore by removing the /openspec ignore entry.

### Changed

- Switch project to pnpm and update docs

Replace Bun with pnpm for dependency management and update related documentation and metadata. AGENTS.md: change package manager to pnpm, update install command, clarify opencode.jsonc formatting and note Nightshift does not manage project opencode.jsonc. README.md: adjust init/update descriptions and directory listing to reflect that opencode.jsonc is not merged/overwritten by Nightshift. package.json: change prepublishOnly to use pnpm and add packageManager field. pnpm-lock.yaml: remove jsonc-parser entries (pruned from lockfile).

### Removed

- Remove runtime agent docs and commands

Delete Nightshift-related agent and command docs and remove their agent configurations. Removed files include .nightshift/archive/.gitkeep, .opencode/agent/nightshift-*.md, and all .opencode/command/nightshift-*.md files. Also trimmed the agent configuration block from opencode.jsonc that defined nightshift-manager, nightshift-dev, and nightshift-qa.
- Remove opencode config merger and template

Delete the opencode.jsonc merge implementation and related assets: remove src/core/config-merger.ts, templates/opencode.jsonc, and the config-merger test. Remove imports and merge steps from init and update commands and stop exporting mergeOpencodeConfig from the public API. Also remove the jsonc-parser dependency from package.json. This simplifies the scaffold flow by dropping automatic opencode.jsonc creation/merging and associated tests.

## [0.1.1] - 2026-02-09

### Added

- Add Nightshift agent framework and commands

Introduce the Nightshift batch-processing framework: agent specs, command docs, config, and docs. Adds OpenCode agent definitions for nightshift-manager, nightshift-dev, and nightshift-qa; six slash-command specs (create, add-task, update-table, start, test-task, archive); opencode.jsonc with tool/permission settings; README and AGENTS.md describing architecture, workflows, and conventions; .gitignore rules and an archive .gitkeep. This scaffolds the repository for running shift orchestration, task execution (with self-improvement/retries), and QA verification.
- Add Nightshift CLI, templates, and build files

Initial add of the Nightshift CLI and project scaffold. Adds bin/nightshift.js, build script, package.json, tsconfig, pnpm-lock, templates for agents/commands and opencode.jsonc, and a test for the config merger. Implements CLI entry (src/cli), init and update commands, and core tooling (config-merger, dependency-installer, scaffolder, templates, index). Also updates .gitignore and inserts generated markers into template .opencode files. The config-merger implements merging Nightshift agent entries into an existing opencode.jsonc while preserving comments.

### Changed

- Update README with ASCII art and project details

Added ASCII art and enhanced project description.

### Fixed

- Correct npm package scope in README

Update the global install command to use the correct package scope @johndaskovsky instead of the incorrect @jdaskovsky in the README. This ensures users run the right npm install command when setting up Nightshift.

### Other

- README: remove Bun, clarify table usage, trim dirs

Remove Bun from the prerequisites and delete the `bun install` snippet which was no longer needed. Clarify the scaffolding section to instruct users to add data and required metadata to the generated `table.csv`. Also remove references to `skills/` and `openspec/` from the example directory tree to reflect the current project layout and clean up outdated docs.


