# Changelog

All notable changes to this project will be documented in this file.

## [3.1.0] - 2026-05-15

### Added

- **Three new task `## Configuration` fields** for per-task control of how the dev subprocess is invoked:
  - `model: <name>` — pass a specific model (`haiku`, `sonnet`, `opus`, full IDs) as `--model` to `claude -p`. Enables cost optimization for shifts with hundreds of items.
  - `working_dir: <path-or-placeholder>` — the directory each dev subprocess `cd`s into before running. Supports placeholders (`{column}`, `{ENV:VAR}`, `{SHIFT:*}`) for per-item resolution. The primary multi-repo enabler.
  - `worktree: true` — when set (with `working_dir`), each dev runs inside a fresh git worktree on a unique branch (`worktree-ns-<shift>-<item>-<task>-<timestamp>`). Backed by Claude Code's native `--worktree` flag.
- **`NIGHTSHIFT_WORKSPACE_ROOT` environment variable** — exported by `dispatch-batch.sh` so the do-task skill can locate `.nightshift/<shift>/...` artifacts even when its cwd is a different repo or worktree. The do-task skill body now reads this env var first; falls back to `pwd` if unset.
- **Workspace-trust pre-flight check** — before dispatching any batch where items use `worktree: true`, the manager probes each unique `working_dir` for Claude Code workspace trust state. If any directory isn't trusted, the shift aborts with a clear `for d in ...; do (cd "$d" && claude); done` remediation message.
- **Per-item worktree cleanup policy** — `dispatch-batch.sh` attempts `git worktree remove` (without `--force`) on each worktree after the subprocess exits. Clean exits + clean tree → removed. Uncommitted state or failed subprocess → preserved, with the path surfaced in the result entry and listed in the manager's final shift summary.
- **README "Multi-repo shifts" section** with a concrete cross-repo example, the workspace-trust setup recipe, `.worktreeinclude` pointer, and cleanup commands.

### Changed

- Manager prose adds Configuration parsing, placeholder resolution for `working_dir`, the trust pre-flight step, extended manifest schema, and a "Preserved worktrees" subsection in the completion summary.
- `dispatch-batch.sh` manifest schema gains `working_dir`, `worktree`, `worktree_name`, and `model` per item. Result schema gains `worktree_preserved` per item.
- `/nightshift-add-task` skill now prompts for the three new optional Configuration fields when guiding the user through task creation.

## [3.0.0] - 2026-05-15

### BREAKING

