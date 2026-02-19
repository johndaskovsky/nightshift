# Changelog

All notable changes to this project will be documented in this file.

## [1.0.1] - 2026-02-19

### Added

- Add .nightshift/.gitignore scaffolding

Closes #4 - Add framework-managed .nightshift/.gitignore generation to init and update. Implements writeGitignoreFile() in src/core/scaffolder.ts (writes a single-line `table.csv.bak\n`, overwriting existing file), exports it from src/index.ts, and invokes it from src/cli/commands/init.ts and src/cli/commands/update.ts (update uses force:true). Tests updated to verify the file exists and contains the pattern, and OpenSpec docs/specs/tasks were added/updated to describe the change and summary output.
- Add npm badges and update package metadata

Add npm version and download badges to README.md. Reorganize package.json to include metadata for npm/GitHub (keywords, homepage, bugs, repository, author, license) and move/add packageManager; remove duplicate fields. This cleans up manifest and prepares the package for publishing and linking to the repository/issues.

### Changed

- Update changelog [skip ci]

### Other

- Consolidate init/update into single init

Remove the redundant `nightshift update` command and fold its behavior into `nightshift init`. `init` no longer accepts `--force`/`--yes` and now detects first-run vs re-run by checking `.opencode/agent/nightshift-manager.md` to adjust banners, spinner text, and footer messaging. Deleted src/cli/commands/update.ts, removed `force` from ScaffoldOptions and scaffolder calls, updated CLI registration, documentation (README.md, AGENTS.md) and specs to reflect the single-command model, and added an OpenSpec archive describing the change.

## [1.0.0] - 2026-02-15

### Added

- Add auto-release spec and archive change

Archive the add-auto-release-generation change set under openspec/changes/archive/2026-02-14 and add a new formal spec at openspec/specs/auto-release/spec.md. The new spec defines requirements and scenarios for git-cliff configuration (imperative-mood commit parsing and grouping, skipping version/merge commits), a GitHub Actions release workflow that triggers on v* tags to generate release notes and create GitHub Releases, and initial CHANGELOG.md generation covering existing tags.
- Add CLI dependency checks for qsv and flock

Introduce a shared dependency checker (src/core/dependencies.ts) that runs `qsv --version` and `flock --version` with a timeout and returns structured availability/version info. Call this utility from `nightshift init` and `nightshift update` (src/cli/commands/init.ts, src/cli/commands/update.ts) to print a `--- Dependencies ---` summary showing ✓ for present tools or a warning with `brew install ...` instructions for missing tools (non-blocking). Remove the redundant pre-flight dependency checks and version lines from the `nightshift-start` template and update related specs and openspec change archives accordingly. Also update benchmarks metadata.

================================================================================
TEST RESULTS
================================================================================
Test                         Result    Accuracy    Duration      Benchmark
--------------------------------------------------------------------------
init                         PASS      11/11       1.4s          SLOW (+16.2%)
nightshift-start             PASS      3/3         2m 41s        FASTER (-4.6%)
nightshift-start-parallel    PASS      3/3         2m 5s         FASTER (-7.0%)
--------------------------------------------------------------------------

### Changed

- Update changelog [skip ci]

### Other

- Improve orchestration

Switch orchestration so dev and QA agents write their own item statuses to table.csv using flock-protected qsv commands; remove the transient in_progress state and simplify the state machine to todo → qa → done|failed. Make qsv and flock required dependencies, add {SHIFT:TABLE} template variable, and update manager responsibilities (progress reporting, applying only successful dev recommendations, writing manager.md and task files). Update docs, agent/command templates, and OpenSpec specs/design/proposal to reflect the new model; remove opencode.jsonc and adjust README/AGENTS.md accordingly.
- Optimize orchestration performance

Enable manager self-continuation and reduce inter-agent payloads to cut per-batch overhead. The manager now processes batches autonomously and only yields to the supervisor on compaction or completion; the supervisor no longer gates each batch or runs redundant per-batch qsv termination checks. Dev/QA agent output contracts are streamlined (dev: overall_status, recommendations, error; QA: overall_status, summary) and dev/QA continue to write statuses directly to table.csv with flock-prefixed qsv edits. Updated templates and specs to reflect the new supervisor/manager model and slimmed agent contracts, added an archived change package documenting the design/proposal/tasks, and adjusted benchmarks.json accordingly.
- Archive spec changes

