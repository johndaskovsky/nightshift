## 1. Update Dev Agent Instructions

- [x] 1.1 Add self-improvement section to `.opencode/agent/nightshift-dev.md`: after step execution, dev refines the Steps section of the task file based on execution feedback (errors, ambiguities, missing handling). Include explicit rule that Configuration and Validation sections are immutable.
- [x] 1.2 Add self-validation section to `.opencode/agent/nightshift-dev.md`: after step refinement, dev reads the Validation section and evaluates each criterion against execution outcomes. Document the pass/fail evaluation format.
- [x] 1.3 Add retry loop to `.opencode/agent/nightshift-dev.md`: if self-validation fails and attempts < 3, refine steps and re-execute from the beginning. After 3 failed attempts, report failure. Include step execution failures as counted attempts.
- [x] 1.4 Extend the dev agent output contract in `.opencode/agent/nightshift-dev.md`: add `Attempts` section (count), `Self-Validation` section (per-criterion pass/fail), and `Steps Refined` flag to the structured result format.

## 2. Update Manager Agent Instructions

- [x] 2.1 Update the dev delegation prompt in `.opencode/agent/nightshift-manager.md`: include the full task file (with Validation section) in the dev prompt, and add instructions about self-improvement, self-validation, and retry responsibilities.
- [x] 2.2 Update manager error handling in `.opencode/agent/nightshift-manager.md`: handle the extended dev result format (attempt count, self-validation results). When dev reports failure after retries, record attempt count in failure details.

## 3. Update Delta Specs in Main Specs

- [x] 3.1 Verify delta spec `nightshift-tasks` correctly adds mutability rules and modifies the task steps requirement with self-improvement scenarios.
- [x] 3.2 Verify delta spec `nightshift-agents` correctly adds self-validation, retry loop, and step self-improvement requirements, and modifies the dev agent role and manager delegation requirements.
