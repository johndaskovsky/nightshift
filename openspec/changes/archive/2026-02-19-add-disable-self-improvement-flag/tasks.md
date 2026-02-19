## 1. Manager Agent

- [x] 1.1 Add `disable-self-improvement` flag reading to the Shift Configuration parsing section of `templates/agents/nightshift-manager.md`
- [x] 1.2 Pass the `disable-self-improvement` flag state to the dev agent in the delegation prompt template
- [x] 1.3 Wrap the Apply Step Improvements step (step 5) in a conditional: skip entirely when `disable-self-improvement: true`

## 2. Dev Agent

- [x] 2.1 Add `disable-self-improvement` flag reading from the manager-provided context in `templates/agents/nightshift-dev.md`
- [x] 2.2 Wrap the Identify Recommendations step (step 4) in a conditional: skip and return `Recommendations: None` when the flag is active

## 3. Tests

- [x] 3.1 Add `FIXTURE_MANAGER_NO_SELF_IMPROVEMENT` fixture constant (serial, with `disable-self-improvement: true`) to `test/run-tests.ts`
- [x] 3.2 Add `FIXTURE_MANAGER_PARALLEL_NO_SELF_IMPROVEMENT` fixture constant (parallel + `disable-self-improvement: true`) to `test/run-tests.ts`
- [x] 3.3 Add `nightshift-start-no-self-improvement` test case (mirrors serial test, uses new fixture)
- [x] 3.4 Add `nightshift-start-parallel-no-self-improvement` test case (mirrors parallel test, uses new fixture)
- [x] 3.5 Update test execution order comment/array to include the two new tests

## 4. README

- [x] 4.1 Add `disable-self-improvement` to the Shift Configuration section of `README.md`, documenting its purpose and default behavior alongside the existing parallel configuration fields
