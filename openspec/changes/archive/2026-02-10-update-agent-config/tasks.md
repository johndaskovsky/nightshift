## 1. Delete opencode.jsonc Template and Config Merger

- [x] 1.1 Delete `templates/opencode.jsonc`
- [x] 1.2 Delete `src/core/config-merger.ts`
- [x] 1.3 Delete `test/config-merger.test.ts`
- [x] 1.4 Remove `jsonc-parser` dependency from `package.json`

## 2. Remove mergeOpencodeConfig from CLI Commands

- [x] 2.1 Remove `mergeOpencodeConfig` import and Step 4 (merge opencode.jsonc) from `src/cli/commands/init.ts`
- [x] 2.2 Remove `mergeOpencodeConfig` import and re-merge step from `src/cli/commands/update.ts`
- [x] 2.3 Remove `mergeOpencodeConfig` export from `src/index.ts`

## 3. Build Verification

- [x] 3.1 Run `bun run build` and confirm no type errors or compilation failures

## 4. Spec Sync

- [x] 4.1 Remove the "Agent definitions in opencode.jsonc" requirement from `openspec/specs/nightshift-agents/spec.md`
- [x] 4.2 Remove the "Init command merges opencode.jsonc" requirement from `openspec/specs/nightshift-installer/spec.md`
- [x] 4.3 Remove the "Update re-merges opencode.jsonc" scenario from the "Update command regenerates framework files" requirement in `openspec/specs/nightshift-installer/spec.md`
- [x] 4.4 Update the "Template bundling" requirement in `openspec/specs/nightshift-installer/spec.md` to remove `opencode.jsonc` from the templates list and remove the "no agent definitions" scenario
