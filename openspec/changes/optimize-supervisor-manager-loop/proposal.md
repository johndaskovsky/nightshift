## Why

The manager agent's orchestration loop carries three sources of overhead that add latency without providing reliable value: compaction detection (an unfalsifiable self-check every iteration), QA delegation (a redundant verification step given the dev agent's self-validation and retry logic), and progress writes to `manager.md` (a denormalized cache of data already canonical in `table.csv`). Removing these simplifies the loop from a multi-phase supervisor-manager-dev-qa pipeline to a single-pass supervisor-manager-dev pipeline, reducing per-item token cost and eliminating an entire agent invocation per item.

## What Changes

- **BREAKING**: Remove the QA subagent (`nightshift-qa`) from the orchestration flow entirely. The dev agent writes `done` on success and `failed` on failure directly to `table.csv`, eliminating the intermediate `qa` status value.
- **BREAKING**: Remove the `qa` status value from the item state machine. Valid statuses become `todo`, `done`, and `failed`. The `in_progress` status referenced in specs but never implemented is also removed to align specs with reality.
- **BREAKING**: Remove all compaction detection logic from the manager agent. The manager no longer self-checks for context compaction or reports `Compacted: true|false` to the supervisor.
- **BREAKING**: Remove the supervisor's compaction recovery loop. The supervisor invokes the manager once and reads the completion output. If the manager errors out, the user re-runs `/nightshift-start` and the existing resume logic (section 2) handles recovery from `table.csv` state.
- Remove the `## Progress` section write from the manager's loop (section 6). The manager no longer writes derived counts to `manager.md` after each batch.
- Remove the `## Progress` section from the `manager.md` template in `nightshift-create`.
- Remove the progress recalculation step from `nightshift-update-table`.
- The manager derives completion summary counts directly from `table.csv` via qsv queries at completion time (section 8), rather than reading them back from `manager.md`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `nightshift-agents`: Remove QA agent role, QA delegation, and QA status write requirements. Remove compaction detection and yield behavior from the manager. Remove progress section write from the manager. Change dev status writes from `qa`/`failed` to `done`/`failed`.
- `nightshift-commands`: Remove supervisor compaction recovery loop from start command. Update completion output parsing to reflect no compaction signaling. Remove progress recalculation from update-table command.
- `nightshift-shifts`: Remove `qa` and `in_progress` from valid status values. Simplify state machine to `todo -> done | failed`. Remove `## Progress` as a required section in the manager file format.
- `parallel-execution`: Remove QA phase from batch lifecycle. Remove concurrent QA dispatch. Update adaptive batch sizing triggers to reference dev completion directly instead of "after QA".
- `nightshift-tasks`: Reattribute validation criteria from QA agent to dev agent self-validation. Remove QA-specific scenarios.
- `nightshift-installer`: Update template file listings to remove `nightshift-qa.md`.
- `test-runner`: Update references to removed QA agent and Progress section.

## Impact

- **Agent files**: `nightshift-manager.md` (heavy rewrite of sections 5-8), `nightshift-qa.md` (deleted), `nightshift-dev.md` (status write changes from `qa` to `done`)
- **Command files**: `nightshift-start.md` (supervisor loop simplified), `nightshift-create.md` (template loses Progress section), `nightshift-update-table.md` (progress recalc removed)
- **Config**: `opencode.jsonc` (remove `nightshift-qa` agent entry and permission block)
- **Specs**: 7 spec files modified (see Modified Capabilities above)
- **State machine**: 4 valid statuses reduced to 3 (`todo`, `done`, `failed`). Existing shifts with items in `qa` status would need manual migration to `done` before running under the new system.
- **No external dependencies affected**: qsv operations, task template variables, and auto-release are unchanged.
