## 1. Project Scaffolding

- [x] 1.1 Create root `package.json` with name `@johndaskovsky/nightshift`, bin entry pointing to `bin/nightshift.js`, files array including `bin/`, `dist/`, `templates/`, and scripts for build/prepublishOnly
- [x] 1.2 Create `tsconfig.json` targeting ES2022 with NodeNext module resolution, `src/` as rootDir, `dist/` as outDir
- [x] 1.3 Create `build.js` script (modeled after OpenSpec's) that runs tsc and copies any non-TS assets
- [x] 1.4 Create `bin/nightshift.js` with shebang line that imports and runs the CLI from `dist/`
- [x] 1.5 Install dev dependencies: `typescript`; runtime dependencies: `commander`, `chalk`, `ora`
- [x] 1.6 Add `.gitignore` entries for `dist/` and `node_modules/`

## 2. CLI Entry Point

- [x] 2.1 Create `src/cli/index.ts` with commander program setup: name, version (read from package.json), description, and registration of `init` and `update` subcommands
- [x] 2.2 Create `src/index.ts` as the public API entry point exporting the CLI runner

## 3. Template Bundling

- [x] 3.1 Create `templates/agents/` directory and copy current `.opencode/agent/nightshift-manager.md`, `nightshift-dev.md`, `nightshift-qa.md` into it
- [x] 3.2 Create `templates/commands/` directory and copy current `.opencode/command/nightshift-create.md`, `nightshift-start.md`, `nightshift-archive.md`, `nightshift-add-task.md`, `nightshift-test-task.md`, `nightshift-update-table.md` into it
- [x] 3.3 Create `templates/opencode.jsonc` containing the default Nightshift agent block configuration (three agents with permissions)
- [x] 3.4 Create `src/core/templates.ts` with a function to resolve the templates directory relative to the installed package location (using `import.meta.url` or `__dirname` equivalent)

## 4. Core Scaffolding Logic

- [x] 4.1 Create `src/core/scaffolder.ts` with functions to: create directory structure (`.nightshift/archive/`, `.opencode/agent/`, `.opencode/command/`), write agent files, and write command files
- [x] 4.2 Implement file-exists detection: skip non-Nightshift files, overwrite Nightshift files

## 5. Config Merger

- [x] 5.1 Create `src/core/config-merger.ts` with logic to parse `opencode.jsonc`, merge Nightshift agent entries into the `agent` block, and write back preserving comments
- [x] 5.2 Handle the "no existing file" case: write the full template `opencode.jsonc`
- [x] 5.3 Handle the "existing file, no Nightshift agents" case: add the three agent entries to the existing `agent` block
- [x] 5.4 Handle the "existing file, stale Nightshift agents" case: update the three entries while preserving non-Nightshift keys
- [x] 5.5 Add integration test: round-trip a sample `opencode.jsonc` with comments through the merger and verify comments are preserved

## 6. Init Command

- [x] 6.1 Create `src/cli/commands/init.ts` implementing the `nightshift init` command with `--force` and `--yes` options
- [x] 6.2 Wire up the init sequence: scaffold directories, write agent files, write command files, merge `opencode.jsonc`
- [x] 6.3 Implement summary output: list all created/updated files and next-steps message
- [x] 6.4 Implement error handling: continue on non-fatal errors, report warnings in summary, exit with non-zero code if any step failed

## 7. Update Command

- [x] 7.1 Create `src/cli/commands/update.ts` implementing the `nightshift update` command with `--yes` option
- [x] 7.2 Implement update sequence: overwrite agent files, overwrite command files, re-merge `opencode.jsonc`
- [x] 7.3 Verify idempotency: running update twice produces byte-identical output
- [x] 7.4 Verify update does not touch `.nightshift/` directory contents

## 8. Build and Publish

- [x] 8.1 Verify `npm run build` compiles TypeScript to `dist/` without errors
- [x] 8.2 Verify `bin/nightshift.js` is executable and correctly imports from `dist/`
- [x] 8.3 Test `nightshift init` end-to-end against a fresh empty directory
- [x] 8.4 Test `nightshift update` against the current `night-shift` repository to verify it produces matching files
- [x] 8.5 Publish to npm as `@johndaskovsky/nightshift` (dry-run first with `npm publish --dry-run`)
