## 1. Streamline Dev Agent Output

- [x] 1.1 Update `templates/agents/nightshift-dev.md` section 8 (Return Results) to output only `overall_status`, `recommendations`, and `error` (if failed) — remove Steps, Captured Values, Self-Validation, and Attempts sections from the output contract
- [x] 1.2 Update `templates/agents/nightshift-dev.md` Output Contract table to reflect the three-field contract: `overall_status` (required), `recommendations` (required), `error` (only if failed)
- [x] 1.3 Update `openspec/specs/nightshift-agents/spec.md` requirement "Dev agent extended output contract" to match the new three-field contract (sync delta specs to main)

## 2. Streamline QA Agent Output

- [x] 2.1 Update `templates/agents/nightshift-qa.md` section 5 (Return Results) to output only `overall_status` and `summary` — remove per-criterion Criteria section from the output format
- [x] 2.2 Update `templates/agents/nightshift-qa.md` Output Contract table to reflect the two-field contract: `overall_status` (required), `summary` (required)
- [x] 2.3 Update `openspec/specs/nightshift-agents/spec.md` requirement "QA agent role" to reflect the streamlined output contract (sync delta specs to main)

## 3. Update Manager QA Delegation

- [x] 3.1 Update `templates/agents/nightshift-manager.md` section 5 (Delegate to QA) sequential mode prompt to remove `## Dev Results` section — QA receives only validation criteria, item data, and state update parameters
- [x] 3.2 Update `templates/agents/nightshift-manager.md` section 5 parallel mode to remove dev results passthrough from QA delegation prompts
- [x] 3.3 Update the manager's post-QA processing to act on `overall_status` and `summary` only (no per-criterion parsing)

## 4. Update Manager Self-Continuation

- [x] 4.1 Update `templates/agents/nightshift-manager.md` section 7 (Loop) to continue processing batches autonomously instead of returning to the supervisor after each batch
- [x] 4.2 Update `templates/agents/nightshift-manager.md` section 6 (Update Progress and Report) so the manager only outputs `Progress: M/N` and `Compacted: true|false` when yielding to the supervisor (on compaction or completion), not after every batch
- [x] 4.3 Update `templates/agents/nightshift-manager.md` compaction detection to trigger a return to the supervisor with `Compacted: true` instead of just reporting it

## 5. Update Supervisor Loop

- [x] 5.1 Update `templates/commands/nightshift-start.md` step 6 (Supervisor loop) to remove per-batch re-invocation logic — the manager runs autonomously until it returns
- [x] 5.2 Update `templates/commands/nightshift-start.md` step 6 loop logic: on manager return without compaction, proceed to final report; on `Compacted: true`, start a fresh manager session
- [x] 5.3 Remove the termination check (`qsv search --exact todo` per task column) from the supervisor loop — the manager determines its own completion
- [x] 5.4 Update `templates/commands/nightshift-start.md` step 7 (Report results) to read final counts from `manager.md` Progress section instead of running independent qsv queries

## 6. Sync Specs

- [x] 6.1 Update `openspec/specs/nightshift-commands/spec.md` requirement "Start shift command" to reflect the new supervisor model (sync delta specs to main)
- [x] 6.2 Update `openspec/specs/nightshift-agents/spec.md` requirement "Manager agent role" to include self-continuation behavior (sync delta specs to main)
- [x] 6.3 Update `openspec/specs/nightshift-agents/spec.md` requirement "QA receives item data only" — add new requirement (sync delta specs to main)
