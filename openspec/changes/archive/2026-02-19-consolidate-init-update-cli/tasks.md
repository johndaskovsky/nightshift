## 1. Remove update command

- [x] 1.1 Delete `src/cli/commands/update.ts`
- [x] 1.2 Remove `createUpdateCommand` import and `program.addCommand(createUpdateCommand())` from `src/cli/index.ts`

## 2. Clean up scaffolder interface

- [x] 2.1 Remove `force?: boolean` from the `ScaffoldOptions` interface in `src/core/scaffolder.ts`

## 3. Consolidate init command

- [x] 3.1 Remove `InitOptions` interface and `--force`/`--yes` flag definitions from `src/cli/commands/init.ts`
- [x] 3.2 Add first-run detection: check for `.opencode/agent/nightshift-manager.md` existence before scaffolding begins
- [x] 3.3 Implement conditional messaging based on first-run detection: banner text, spinner labels, and footer (Next Steps vs "Update complete.")
- [x] 3.4 Remove `force` parameter from all scaffolder calls in `init.ts`

## 4. Update documentation

- [x] 4.1 Update `README.md`: remove `nightshift update` section from Installation, update "Nightshift runs inside OpenCode" paragraph, remove update reference from Project Layout comment
- [x] 4.2 Update `AGENTS.md`: remove `nightshift update` from Build commands section, update any Architecture references

## 5. Build and verify

- [x] 5.1 Run `pnpm run build` and verify no compilation errors
- [x] 5.2 Run `pnpm test` and verify all tests pass (tests only exercise `init`, no changes needed)
