## 1. Scaffolder

- [x] 1.1 Add `writeGitignoreFile` function to `src/core/scaffolder.ts` that writes `.nightshift/.gitignore` with the content `table.csv.bak\n`, following the same `ScaffoldOptions`/`ScaffoldResult` pattern as `writeAgentFiles` and `writeCommandFiles`
- [x] 1.2 Export `writeGitignoreFile` from `src/index.ts`

## 2. CLI Commands

- [x] 2.1 Add a `.gitignore` write step to `src/cli/commands/init.ts` after the command files step, with its own spinner and error handling matching the existing pattern
- [x] 2.2 Add a `.gitignore` write step to `src/cli/commands/update.ts` after the command files step, with `force: true` and matching spinner/error handling

## 3. Tests

- [x] 3.1 Add a `.nightshift/.gitignore` file check and a content check for `table.csv.bak` to the init test's checks array in `test/run-tests.ts`

## 4. Build and Verify

- [x] 4.1 Run `pnpm run build` and confirm no compilation errors
- [x] 4.2 Run `pnpm test` and confirm all tests pass including the new `.gitignore` checks
