## 1. Spec updates: qsv-csv-operations

- [x] 1.1 Change `qa` status example to `done` in the "Update a status cell" scenario (line 16-17)
- [x] 1.2 Update "Bash permission for qsv" requirement text to remove QA agent and global OpenCode references (line 96-97)
- [x] 1.3 Remove "QA agent bash permissions" scenario (lines 107-109)
- [x] 1.4 Remove "Global bash permissions" scenario (lines 111-113)

## 2. Spec updates: table-file-locking

- [x] 2.1 Update Purpose section to say "manager, dev" instead of "manager, dev, QA" (line 3)
- [x] 2.2 Update "Exclusive file locking" requirement text to say "all agents (manager, dev)" instead of "all agents (manager, dev, QA)" (line 19)
- [x] 2.3 Update "Status write with lock" scenario to say "dev agent" instead of "dev or QA agent" (line 22)
- [x] 2.4 Remove entire "QA agent bash permissions for table locking" requirement block (lines 52-61)

## 3. Spec updates: nightshift-installer

- [x] 3.1 Update "Non-interactive mode" requirement to specify `--force` and `--yes` for `init`, `--yes` only for `update` (lines 82-91)
- [x] 3.2 Update "Build produces dist output" scenario to say `pnpm run build` instead of `npm run build` (line 123)

## 4. Spec updates: test-runner

- [x] 4.1 Update "Test execution order" requirement to list only `init`, `nightshift-start`, `nightshift-start-parallel` (line 166)
- [x] 4.2 Remove "Nightshift-create command test" requirement (lines 66-79)
- [x] 4.3 Remove "Nightshift-add-task command test" requirement (lines 81-94)
- [x] 4.4 Remove "Nightshift-update-table command test" requirement (lines 96-105)
- [x] 4.5 Remove "Nightshift-test-task command test" requirement (lines 121-126)
- [x] 4.6 Remove "Nightshift-archive command test" requirement (lines 128-137)

## 5. AGENTS.md rewrite

- [x] 5.1 Update Project Overview to describe two-agent system and mention TypeScript CLI codebase
- [x] 5.2 Update Build section to mention `pnpm run build` and actual test commands
- [x] 5.3 Update test-task description to remove QA agent reference
- [x] 5.4 Update Repository Structure to reflect current project layout (add `src/`, `templates/`, `bin/`, `dist/`, `test/`; remove `opencode.jsonc` and `nightshift-qa.md`)
- [x] 5.5 Rewrite Architecture section: two-agent system, three-state machine (`todo`, `done`, `failed`), dev writes `done`/`failed`
- [x] 5.6 Update Key architectural rules: remove QA references, fix resumability description
- [x] 5.7 Remove JSONC formatting section or update to note it applies only to target projects
- [x] 5.8 Update error handling patterns: remove `qa` durable state reference
- [x] 5.9 Update Permissions Reference table: remove QA row, fix manager delegation column

## 6. README.md updates

- [x] 6.1 Update intro paragraph: "two-agent system" instead of "three-agent system"; remove "no traditional source code" claim
- [x] 6.2 Rewrite How It Works agent list: remove QA bullet, fix dev status to `done`/`failed`
- [x] 6.3 Fix state machine diagram: `todo -> done` / `todo -> failed` / `failed -> todo`
- [x] 6.4 Update step 4 (Run the shift): remove "sends successful results to QA"
- [x] 6.5 Update step 5 (Test a task): remove "both dev and QA agents"
- [x] 6.6 Fix table.csv example: change `qa` status to `done` (line 213)
- [x] 6.7 Update status values line: remove `qa` from list (line 218)
- [x] 6.8 Fix dev agent retry loop step 6: change `qa` to `done` (line 246)
- [x] 6.9 Rewrite QA Verification section: replace with note about dev self-validation
- [x] 6.10 Rewrite Resumability section: remove `qa` state references, describe three-state resume behavior
- [x] 6.11 Update Agent Permissions table: remove QA row, fix manager delegation to "dev only"
- [x] 6.12 Update Project Layout section to show current structure (add `src/`, `templates/`, `bin/`, `dist/`, `test/`)
