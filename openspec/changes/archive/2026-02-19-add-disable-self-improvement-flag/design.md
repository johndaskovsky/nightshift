## Context

The Nightshift manager and dev agents always run the full self-improvement cycle: dev agents generate step improvement recommendations after every execution, and the manager reviews and applies them before each subsequent item. For shifts with mature, stable task files this is unnecessary overhead — the cycle costs tokens on both sides without producing meaningful changes.

The `manager.md` Shift Configuration section already handles optional flags (`parallel`, `current-batch-size`, `max-batch-size`). Adding `disable-self-improvement` follows the same pattern and stays consistent with the existing configuration model.

## Goals / Non-Goals

**Goals:**
- Add `disable-self-improvement: true` as a valid optional field in `manager.md` Shift Configuration
- When the flag is present and `true`, the manager skips step 5 (Apply Step Improvements) entirely
- When the flag is present and `true`, the dev skips step 4 (Identify Recommendations) and always returns `Recommendations: None`
- Two new integration tests validate this behavior in both serial and parallel modes
- README documents the new field alongside existing parallel configuration fields

**Non-Goals:**
- No partial self-improvement (e.g., "skip recommendations but still apply any that come back") — the flag is all-or-nothing
- No per-task or per-item granularity — the flag applies to the whole shift
- No runtime toggle — the flag is read once at shift start

## Decisions

### Flag location: Shift Configuration section of `manager.md`

All user-facing shift configuration lives in the `## Shift Configuration` section of `manager.md`. This is consistent with `parallel`, `current-batch-size`, and `max-batch-size`. Alternatives like a separate config file or frontmatter were not considered — the existing pattern is clear and sufficient.

### Flag semantics: opt-out (default enabled)

Self-improvement is on by default and the flag opts out. This preserves backward compatibility — all existing shifts behave identically without any changes. The alternative (opt-in) would require all existing shifts to add the flag to preserve current behavior, which is a breaking change.

### Dev behavior when flag is set: skip step 4, always return `Recommendations: None`

The dev should not silently accumulate recommendations and discard them — that wastes tokens. The correct behavior is to not run step 4 at all. Returning a static `Recommendations: None` satisfies the output contract without any processing.

### Manager behavior when flag is set: skip step 5 unconditionally

The manager checks the flag once (when reading `manager.md` at shift start) and skips step 5 for the entire shift. It does not need to inspect the `recommendations` field from dev results when the flag is active.

### Test fixtures: new manager fixtures with the flag set

The two new tests (`nightshift-start-no-self-improvement` and `nightshift-start-parallel-no-self-improvement`) mirror the existing serial and parallel tests exactly, differing only in the manager fixture which includes `disable-self-improvement: true`. The same task file fixture and table fixture are reused. This keeps the test surface minimal while validating that the flag does not break normal execution.

## Risks / Trade-offs

- **Risk**: Dev agent ignores the flag and generates recommendations anyway → **Mitigation**: The instruction to skip step 4 is explicit in the dev prompt; the output contract check (`Recommendations: None`) is simple to validate during testing.
- **Risk**: Flag is set on a shift with genuinely ambiguous steps, leading to degraded quality → **Mitigation**: This is a user choice; the README documentation makes the trade-off clear.
- **Trade-off**: Two additional integration tests increase suite runtime → Accepted; both tests reuse existing fixtures and the task is trivially fast (`echo`).

## Open Questions

None. The scope and approach are fully defined.
