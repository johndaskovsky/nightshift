## Why

The manager's parallel mode uses fully adaptive batch sizing (starting at 2, doubling on success, halving on failure) with no user control. For shifts with known characteristics — such as a reliable task on a large dataset, or a fragile task that should be constrained — users cannot set an initial batch size or cap the maximum. This forces unnecessary ramp-up time on predictable workloads and provides no safety net against runaway batch sizes on unpredictable ones.

## What Changes

- Add optional `current-batch-size` field to the Shift Configuration section of `manager.md`, used only when `parallel: true`. This sets the starting batch size instead of the hardcoded default of 2.
- Add optional `max-batch-size` field to the Shift Configuration section of `manager.md`, used only when `parallel: true`. This caps how large the adaptive batch size can grow.
- The manager agent reads these fields on startup and uses them to constrain the adaptive batch sizing algorithm.
- When the manager adjusts the batch size during execution (after each batch completes), it writes the new value back to `current-batch-size` in `manager.md`, providing visibility into the current state and enabling resume with the correct batch size.
- The adaptive doubling logic is capped by `max-batch-size` — the batch size SHALL NOT exceed this value.
- Both fields are ignored when `parallel` is not `true`.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities
- `parallel-execution`: Adaptive batch sizing gains configurable initial size (`current-batch-size`) and upper bound (`max-batch-size`), and the manager persists batch size changes back to `manager.md`.
- `nightshift-shifts`: The manager file format gains two new optional fields (`current-batch-size`, `max-batch-size`) in the Shift Configuration section.

## Impact

- `templates/agents/nightshift-manager.md` — update parallel mode sections to read/write batch size config, cap adaptive sizing at `max-batch-size`
- `templates/commands/nightshift-create.md` — add commented-out `current-batch-size` and `max-batch-size` examples in the manager.md template
- `openspec/specs/parallel-execution/spec.md` — update adaptive batch sizing requirements
- `openspec/specs/nightshift-shifts/spec.md` — update manager file format requirements
