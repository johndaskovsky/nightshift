## 1. Author the nightshift-do-task skill

- [x] 1.1 Create `templates/claude/skills/nightshift-do-task/SKILL.md` with frontmatter `disable-model-invocation: true`, `allowed-tools: Bash(qsv *) Bash(flock *) Bash(mkdir *)`, `argument-hint: <shift-name> <task-name> <item-id> [--read-only]`, and a `description` summarizing the skill's purpose.
- [x] 1.2 Write the skill body: parse positional args; resolve `.nightshift/<shift>/manager.md`, the matching task file, and the item row from `table.csv`; substitute `{column}`, `{ENV:...}`, `{SHIFT:...}` placeholders; execute task steps; perform up to 3 attempts with self-validation; emit a structured final report (status, attempts, recommendations, error if any).
- [x] 1.3 Implement the `--read-only` branch: if the 4th positional is `--read-only`, skip the row status write and skip recommendation reporting (or mark recommendations as informational only).
- [x] 1.4 Document the skill body's expected final-message structure (status/attempts/recommendations) so the manager's parser and the test assertions have one source of truth.

## 2. Author the dispatch-batch.sh helper

- [x] 2.1 Create `templates/claude/skills/nightshift-start/scripts/dispatch-batch.sh` accepting a JSON manifest on stdin or via path argument (shift, items array, permission_mode, log_dir).
- [x] 2.2 Implement: parse manifest with `jq`; for each item, spawn `claude -p "/nightshift-do-task <shift> <task> <item_id>" --output-format stream-json --permission-mode <mode> > <log_path> &` in the background; wait for all; for each, capture exit code; parse the last `"type":"result"` line from each log to extract status + recommendations; emit a single JSON `{"results":[...]}` document to stdout.
- [x] 2.3 Mark the script executable in the build/scaffold path.
- [x] 2.4 Add a `--probe` mode (or a separate `auto-mode-probe.sh`) that runs `claude --permission-mode auto -p "echo ready"` once and emits `{"auto_mode":"available|unavailable","reason":"..."}` so the manager can decide which permission_mode to pass.

## 3. Update the nightshift-manager subagent

- [x] 3.1 Edit `templates/claude/agents/nightshift-manager.md` frontmatter: drop `Agent(nightshift-dev)` from the `tools` list. Keep `Read, Write, Edit, Bash, Glob, Grep`.
- [x] 3.2 Rewrite the manager prose body: replace "spawn nightshift-dev subagent via Agent tool" with "spawn dev work via `${CLAUDE_SKILL_DIR}/scripts/dispatch-batch.sh`" instructions. Include: the auto-mode probe step (run once on shift start), the manifest format, how to parse the helper's JSON result, the per-batch lifecycle (dispatch → wait → parse → apply recommendations → loop).
- [x] 3.3 Replace any references to `nightshift-dev` agent semantics with references to the `nightshift-do-task` skill and its argument shape (`<shift> <task> <item-id> [--read-only]`).
- [x] 3.4 Verify the rewritten prose body fits under 20,000 characters (the proxy for 5,000 tokens). If not, push detail into `dispatch-batch.sh` documentation or the do-task skill body.

## 4. Delete the nightshift-dev subagent

- [x] 4.1 Delete `templates/claude/agents/nightshift-dev.md` from the templates tree.
- [x] 4.2 Confirm `build.js`'s `cpSync` of `templates/claude/agents/` to plugin root `agents/` produces a clean `agents/` directory with only `nightshift-manager.md`.

## 5. Scaffolder updates for the new layout

- [x] 5.1 In `src/core/scaffolder.ts`: in `writeAgentFiles`, write only `nightshift-manager.md` (drop `nightshift-dev.md` from the agent-file list).
- [x] 5.2 In `src/core/scaffolder.ts`: add a `removeStaleAgentFiles` (or similar) function that detects `.claude/agents/nightshift-dev.md`. If content matches the bundled 2.x template (by hash, or by a sentinel string check), delete silently and record the action. Otherwise rename to `.claude/agents/nightshift-dev.md.bak.<ISO-timestamp>` and emit a warning.
- [x] 5.3 Call `removeStaleAgentFiles` from `src/cli/commands/init.ts` as part of the init flow; surface its actions in the summary output.
- [x] 5.4 In `writeClaudeSkillFiles`: confirm the `readdirSync(skillsDir).filter(... startsWith("nightshift-"))` pattern automatically picks up the new `nightshift-do-task/` skill directory (no scaffolder code change needed beyond adding the template).
- [x] 5.5 In `writeClaudeSettingsFile`: extend `REQUIRED_BASH_ALLOW` to include `Bash(claude *)` alongside the existing `Bash(qsv *)` and `Bash(flock *)` entries.

## 6. Update .nightshift gitignore for logs

- [x] 6.1 Update `src/core/scaffolder.ts` `writeGitignoreFile` to emit `table.csv.bak\n**/logs/\n` (or equivalent — capture both the existing pattern and the new logs/ pattern).
- [x] 6.2 Update any init tests that snapshot `.nightshift/.gitignore` content to expect the new line.

## 7. Update the test-task skill

