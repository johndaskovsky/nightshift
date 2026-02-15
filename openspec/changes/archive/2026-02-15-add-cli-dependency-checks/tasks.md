## 1. Shared Dependency Check Utility

- [x] 1.1 Create `src/core/dependencies.ts` with a `checkDependencies()` function that executes `qsv --version` and `flock --version` via `child_process.execSync` (with a 5-second timeout), returning a structured result with availability status and version string for each dependency
- [x] 1.2 Export the `DependencyResult` interface and `checkDependencies` function from the core module

## 2. CLI Init Command

- [x] 2.1 Import `checkDependencies` in `src/cli/commands/init.ts` and call it after file scaffolding completes
- [x] 2.2 Add a `--- Dependencies ---` summary section between the file list and next-steps output that displays `✓` for present dependencies and `!` with install instructions for missing ones

## 3. CLI Update Command

- [x] 3.1 Import `checkDependencies` in `src/cli/commands/update.ts` and call it after file regeneration completes
- [x] 3.2 Add a `--- Dependencies ---` summary section between the file list and the "Update complete" message that displays `✓` for present dependencies and `!` with install instructions for missing ones

## 4. Remove Pre-flight Checks from nightshift-start

- [x] 4.1 Remove Step 3 (pre-flight dependency checks) from `templates/commands/nightshift-start.md` — the `qsv --version` / `flock --version` checks and error-stop behavior
- [x] 4.2 Remove the `qsv: v<version>` and `flock: v<version>` lines from the pre-flight summary display in Step 5
- [x] 4.3 Remove the guardrail "Always check qsv and flock availability before proceeding" from the Guardrails section
- [x] 4.4 Renumber the remaining steps (Steps 4-7 become Steps 3-6)

## 5. Spec Updates

- [x] 5.1 Sync the `nightshift-commands` delta spec to the main spec — remove the pre-flight dependency check scenarios and update the start command requirement text
- [x] 5.2 Sync the `nightshift-installer` delta spec to the main spec — update init summary requirement and add update summary requirement
- [x] 5.3 Sync the `qsv-csv-operations` delta spec to the main spec — update the "qsv is not available" scenario to reference CLI installer verification
- [x] 5.4 Sync the `table-file-locking` delta spec to the main spec — update the "flock is not available" scenario to reference CLI installer verification
- [x] 5.5 Add the new `cli-dependency-verification` spec to `openspec/specs/cli-dependency-verification/spec.md`

## 6. Build and Test

- [x] 6.1 Run `pnpm run build` and verify no compilation errors
- [x] 6.2 Run `pnpm test` and verify all tests pass
