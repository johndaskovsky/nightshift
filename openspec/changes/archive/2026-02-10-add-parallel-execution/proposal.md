## Why

Nightshift currently processes items sequentially — one row at a time. For shifts with many items and tasks that involve waiting (e.g., page loads, API calls), this leaves significant throughput on the table. Parallel execution would allow the manager to process multiple rows concurrently, dramatically reducing total shift time.

However, the current learning model blocks parallelism: the dev agent directly edits the task file's Steps section after each item. If multiple dev agents run concurrently on the same task, they would race to write the same file. This change restructures learning so the dev agent reports recommendations back to the manager, and the manager applies step improvements between batches — enabling safe concurrent execution and giving the manager better visibility into how tasks evolve.

## What Changes

- Add an optional `parallel: true` configuration option to `manager.md` that enables concurrent row processing
- When parallel mode is enabled, the manager SHALL process multiple rows in a batch, delegating dev agents concurrently
- The manager SHALL determine batch size adaptively, starting conservatively and adjusting based on success/failure rates
- **BREAKING**: The dev agent SHALL no longer directly edit the Steps section of task files. Instead, it SHALL include step improvement recommendations in its result output.
- The manager SHALL be responsible for reviewing dev recommendations and applying step improvements to task files between batches
- The manager SHALL collect and deduplicate recommendations from multiple concurrent dev agents before applying changes
- Sequential mode (the current default) remains fully supported — the learning model change applies to both modes

## Capabilities

### New Capabilities
- `parallel-execution`: Covers the manager's parallel dispatch, adaptive batch sizing, batch lifecycle, and concurrency-safe state management

### Modified Capabilities
- `nightshift-agents`: Manager gains parallel dispatch and step improvement responsibilities; dev agent no longer edits task files directly, instead reports recommendations; dev output contract adds a recommendations field
- `nightshift-tasks`: Task file mutability rules change — Steps section is no longer directly mutable by the dev agent
- `nightshift-shifts`: Manager file format gains optional `parallel` configuration field

## Impact

- `.opencode/agent/nightshift-manager.md` — major rewrite of delegation logic, new batch dispatch flow, new step improvement responsibility
- `.opencode/agent/nightshift-dev.md` — remove self-improvement writes, add recommendation reporting to output contract
- `.nightshift/<shift>/manager.md` — new optional `parallel: true` field in Shift Configuration section
- `opencode.jsonc` — no changes expected (permissions are already sufficient)
- Backward compatible: shifts without `parallel: true` continue to work sequentially, but the learning model change (centralized step improvement) applies to both modes
