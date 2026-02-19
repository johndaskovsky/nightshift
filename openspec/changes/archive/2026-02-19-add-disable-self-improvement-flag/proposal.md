## Why

Some shifts produce highly stable, well-tested task files where the self-improvement cycle adds overhead without benefit — managers spend tokens reviewing recommendations that will always be `"None"`, and devs spend effort generating them. A `disable-self-improvement: true` flag in `manager.md` lets operators opt out of the cycle entirely for shifts where step quality is already known to be high.

## What Changes

- Add an optional `disable-self-improvement: true` configuration field to the `## Shift Configuration` section of `manager.md`
- When the flag is `true`, the manager skips the "Apply Step Improvements" step (step 5) after each dev result
- When the flag is `true`, the dev skips the "Identify Recommendations" step (step 4) and always returns `Recommendations: None`
- Add two new integration tests mirroring the existing serial and parallel tests but with `disable-self-improvement: true` set in the manager fixture
- Update README to document the new configuration field alongside the existing parallel execution fields

## Capabilities

### New Capabilities

- `disable-self-improvement`: Optional boolean flag in `manager.md` shift configuration that disables the step improvement cycle for both manager and dev agents

### Modified Capabilities

- `nightshift-agents`: Manager and dev agent behavioral rules change — both conditionally skip self-improvement steps based on the new flag
- `nightshift-shifts`: Shift configuration schema gains a new optional field
- `test-runner`: Two new tests added covering serial and parallel execution with `disable-self-improvement: true`

## Impact

- `templates/agents/nightshift-manager.md` — add flag reading and conditional skip of step 5 (Apply Step Improvements)
- `templates/agents/nightshift-dev.md` — add conditional skip of step 4 (Identify Recommendations), always return `Recommendations: None` when flag is active
- `test/run-tests.ts` — two new test cases: `nightshift-start-no-self-improvement` and `nightshift-start-parallel-no-self-improvement`
- `README.md` — document `disable-self-improvement` in the Shift Configuration section
- No breaking changes — existing shifts without the flag behave identically