- **Dev moves from subagent to top-level `claude -p` subprocess.** The `nightshift-dev` Claude Code subagent is removed. Dev work now runs as a fresh `claude -p` subprocess of a new `/nightshift-do-task` skill, spawned by the manager via the bundled `dispatch-batch.sh` helper. The dev subprocess inherits every MCP the user has configured at the user level (Slack, Drive, Playwright, internal MCPs, etc.) — no per-task or per-shift MCP setup required.
- **Manager `tools` allowlist swap.** The manager subagent no longer carries `Agent(nightshift-dev)` in its `tools` list. Instead it gains `Bash(claude *)` (added to `.claude/settings.json`'s `permissions.allow`) so it can spawn dev subprocesses. The manager cannot delegate to any subagent.
- **`nightshift init` removes legacy `nightshift-dev.md` on upgrade.** Unmodified 2.x files are deleted silently; user-customized files are renamed to `<file>.bak.<timestamp>` with a warning.
- **Permission posture.** Dev subprocesses run with `--permission-mode auto` when available; the manager probes once per shift and falls back to `--permission-mode bypassPermissions` when auto mode's eligibility constraints aren't met. Auto mode requires Claude Code v2.1.83+, a Max/Team/Enterprise/API plan, an eligible Sonnet/Opus model, and the Anthropic API provider.

### Added

- `/nightshift-do-task <shift> <task> <item-id> [--read-only]` — new Claude Code skill executed by every dev subprocess. Resolves the shift artifacts, performs template substitution, executes steps, self-validates, retries up to 3 attempts, and emits a structured JSON `result` event.
- `dispatch-batch.sh` — bundled helper (installed at `.claude/skills/nightshift-start/scripts/dispatch-batch.sh`) that takes a JSON manifest of items, spawns N concurrent `claude -p` subprocesses, parses each result event, and emits a consolidated JSON document for the manager. Used for both serial (1-item) and parallel (N-item) dispatch.
- Per-item stream-json logs at `.nightshift/<shift>/logs/<item-id>-<task>-<timestamp>.jsonl`. Users can `tail -f` any log mid-shift for real-time observability. Logs are gitignored by default.
- Test runner escape hatch via `NIGHTSHIFT_TEST_NO_AUTO_MODE` env var — when set, the auto-mode probe is bypassed and dev subprocesses use `bypassPermissions` directly. Useful for CI/test environments where auto mode is unavailable.

### Changed

- `test/benchmarks.json` baselines reset. The architectural shift makes prior numbers incomparable.
- `.nightshift/.gitignore` now includes `**/logs/` and `.batch-manifest.json`.
- README, AGENTS, and the template `CLAUDE.md` rewritten to describe the new architecture, MCP inheritance, permission mode, and observability story.
- Plugin manifest version syncs to 3.0.0 automatically via `build.js`.

### Removed

- `templates/claude/agents/nightshift-dev.md` deleted. The role's behavior now lives in the `/nightshift-do-task` skill body.

## [2.0.0] - 2026-05-15

### BREAKING

- **Dropped OpenCode runtime support.** Nightshift now installs exclusively for Claude Code. The `--target` flag has been removed from `nightshift init` (it accepted no positional alternative — the command always scaffolds Claude Code now), the `--runtime` flag and `NIGHTSHIFT_TEST_RUNTIMES` env var have been removed from the integration test runner, and the `templates/opencode/` template tree has been deleted from the published package. Public CLI exports drop `Target`, `targetIncludes`, `resolveTarget`, and `writeOpenCodeCommandFiles`. Users who depend on the OpenCode runtime should stay on the 1.1.x line.

### Changed

- `test/benchmarks.json` no longer carries per-runtime suffixes — keys like `nightshift-start.claude` are now `nightshift-start`. OpenCode-suffixed entries are deleted.
- `package.json` drops the `test:integration:opencode`, `test:integration:both`, and `test:integration:claude` scripts in favor of the single `test:integration` script.
- `README.md` and `AGENTS.md` rewritten to describe a single-runtime product. The Playwright-for-OpenCode section is removed.

## [Unreleased]

### Added

- **Claude Code support** alongside OpenCode. `nightshift init` now accepts `--target=<claude|opencode|both>` (auto-detected when omitted) and scaffolds the appropriate runtime files. Claude Code installs include:
  - Subagents at `.claude/agents/nightshift-{manager,dev}.md` with native subagent frontmatter (`tools: Agent(nightshift-dev), …`, `mcpServers` example for Playwright).
  - Six skills at `.claude/skills/nightshift-{create,add-task,update-table,start,test-task,archive}/SKILL.md`, each `disable-model-invocation: true` with `allowed-tools: Bash(qsv *) Bash(flock *)`.
  - `/nightshift-start` uses `context: fork` + `agent: nightshift-manager` for declarative delegation; pre-flight summary is inlined via dynamic shell injection.
  - Bundled scripts under `scripts/` referenced via `${CLAUDE_SKILL_DIR}` for portable resolution.
  - Marker-merged `CLAUDE.md` (`<!-- nightshift:start -->` / `<!-- nightshift:end -->`) and idempotent `.claude/settings.json` merge.
- **Claude Code Plugin** distribution: the npm package now publishes a `.claude-plugin/plugin.json` manifest plus root-level `agents/` and `skills/` directories materialized from `templates/claude/` at build time.
- New `tsx test/init-tests.ts` suite (14 tests) covering target selection, auto-detection, settings.json merge, CLAUDE.md merge, prose parity, and benchmark tracking. `pnpm test` runs init tests first, then the integration suite.
- Integration runner (`test/run-tests.ts`) now drives shifts under both OpenCode and Claude Code from the same fixtures. Selection is via `--runtime=<opencode|claude|both>` or `NIGHTSHIFT_TEST_RUNTIMES=...`; auto-detects when no flag is given. Each per-runtime test gets a separate benchmark entry (e.g. `nightshift-start.opencode` vs `nightshift-start.claude`). Added `pnpm test:integration:opencode`, `pnpm test:integration:claude`, and `pnpm test:integration:both` scripts.

### Changed

- Templates reorganized: `templates/agents/` → `templates/opencode/agents/`, `templates/commands/` → `templates/opencode/commands/`. New `templates/claude/` tree alongside.
- `package.json` adds `claude-code` keyword and includes `.claude-plugin/`, `agents/`, and `skills/` in published files.

## [1.0.2] - 2026-02-19

### Added

- Add disable-self-improvement flag docs & tests

Closes #3 - Introduce an optional disable-self-improvement flag to disable the manager/dev self-improvement cycle. Updates README with a Self-Improvement section and usage example; add an OpenSpec for the flag. Update agent specs (nightshift-agents, nightshift-shifts) to define flag behavior (manager skips Apply Step Improvements, dev returns Recommendations: None and skips Identify Recommendations) and ensure the flag is passed to dev. Update agent templates (nightshift-manager, nightshift-dev) to document handling of the flag. Add integration tests and benchmark entries for no-self-improvement and parallel-no-self-improvement scenarios.

```
================================================================================
TEST RESULTS
================================================================================
Test                                             Result    Accuracy    Duration      Benchmark
----------------------------------------------------------------------------------------------
init                                             PASS      13/13       1.4s          SLOW (+14.4%)
nightshift-start                                 PASS      3/3         2m 45s        OK
nightshift-start-parallel                        PASS      3/3         1m 48s        FASTER (-14.0%)
nightshift-start-no-self-improvement             PASS      3/3         2m 14s        NEW
nightshift-start-parallel-no-self-improvement    PASS      3/3         1m 34s        NEW
----------------------------------------------------------------------------------------------
```

Significant speed gains possible when disabling self improvement. Now using Claude Sonnet 4.6 as default model when testing.

### Changed

- Update changelog [skip ci]

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


