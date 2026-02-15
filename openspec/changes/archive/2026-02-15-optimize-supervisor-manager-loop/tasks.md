## 1. Remove QA Agent

- [x] 1.1 Delete `templates/agents/nightshift-qa.md` template file
- [x] 1.2 Remove `nightshift-qa` agent entry from `opencode.jsonc` (agent definition and permission block)
- [x] 1.3 Remove `nightshift-qa` from the manager agent's `permission.task` allowlist in `templates/agents/nightshift-manager.md`

## 2. Update Dev Agent Status Writes

- [x] 2.1 In `templates/agents/nightshift-dev.md`, change success status write from `qa` to `done` in the State Update instructions and all references
- [x] 2.2 In `templates/agents/nightshift-manager.md` section 4 (Delegate to Dev), update the dev delegation prompt to instruct the dev to write `done` on success instead of `qa`

## 3. Remove QA Delegation from Manager

- [x] 3.1 Remove section 5 (Delegate to QA) entirely from `templates/agents/nightshift-manager.md`
- [x] 3.2 Remove the dev status verification step (qsv read to confirm `qa` status before QA dispatch) from both sequential and parallel mode flows
- [x] 3.3 Update the manager's sequential mode loop (section 7) to remove QA delegation references — after dev returns and step improvements are applied, proceed directly to the next item
- [x] 3.4 Update the manager's parallel mode flow to remove QA batch dispatch — after dev batch returns and step improvements are applied, proceed to batch size adjustment and next batch
- [x] 3.5 Update the "Manager handles dev failure" instruction (section 4) to say "proceed to the next item or batch" instead of "skip QA for this item"

## 4. Remove Compaction Detection

- [x] 4.1 Remove the "Compaction Detection" subsection from section 6 of `templates/agents/nightshift-manager.md`
- [x] 4.2 Remove all compaction detection checks from the sequential mode loop (section 7) — the manager simply continues to the next item
- [x] 4.3 Remove all compaction detection checks from the parallel mode loop (section 7) — after batch size adjustment, loop directly to next batch
- [x] 4.4 Remove `Compacted: true|false` from the manager's completion output format (section 8)
- [x] 4.5 In `templates/commands/nightshift-start.md`, remove the supervisor compaction recovery loop — the supervisor invokes the manager once via the Task tool and reads the result
- [x] 4.6 Remove all `Compacted` parsing logic and fresh-session-on-compaction instructions from `templates/commands/nightshift-start.md`

## 5. Remove Progress Section Writes

- [x] 5.1 Remove section 6 (Update Progress) from `templates/agents/nightshift-manager.md` — the manager no longer writes counts to `manager.md`
- [x] 5.2 Update the completion output (section 8) to derive M/N counts from `table.csv` via `qsv search` and `qsv count` instead of reading from `## Progress` in `manager.md`
- [x] 5.3 Remove the `## Progress` section from the `manager.md` template in `templates/commands/nightshift-create.md`
- [x] 5.4 Remove the progress recalculation step from `templates/commands/nightshift-update-table.md`

## 6. Update State Machine

- [x] 6.1 In `templates/agents/nightshift-manager.md` section 2 (Handle Resume), remove the `qsv search --exact qa` check — only search for `todo` items
- [x] 6.2 Update the manager's role description to reference only `todo`, `done`, `failed` as valid status values
- [x] 6.3 Update `templates/commands/nightshift-start.md` pre-flight summary to reference only `todo`, `done`, `failed` status values (remove `qa` from status breakdown)

## 7. Update Installer and Tests

- [x] 7.1 In `src/`, update the init command to write 2 agent files instead of 3 (remove `nightshift-qa.md` from the file list)
- [x] 7.2 In `src/`, update the update command to regenerate 2 agent files instead of 3
- [x] 7.3 Update `test/run-tests.ts` init test to expect 2 agent files instead of 3
- [x] 7.4 Update `test/run-tests.ts` create command test to expect `## Shift Configuration` and `## Task Order` sections only (remove `## Progress` assertion)
- [x] 7.5 Run `pnpm build` and `pnpm test` to verify all changes pass

## 8. Renumber and Clean Up Manager Sections

- [x] 8.1 Renumber the manager agent's sections after removing section 5 (QA) and section 6 (Progress) — the final section order should be: 1. Read Shift State, 2. Handle Resume, 3. Item Selection Algorithm, 4. Delegate to Dev, 5. Apply Step Improvements, 6. Loop, 7. Completion
- [x] 8.2 Review all cross-references within the manager file (e.g., "see section 6", "see section 7") and update to match new numbering
- [x] 8.3 Update the manager file's role description preamble to remove references to QA delegation, compaction detection, and progress tracking

## 9. Sync Specs

- [ ] 9.1 Run `openspec sync` to apply all delta specs to the main spec files
