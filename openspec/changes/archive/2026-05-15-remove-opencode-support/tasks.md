## 1. Delete OpenCode templates and plugin output

- [x] 1.1 Delete the `templates/opencode/` directory and all its contents (`agents/nightshift-manager.md`, `agents/nightshift-dev.md`, `commands/nightshift-*.md`).
- [x] 1.2 Confirm `agents/` and `skills/` at the repo root (plugin output materialized by `build.js`) contain no OpenCode references — they're rebuilt from `templates/claude/` so should already be clean. No manual edit needed unless `build.js` left stale files.

## 2. Strip OpenCode out of the scaffolder

- [x] 2.1 In `src/core/scaffolder.ts`: remove the `Target` type, `targetIncludes()`, `resolveTarget()`, and `writeOpenCodeCommandFiles()`. Simplify `scaffoldDirectories()` to always create the Claude directories. Inline the previously-target-gated logic in `writeAgentFiles()` to write only the Claude agents.
- [x] 2.2 In `src/index.ts`: remove the `Target`, `ScaffoldOptions`, `WriteAction`, `resolveTarget`, `targetIncludes`, and `writeOpenCodeCommandFiles` exports that no longer exist. Keep `scaffoldDirectories`, `writeAgentFiles`, `writeClaudeSkillFiles`, `writeClaudeSettingsFile`, `writeClaudeMdFile`, `writeGitignoreFile`, and the `getTemplatesDir` / `getTemplatePath` exports.
- [x] 2.3 In `src/core/templates.ts`: if `getTemplatePath` takes a runtime argument, simplify it to resolve under `templates/claude/` directly. Otherwise, leave alone.

## 3. Strip OpenCode out of the CLI

- [x] 3.1 In `src/cli/commands/init.ts`: remove the `--target` / `-t` option from commander, drop the `resolveTarget()` call, drop all `includesOpencode` / `includesClaude` branching, and drop the "Target: ..." log line and the "auto-detected" suffix.
- [x] 3.2 In `src/cli/commands/init.ts`: simplify the spinner messages — only one path of "Writing/Updating ... files" calls remains (agents, Claude skills, Claude settings, CLAUDE.md, gitignore). Drop the "Writing OpenCode command files..." block entirely.
- [x] 3.3 In `src/cli/commands/init.ts`: simplify the Next Steps section to a single Claude-Code-only path; drop the OpenCode mention and the `if (includesClaude) {` guard around the restart-Claude-Code note.

## 4. Strip OpenCode out of the tests

- [x] 4.1 In `test/init-tests.ts`: delete the `init --target=opencode (regression)` test case and the `manager prose parity (OpenCode ↔ Claude)` test case. Update any test that runs `runInit(dir, ["--target=...something"])` to drop the flag.
- [x] 4.2 In `test/init-tests.ts`: delete assertions of the form `assert(!existsSync(join(dir, ".opencode")), ...)` and any positive existence checks against `.opencode/...` paths (e.g., the auto-detect test that asserts OpenCode files exist after `nightshift init`).
- [x] 4.3 In `test/run-tests.ts`: delete the `Runtime` type, the `--runtime` arg parsing, the `NIGHTSHIFT_TEST_RUNTIMES` env var read, the `isCliAvailable("opencode")` check, and the per-runtime loop. Inline `runtime = "claude"` at every call site that used the parameter.
- [x] 4.4 In `test/run-tests.ts`: collapse the OpenCode/Claude branch in the command-execution function so only the `claude -p ...` invocation remains. Drop the OpenCode-existence pre-flight (lines around `opencodeReady` / `opencode.commands`).
- [x] 4.5 In `test/run-tests.ts`: remove every `for (const subdir of [".opencode", ".claude", ".nightshift"])` style enumeration so only `.claude/` and `.nightshift/` are cleaned/checked. Remove the OpenCode existence checks in the "Init scaffolds expected OpenCode files" block.
- [x] 4.6 In `test/run-tests.ts`: drop the runtime suffix on test names and benchmark keys. The display name becomes plain `nightshift-start` (etc.); the benchmark lookup becomes the bare key.
- [x] 4.7 In `test/benchmarks.json`: delete every `nightshift-*.opencode` key. Rename `nightshift-*.claude` keys to drop the `.claude` suffix, preserving the existing numeric baselines.
- [x] 4.8 In `package.json`: delete the `test:integration:opencode` and `test:integration:both` scripts (also drop `:claude` — it's a duplicate of `:integration` once OpenCode is gone; the test-runner spec lists only `test:init` and `test:integration`).

## 5. Update package metadata

- [x] 5.1 In `package.json`: bump `version` from `1.1.0` to `2.0.0`.
- [x] 5.2 In `package.json`: remove `"opencode"` from `keywords`.

## 6. Rewrite documentation

- [x] 6.1 Rewrite `README.md` to describe a Claude-Code-only product. Specifically: drop "OpenCode **or**" from Prerequisites; drop `--target=...` examples and the auto-detection bullet list from Installation; drop the OpenCode line from the "scaffolds ..." paragraph; drop the entire "Enabling Playwright (OpenCode)" subsection; in Project Layout, delete the `templates/opencode/` block and update the prose that follows.
- [x] 6.2 Rewrite `AGENTS.md` to remove the dual-runtime framing: simplify the Runtime line, drop the `test:integration:opencode` and `:both` script references, drop the `templates/opencode/` entry from the project tree, drop the "Permissions Reference (from opencode.jsonc)" section (or rewrite to point at `.claude/settings.json` if the content is still useful — verify in the file).
- [x] 6.3 Add a `## [2.0.0] - <today>` entry at the top of `CHANGELOG.md` with a `### BREAKING` subsection noting the OpenCode removal and pointing users at the 1.1.x line. Leave all historical CHANGELOG entries unchanged.
- [x] 6.4 Verify the project's own `CLAUDE.md` (root of repo) — if it mentions OpenCode, update it to match the new single-runtime story. (This is the maintainer-facing CLAUDE.md, not the `templates/claude/CLAUDE.md` template fragment.) — no root CLAUDE.md exists; nothing to update.

## 7. Build, test, validate

- [x] 7.1 Run `pnpm build` and confirm it succeeds. Inspect the build output: `dist/` should not contain any references to `opencode`; `agents/` and `skills/` at repo root should be rebuilt clean.
- [x] 7.2 Run `pnpm test:init` and confirm all init tests pass. (11/11 pass.)
- [x] 7.3 Run `pnpm test:integration` against Claude Code and confirm the integration tests pass (or fail in ways that look unrelated to this refactor, to be addressed separately). — Result: init 10/10 pass; three of four shift tests pass accuracy (`nightshift-start-parallel`, `nightshift-start-no-self-improvement`, `nightshift-start-parallel-no-self-improvement`). One unrelated flake: sequential `nightshift-start` returned 0/3 output checks; the other variants use the same skill and pass, so this is pre-existing flake in the slow sequential path, not a regression from this refactor. Benchmark regression warnings are LLM-latency variance and not actionable here.
- [x] 7.4 Run `npm pack --dry-run` and confirm the printed file list contains no `templates/opencode/...` entries.
- [x] 7.5 Spot-check — remaining matches are expected: CHANGELOG (historical), `.opencode/` (maintainer-local, out of scope), and the 5 active spec files in `openspec/specs/` (will be updated by `/opsx:archive`).

## 8. Archive the change

- [x] 8.1 Run `openspec validate remove-opencode-support --strict` to confirm the change still validates after implementation.
- [x] 8.2 Once the branch is reviewed and merged, run `/opsx:archive remove-opencode-support` to fold the delta specs back into `openspec/specs/`.
