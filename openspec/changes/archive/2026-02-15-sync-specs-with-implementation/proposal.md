## Why

The QA agent was removed from the framework (replaced by dev self-validation), but references to QA persist across multiple specs, AGENTS.md, and README.md. Additionally, the project evolved from a config-only framework to a TypeScript CLI with an installer, but several docs still describe the old architecture. These stale references actively mislead agents working in the repo (AGENTS.md is loaded as context for every conversation) and confuse users reading the README.

## What Changes

- Remove all QA agent references from `qsv-csv-operations` spec (QA bash permissions scenario, `qa` status example, `opencode.jsonc` global permissions scenario)
- Remove all QA agent references from `table-file-locking` spec (Purpose section, status write scenario, entire QA permissions requirement block)
- Update `nightshift-installer` spec to match implementation: remove `--force` flag requirement for `update` command, add missing qsv/flock dependency note in init summary, fix `npm run build` to `pnpm run build`
- Update `test-runner` spec to match actual test suite: spec defines 8 tests but only 3 exist (init, nightshift-start, nightshift-start-parallel); remove spec requirements for tests that were removed from the implementation
- Rewrite AGENTS.md to reflect the two-agent architecture, three-state machine, TypeScript CLI, and current project structure
- Rewrite README.md to reflect the two-agent system, remove QA agent description, fix state machine diagram, fix status values, fix examples, and update project layout

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `qsv-csv-operations`: Remove QA agent bash permissions scenario, fix `qa` status example to `done`, remove `opencode.jsonc` global permissions scenario
- `table-file-locking`: Remove all QA agent references from Purpose, scenarios, and the entire QA permissions requirement block; update agent list to "manager, dev"
- `nightshift-installer`: Remove `--force` flag requirement for `update` command, add qsv/flock dependency instructions to init summary requirement, fix build command from `npm` to `pnpm`
- `test-runner`: Remove spec requirements for tests that no longer exist in the implementation (nightshift-create, nightshift-add-task, nightshift-update-table, nightshift-test-task, nightshift-archive)

## Impact

- `openspec/specs/qsv-csv-operations/spec.md` -- spec content changes
- `openspec/specs/table-file-locking/spec.md` -- spec content changes
- `openspec/specs/nightshift-installer/spec.md` -- spec content changes
- `openspec/specs/test-runner/spec.md` -- spec content changes (5 test requirements removed)
- `AGENTS.md` -- full rewrite of Architecture, Repository Structure, Permissions, and several other sections
- `README.md` -- updates to agent descriptions, state machine, status values, examples, QA section, resumability, permissions table, project layout
