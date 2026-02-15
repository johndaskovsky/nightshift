## Why

The recent orchestration improvements (decentralized status writes, supervisor loop, compaction recovery) introduced correctness guarantees but significantly degraded shift execution performance. The supervisor command now blocks the manager between every batch — waiting for the progress report, running termination checks, then re-invoking the manager — even when no compaction has occurred. Dev and QA agents return verbose result payloads (full step-by-step outcomes, all retry attempt details, captured values, self-validation results, recommendations) that the manager must parse, even though status transitions are already written directly to `table.csv` by the agents themselves. These round-trip overheads compound across hundreds of items, turning what should be a streamlined pipeline into a stop-and-go relay.

## What Changes

- **Supervisor continuation policy**: The supervisor SHALL continue the manager session (via `task_id`) without waiting for explicit progress reports when no compaction is detected. The manager reports progress asynchronously by writing to `manager.md`, and the supervisor only intervenes on compaction or termination — not between every batch.
- **Manager self-continuation**: The manager SHALL continue processing batches autonomously within a single session as long as `todo` items remain, only yielding to the supervisor when it detects compaction or completes all work. The supervisor does not gate each batch.
- **Streamlined dev agent output**: The dev agent's result payload returned to the manager SHALL be reduced to only the fields the manager actually acts on: `overall_status`, `recommendations`, and `error` (if failed). Verbose fields (per-step outcomes, captured values, self-validation details, attempt narratives) are no longer returned to the manager — the dev agent can still use them internally for retries and self-validation, but they do not need to cross the agent boundary.
- **Streamlined QA agent output**: The QA agent's result payload returned to the manager SHALL be reduced to `overall_status` and `summary`. Per-criterion details are no longer returned — the QA agent writes `done` or `failed` directly to `table.csv`, and the manager only needs to know whether to log a failure reason.
- **Supervisor termination check optimization**: The supervisor SHALL read the manager's progress section from `manager.md` instead of running independent `qsv search` commands against `table.csv` for every task column after each manager return.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `nightshift-agents`: The dev and QA agent output contracts are being streamlined — fewer fields returned to the manager. The manager's batch loop no longer yields to the supervisor between batches unless compaction is detected.
- `nightshift-commands`: The `/nightshift-start` supervisor loop is being changed from a per-batch gating model to a continuation model where the manager runs autonomously until compaction or completion.

## Impact

- **Templates affected**: `templates/agents/nightshift-manager.md`, `templates/agents/nightshift-dev.md`, `templates/agents/nightshift-qa.md`, `templates/commands/nightshift-start.md`
- **Specs affected**: `openspec/specs/nightshift-agents/spec.md`, `openspec/specs/nightshift-commands/spec.md`
- **No breaking changes to external interfaces**: Shift directory structure, `manager.md` format, `table.csv` schema, and all six slash commands remain unchanged. The state machine (`todo` -> `qa` -> `done` / `failed`) is unchanged.
- **Behavioral change**: Shifts will execute with fewer supervisor-manager round-trips and smaller inter-agent payloads, reducing total wall-clock time for multi-item shifts.
