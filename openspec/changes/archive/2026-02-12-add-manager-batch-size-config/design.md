## Context

The Nightshift manager agent supports a `parallel: true` configuration in `manager.md` that enables adaptive batch sizing for concurrent row processing. The current implementation hardcodes the initial batch size to 2 and applies unbounded adaptive scaling (double on success, halve on failure). There is no mechanism for users to control the starting batch size or cap the maximum.

The adaptive batch sizing algorithm and its state are entirely in-memory during a shift run. If a shift is interrupted and resumed, the batch size resets to the hardcoded initial value of 2, regardless of how large it had grown.

Relevant files:
- `templates/agents/nightshift-manager.md` — manager agent definition with parallel mode logic
- `templates/commands/nightshift-create.md` — shift scaffolding template
- `openspec/specs/parallel-execution/spec.md` — adaptive batch sizing requirements
- `openspec/specs/nightshift-shifts/spec.md` — manager file format requirements

## Goals / Non-Goals

**Goals:**
- Allow users to set an initial/current batch size via `current-batch-size` in the Shift Configuration section of `manager.md`
- Allow users to cap the maximum batch size via `max-batch-size` in the Shift Configuration section
- Have the manager persist the current batch size back to `manager.md` after each batch completes, enabling accurate resume
- Maintain backward compatibility — both fields are optional and the existing behavior (start at 2, no cap) is preserved when omitted

**Non-Goals:**
- Per-task batch size configuration (batch size applies to the shift, not individual tasks)
- Minimum batch size configuration (the floor of 1 remains hardcoded as a safety invariant)
- Automatic tuning heuristics beyond the existing double/halve algorithm
- Changing the sequential mode behavior in any way

## Decisions

### Decision 1: Two separate fields instead of a single `batch-size` field

Use `current-batch-size` and `max-batch-size` as two distinct fields rather than a single `batch-size` field.

**Rationale:** A single field is ambiguous — does it mean "always use this size" (fixed) or "start at this size" (adaptive)? Two fields cleanly separate the concerns: `current-batch-size` is the live/initial value that the manager updates during execution, and `max-batch-size` is a static ceiling that the user sets and the manager respects.

**Alternative considered:** A single `batch-size` field interpreted as the initial value, with a separate `fixed-batch-size: true` flag. Rejected because it adds a boolean flag for a niche case and doesn't address the resume problem (no persisted state).

### Decision 2: Manager writes `current-batch-size` back to `manager.md`

After each batch completes and the manager adjusts the batch size, it writes the new value to the `current-batch-size` field in `manager.md`.

**Rationale:** This solves the resume problem — if a shift is interrupted, it resumes with the last known batch size rather than resetting to the default. It also gives users visibility into the current batch state mid-shift.

**Alternative considered:** Store batch size in a separate state file. Rejected because `manager.md` already serves as the shift manifest and the Progress section is already updated during execution. Adding another stateful file increases complexity.

### Decision 3: Both fields are ignored when `parallel` is not `true`

The `current-batch-size` and `max-batch-size` fields have no effect when `parallel` is omitted or `false`. Sequential mode always uses a fixed batch size of 1.

**Rationale:** Batch sizing is meaningless in sequential mode. Ignoring these fields rather than erroring keeps configuration simple and allows users to toggle `parallel` without removing batch size fields.

### Decision 4: Default behavior when fields are omitted

- If `current-batch-size` is omitted: default to 2 (preserving existing behavior)
- If `max-batch-size` is omitted: no cap (preserving existing behavior)

**Rationale:** Full backward compatibility. Existing shifts with just `parallel: true` continue to work identically.

### Decision 5: Field naming uses kebab-case with existing conventions

Use `current-batch-size` and `max-batch-size` as kebab-case list items in the Shift Configuration section, matching the existing `name`, `created`, and `parallel` field style.

**Rationale:** Consistency with existing field naming in `manager.md`.

## Risks / Trade-offs

- **[Risk] Manager writes to `manager.md` more frequently** — Currently the manager updates only the Progress section. Now it also updates `current-batch-size` after each batch. → Mitigation: The write is a single field update in an already-written section, minimal overhead.
- **[Risk] User edits `current-batch-size` mid-shift** — A user could manually change the value between runs, which is actually a feature (manual override). No mitigation needed; this is intentional.
- **[Risk] `max-batch-size` set to 1 effectively disables adaptive growth** — The batch size can never grow beyond 1, making parallel mode behave like sequential mode. → Mitigation: This is valid user intent. Document that `max-batch-size: 1` constrains parallelism to a single item.
- **[Trade-off] No validation of field values** — The manager reads the values and uses them; there is no schema validation step. Invalid values (e.g., `max-batch-size: -1`) would produce undefined behavior. → Mitigation: Spec the valid range (positive integers) and have the manager treat invalid values as omitted.
