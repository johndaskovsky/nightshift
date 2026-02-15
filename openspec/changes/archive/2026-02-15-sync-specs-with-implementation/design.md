## Context

The Nightshift framework originally used a three-agent system (manager, dev, QA) with a four-state machine (`todo -> qa -> done`, with `failed`). The QA agent was removed in favor of dev self-validation, collapsing the state machine to three states (`todo`, `done`, `failed`). The project also evolved from a config-only framework into a TypeScript CLI installer. However, specs, AGENTS.md, and README.md were not fully updated to reflect these changes.

Four specs contain stale QA references or other drift from the implementation. AGENTS.md and README.md have pervasive inaccuracies. AGENTS.md is particularly important because it is loaded as context for every agent conversation in the repo.

## Goals / Non-Goals

**Goals:**

- Make every spec accurately reflect the current two-agent, three-state implementation
- Make AGENTS.md an accurate reference for agents working in the repo
- Make README.md an accurate guide for users installing and using the framework
- Remove all references to the QA agent, `qa` status value, and `opencode.jsonc` (which no longer exists in this project)

**Non-Goals:**

- Changing any runtime behavior or code -- this is purely a documentation/spec sync
- Adding new specs or capabilities
- Updating specs that are already aligned (nightshift-agents, nightshift-tasks, nightshift-commands, nightshift-shifts, parallel-execution, task-template-variables, test-benchmarks, auto-release)
- Re-adding the commented-out tests to the test runner -- the spec should match the implementation, not the other way around

## Decisions

**Decision 1: Spec updates follow the implementation, not vice versa**

The implementation is the source of truth. Where specs and implementation disagree, the spec changes. Rationale: the QA agent removal and CLI refactoring were deliberate architectural decisions that shipped. The specs lagged behind.

**Decision 2: Remove `opencode.jsonc` global permissions scenarios entirely**

The `qsv-csv-operations` spec has a scenario for global `opencode.jsonc` bash permissions. This file was removed from the project when the CLI installer model was adopted. The global config is now the target project's responsibility, not Nightshift's. Remove rather than reframe, since Nightshift specs should only describe what Nightshift controls.

**Decision 3: Remove the `--force` flag requirement from `update` command spec**

The `update` command always overwrites (hardcoded `force: true`). The spec says both `init` and `update` should support `--force` and `--yes`. Update the spec to reflect that `--force` applies only to `init`, and `--yes` applies to both. This matches the implementation where `update` is inherently destructive (it always overwrites framework files).

**Decision 4: Update init summary spec to require dependency instructions**

The spec says init should mention qsv/flock dependencies. The implementation does not. This is a case where the spec is right and the implementation should catch up -- but since this change is spec-only, we keep the spec requirement. The implementation gap becomes a visible future task.

Alternative considered: Remove the requirement from the spec to match the implementation. Rejected because users genuinely need to know about qsv/flock, and the spec should capture the intended behavior.

**Decision 5: Remove 5 test requirements from test-runner spec**

The test runner implementation has 3 tests (init, nightshift-start, nightshift-start-parallel). The spec defines 8. The 5 missing tests (nightshift-create, nightshift-add-task, nightshift-update-table, nightshift-test-task, nightshift-archive) were removed from the implementation. Remove these from the spec to match.

**Decision 6: AGENTS.md and README.md are non-spec documentation**

These files are not OpenSpec-managed specs. They are updated directly as part of this change's tasks. No delta specs are needed for them -- the task list covers the specific edits required.

## Risks / Trade-offs

- [Installer spec retains dependency instruction requirement that implementation doesn't fulfill] -> This creates a known gap. Mitigated by making it a visible task for a future change.
- [Test-runner spec shrinks from 8 to 3 tests] -> Reduces test coverage expectations. Acceptable because the removed tests depend on OpenCode command execution which requires interactive testing infrastructure that doesn't exist yet.
- [Large number of files touched] -> Increases review surface. Mitigated by the fact that all changes are documentation/spec text with no runtime behavior changes.