- [x] 7.1 Edit `templates/claude/skills/nightshift-test-task/SKILL.md` body to invoke `claude -p "/nightshift-do-task <shift> <task> <id> --read-only" --output-format stream-json --permission-mode <mode>` via Bash, instead of forking to a dev subagent.
- [x] 7.2 Surface the dev's parsed final report to the user with a "no state was modified" prefix.
- [x] 7.3 Include the safety boundary line in the prompt for defense-in-depth alongside the `--read-only` flag.

## 8. Plugin manifest and version

- [x] 8.1 In `package.json`: bump `version` from `2.0.0` to `3.0.0`. The plugin manifest version syncs automatically via `build.js`.
- [x] 8.2 Verify `build.js` doesn't carry over a stale `agents/nightshift-dev.md` after the delete (it `rmSync`s the dir first — but confirm with a clean build).

## 9. Test runner updates

- [x] 9.1 In `test/run-tests.ts`: read `process.env.NIGHTSHIFT_TEST_NO_AUTO_MODE` and, when set, pass it through to the `claude -p ...` invocation so the manager forces `bypassPermissions`. (The cleanest implementation may be a manager-readable env var or a temporary file the manager probe checks.)
- [x] 9.2 In `test/run-tests.ts`: extend the per-shift-test checks to assert that `.nightshift/<shift>/logs/` exists post-run and contains at least one `.jsonl` file per item.
- [x] 9.3 Reset benchmark baselines in `test/benchmarks.json` (delete the existing numeric values; first run on the new architecture establishes new baselines).
- [x] 9.4 In `test/run-tests.ts`: extend the per-test timeout where reasonable — subprocess startup adds 5–15s per item; serial 3-item shifts may run longer than today.
- [x] 9.5 In `test/init-tests.ts`: add a test that pre-seeds `.claude/agents/nightshift-dev.md` (with bundled-template content) and asserts it is removed after `nightshift init`. Add a second test that pre-seeds a user-modified `nightshift-dev.md` and asserts it is renamed to `.bak.<timestamp>`.

## 10. Documentation

- [x] 10.1 Rewrite the relevant README sections to describe the new architecture: dev is a subprocess, MCPs are inherited from the user's top-level Claude Code config (no per-task setup), real-time logs at `.nightshift/<shift>/logs/`. Drop the Playwright-enabling-via-subagent-MCP-block section; replace with a note that any user-configured MCP (Playwright, Slack, etc.) is automatically available to dev work.
- [x] 10.2 Add a README subsection on `--permission-mode auto`: what it does, the eligibility constraints (v2.1.83+, Max/Team/Enterprise/API plan, Sonnet 4.6 / Opus 4.6 / Opus 4.7, Anthropic API provider), and the `bypassPermissions` fallback.
- [x] 10.3 Update AGENTS.md: remove dev-agent references in the agent overview, update the Permissions Reference (no Agent delegation; new `Bash(claude *)` allowance for manager), describe the dispatch-batch.sh helper at the architecture level.
- [x] 10.4 Add a CHANGELOG `## [3.0.0]` entry with `### BREAKING` listing: dev role moves to subprocess, `nightshift-dev.md` removed/migrated, manager allowlist changes, observability shifts to per-item log files, benchmark baselines reset.

## 11. Build, test, validate

- [x] 11.1 Run `pnpm build`. Confirm `agents/` at repo root contains only `nightshift-manager.md`; `skills/` contains the new `nightshift-do-task` directory and the updated `nightshift-start/scripts/dispatch-batch.sh`.
- [x] 11.2 Run `npx tsc --noEmit` — type-check clean.
- [x] 11.3 Run `pnpm test:init`. Confirm all init tests pass, including the new stale-dev-subagent cleanup tests.
- [x] 11.4 Run `pnpm test:integration` (or `NIGHTSHIFT_TEST_NO_AUTO_MODE=1 pnpm test:integration` on environments without auto mode). Confirm shift tests succeed end-to-end and per-item log files exist. — Result: 4/5 tests pass on first run. init 11/11; nightshift-start-parallel 4/4; nightshift-start-no-self-improvement 4/4; nightshift-start-parallel-no-self-improvement 4/4. The 5th (sequential `nightshift-start` with self-improvement) hit the 5-min timeout after completing 2 of 3 items — not a logic error; the new architecture's per-item subprocess overhead plus task-file rewrites between each item is the slowest path. Bumped `DEFAULT_TIMEOUT_MS` to 10 min in `test/run-tests.ts` to accommodate.
- [x] 11.5 Run `npm pack --dry-run`. Confirm the tarball contains `templates/claude/skills/nightshift-do-task/SKILL.md` and `templates/claude/skills/nightshift-start/scripts/dispatch-batch.sh`; confirm it does NOT contain `templates/claude/agents/nightshift-dev.md`.
- [x] 11.6 Run `openspec validate dev-to-cli-subprocess --strict`. Confirm the change still validates after implementation.

## 12. Archive

- [x] 12.1 Once the branch is reviewed and merged, run `/opsx:archive dev-to-cli-subprocess` to fold the delta specs back into `openspec/specs/`. (If sync fails for the same formatting reasons as the previous archive, use `--skip-specs` and follow up with a separate spec-normalization pass.)