Move change proposals into the 2026-02-15 archive and introduce exclusive file locking for all qsv operations on shift tables. Require qsv and flock as external dependencies and update all CSV read/write scenarios to use `flock -x <table_path> qsv <subcommand>` (including `qsv edit -i` for in-place updates). Add a new table-file-locking spec, update bash permission requirements to allow `qsv*` and `flock*` for manager/dev/QA/global contexts, and ensure manager/dev agents write status transitions to table.csv via flock-prefixed qsv commands. Also add `{SHIFT:TABLE}` placeholder support, restrict manager step-improvement application to successful dev runs, and enhance dev result reporting and retry behavior.
- Sync specs/docs with two-agent implementation

Update repository docs and OpenSpec files to match the implemented two-agent model (manager + dev) and three-state machine (todo, done, failed). Rewrites AGENTS.md and README.md to remove QA references, update state transitions, project layout (TypeScript CLI: src/, bin/, dist/, templates/, test/), build/test instructions (pnpm), and permissions/delegation rules. Modify OpenSpec specs (nightshift-installer, qsv-csv-operations, table-file-locking, test-runner) to reflect: dev self-validation, exclusive flock-wrapped qsv operations, manager/dev bash permissions only, updated init/update flags (--force applies to init; update supports --yes), pnpm build, and removal of several test requirements. Add an openspec change archive (design, proposal, tasks, per-spec diffs) and remove stale QA/global opencode.jsonc scenarios. Also trim commented tests from test/run-tests.ts to match the reduced test suite.

### Removed

- Remove QA & compaction handling

Remove redundant QA and compaction-recovery overhead from Nightshift orchestration. This change deletes the QA subagent and its template, removes compaction detection and the supervisor's replay loop, eliminates the denormalized ## Progress writes from manager.md, and aligns the state machine to three statuses (todo, done, failed) by removing qa and in_progress. The dev agent now writes done/failed directly; the manager runs once per invocation, derives final counts from table.csv via qsv, and continues autonomous batch processing (with adaptive parallel batching preserved). Updated: templates, specs, installer, scaffolder, commands, tests, and migration tasks (existing shifts with qa-status rows must be migrated via qsv edit).

================================================================================
TEST RESULTS
================================================================================
Test                         Result    Accuracy    Duration      Benchmark
--------------------------------------------------------------------------
init                         PASS      11/11       1.2s          FASTER (-0.1%)
nightshift-start             PASS      3/3         2m 58s        FASTER (-30.3%)
nightshift-start-parallel    PASS      3/3         2m 15s        FASTER (-13.4%)
--------------------------------------------------------------------------
- Remove row column; use positional item indices

Remove the redundant `row` column from the Nightshift data model and switch agents/commands to use qsv's 0-based positional indices. Update documentation and templates (AGENTS.md, README.md, various templates) to refer to "items" instead of "rows", change test-task prompts to display 1-based labels while converting to 0-based indices internally, and stop scaffolding/maintaining `row` numbering when creating or updating tables. Add an OpenSpec archived change set (2026-02-15) and corresponding modified specs to reflect the new behavior for agents, commands, CSV operations, tasks, and tests. This simplifies index handling (removes the qsv_index = row_number - 1 conversion) and keeps backward compatibility for existing tables that still include a `row` column.
- Remove README 'Progress' subsection

Delete the redundant 'Progress' block (Total items/Completed/Failed/Remaining) from the README example. This cleans up an outdated example section and avoids duplicating task status information in the documentation.

## [0.1.4] - 2026-02-15

### Added

- Add auto-release workflow and changelog

Add a GitHub Actions workflow that generates release notes and creates a GitHub Release when a version tag (v*) is pushed. Include a git-cliff configuration (cliff.toml) tuned for the project's imperative-mood commit messages, and add an initial CHANGELOG.md generated from existing history. The workflow uses orhun/git-cliff-action and softprops/action-gh-release, updates the full changelog, and commits it back to the default branch (with [skip ci]). Also add OpenSpec design/proposal/specs/tasks for the auto-release change under openspec/changes/add-auto-release-generation.

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


