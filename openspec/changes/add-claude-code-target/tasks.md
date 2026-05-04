## 1. Template Reorganization

- [ ] 1.1 Create `templates/opencode/` directory and move existing `templates/agents/` to `templates/opencode/agents/`
- [ ] 1.2 Move existing `templates/commands/` to `templates/opencode/commands/`
- [ ] 1.3 Update `src/core/scaffolder.ts` paths from `templates/agents` to `templates/opencode/agents` and similarly for commands
- [ ] 1.4 Run existing test suite (`pnpm test`) to confirm OpenCode behavior is unchanged after the move

## 2. Claude Subagent Templates

- [ ] 2.1 Create `templates/claude/agents/nightshift-manager.md` with Claude subagent frontmatter (`name`, `description`, `tools: Agent(nightshift-dev), Read, Write, Edit, Bash, Glob, Grep`, `model: sonnet`)
- [ ] 2.2 Port the manager orchestration prose from the OpenCode template, replacing OpenCode-specific phrasing ("Task tool", `permission.task`) with Claude-native phrasing ("spawn nightshift-dev subagent", `Agent(nightshift-dev)`)
- [ ] 2.3 Verify the manager body is under ~20,000 characters (≈5,000 tokens) per the re-attach budget requirement
- [ ] 2.4 Create `templates/claude/agents/nightshift-dev.md` with frontmatter (`name`, `description`, `tools: Read, Write, Edit, Bash, Glob, Grep`, `model: inherit`)
- [ ] 2.5 Add a commented `mcpServers` example block to `nightshift-dev.md` showing the inline Playwright MCP definition without activating it
- [ ] 2.6 Port dev execution prose (placeholder substitution, retry, self-validation, status update) from the OpenCode template

## 3. Claude Skill Templates

- [ ] 3.1 Create `templates/claude/skills/nightshift-create/SKILL.md` with `disable-model-invocation: true`, `allowed-tools: Bash(qsv *) Bash(flock *)`, `argument-hint: [shift-name]`, and body that scaffolds the shift directory structure (uses `$ARGUMENTS`)
- [ ] 3.2 Create `templates/claude/skills/nightshift-create/scripts/init-shift.sh` (POSIX, mode 0755) that creates `.nightshift/<name>/{manager.md,table.csv}` with default content
- [ ] 3.3 Create `templates/claude/skills/nightshift-add-task/SKILL.md` with task-creation flow (interactive metadata gathering via `AskUserQuestion`)
- [ ] 3.4 Create `templates/claude/skills/nightshift-update-table/SKILL.md` with row-add/metadata-edit/reset flow
- [ ] 3.5 Create `templates/claude/skills/nightshift-start/SKILL.md` with frontmatter `disable-model-invocation: true`, `allowed-tools: Bash(qsv *) Bash(flock *)`, `context: fork`, `agent: nightshift-manager`
- [ ] 3.6 Author the start skill body to inline pre-flight counts via `` !`flock -x ${SHIFT_TABLE} qsv ...` `` blocks for total/done/failed/todo per task
- [ ] 3.7 Create `templates/claude/skills/nightshift-start/scripts/preflight.sh` that emits a JSON-formatted pre-flight summary for use in skill body when injection isn't sufficient
- [ ] 3.8 Create `templates/claude/skills/nightshift-test-task/SKILL.md` with read-only execution flow (must NOT mutate `table.csv` or `manager.md`)
- [ ] 3.9 Create `templates/claude/skills/nightshift-archive/SKILL.md` with archive flow including `AskUserQuestion` confirmation for incomplete shifts
- [ ] 3.10 Create `templates/claude/skills/nightshift-archive/scripts/archive.sh` that atomically moves the shift directory to `.nightshift/archive/<YYYY-MM-DD>-<name>/`
- [ ] 3.11 Verify every `SKILL.md` body uses `${CLAUDE_SKILL_DIR}/scripts/...` (never relative or absolute paths) when invoking bundled scripts
- [ ] 3.12 Verify every `SKILL.md` body is under 500 lines (Skills best-practice cap)

## 4. Claude Project File Templates

- [ ] 4.1 Create `templates/claude/CLAUDE.md` with Nightshift-managed section wrapped in `<!-- nightshift:start -->` and `<!-- nightshift:end -->` markers
- [ ] 4.2 Create `templates/claude/settings.json` skeleton with `permissions.allow` containing `Bash(qsv *)` and `Bash(flock *)`

## 5. Scaffolder Refactor

- [ ] 5.1 Add a `Target` type (`"claude" | "opencode" | "both"`) and a `resolveTarget(targetDir, flag)` helper to `src/core/scaffolder.ts`
- [ ] 5.2 Update `scaffoldDirectories(targetDir, target)` to create directories appropriate to the target (preserving existing behavior when target is `opencode`)
- [ ] 5.3 Update `writeAgentFiles({ targetDir, target })` so that when target includes `opencode`, it writes to `.opencode/agent/` from `templates/opencode/agents/`, and when target includes `claude`, it writes to `.claude/agents/` from `templates/claude/agents/`
- [ ] 5.4 Replace `writeCommandFiles` with two functions: `writeOpenCodeCommandFiles` (existing behavior) and `writeClaudeSkillFiles` (writes per-skill directories with `SKILL.md` and bundled `scripts/`, marking scripts mode 0755)
- [ ] 5.5 Add `writeClaudeSettingsFile({ targetDir })` that creates or merges `.claude/settings.json` with idempotent `permissions.allow` entries; abort with clear error on malformed JSON
- [ ] 5.6 Add `writeClaudeMdFile({ targetDir })` that creates `CLAUDE.md` or replaces only the marked Nightshift section (with append-and-warn fallback when markers absent)
- [ ] 5.7 Update `writeGitignoreFile` to remain target-agnostic (it writes to `.nightshift/` only)

## 6. CLI Surface Updates

- [ ] 6.1 Add `-t, --target <value>` option to `init` command in `src/cli/commands/init.ts` with `choices(["claude", "opencode", "both"])`
- [ ] 6.2 Implement auto-detection logic: inspect `.claude/` and `.opencode/` existence in CWD, fall back to `both` for greenfield projects
- [ ] 6.3 Print which target was selected (auto-detected vs explicit) at the start of init output
- [ ] 6.4 Update first-run/re-run detection to check `.opencode/agent/nightshift-manager.md` for OpenCode and `.claude/agents/nightshift-manager.md` for Claude based on effective target
- [ ] 6.5 Branch the install steps by target: when `target` includes `opencode`, run `writeAgentFiles` + `writeOpenCodeCommandFiles`; when target includes `claude`, run `writeAgentFiles` (Claude variant) + `writeClaudeSkillFiles` + `writeClaudeSettingsFile` + `writeClaudeMdFile`
- [ ] 6.6 Add a duplicate-install detection step that warns when a Claude plugin install is also present (heuristic: detect a Nightshift plugin marker in user-level Claude settings if accessible, or rely on a runtime-flagged warning when skill name collisions are detected)
- [ ] 6.7 Update the summary output to list files for each effective target and to tailor the "Next Steps" section per target (Claude install includes a "restart Claude Code" note for first-run)

## 7. Plugin Distribution

- [ ] 7.1 Add `.claude-plugin/plugin.json` at the repo root with `name: "nightshift"`, version (read from package.json), description, author, and `agents: "agents"`, `skills: "skills"` fields
- [ ] 7.2 Update `build.js` to materialize root-level `agents/` and `skills/` directories from `templates/claude/agents/` and `templates/claude/skills/` (copy, not symlink, in published output)
- [ ] 7.3 Update `package.json` `files` field to include `.claude-plugin/`, `agents/`, and `skills/` so the plugin manifest and bundled artifacts ship with the npm package
- [ ] 7.4 Add a build-step verification (in `build.js` or a separate npm script) that fails if any skill directory is missing a `SKILL.md` or any script is non-executable

## 8. Tests

- [ ] 8.1 Extend `test/run-tests.ts` to cover `nightshift init --target=opencode` (regression — must produce only `.opencode/` and `.nightshift/`)
- [ ] 8.2 Add test case for `nightshift init --target=claude` asserting directory layout (`.claude/agents/`, `.claude/skills/nightshift-*/SKILL.md`, `.claude/settings.json`, `CLAUDE.md`)
- [ ] 8.3 Add test case for `nightshift init --target=both` asserting both trees are written
- [ ] 8.4 Add test case for auto-detection: prepare a fixture with only `.claude/`, run `nightshift init`, assert only `.claude/` is updated
- [ ] 8.5 Add test case asserting every Claude `SKILL.md` contains `disable-model-invocation: true` and `Bash(qsv *)` `Bash(flock *)` in `allowed-tools`
- [ ] 8.6 Add test case asserting `nightshift-start/SKILL.md` contains `context: fork` and `agent: nightshift-manager`
- [ ] 8.7 Add test case asserting Claude `nightshift-manager.md` body is under 20,000 characters
- [ ] 8.8 Add test case for settings.json idempotency (run init twice, assert no duplicate entries)
- [ ] 8.9 Add test case for settings.json merge: pre-create a file with user-authored content, run init, assert preservation + addition
- [ ] 8.10 Add test case for malformed settings.json: pre-create invalid JSON, run init, assert non-zero exit and unchanged file
- [ ] 8.11 Add test case for CLAUDE.md marker-based replacement (idempotent re-runs)
- [ ] 8.12 Add test case for CLAUDE.md append-and-warn when markers absent
- [ ] 8.13 Add a parity check: extract prose body from the OpenCode and Claude manager templates (strip frontmatter and runtime-specific tool-name strings) and assert they match modulo a small allowlist of substitutions
- [ ] 8.14 Add a benchmark entry for `nightshift init --target=claude` runtime in `test/benchmarks.json`

## 9. Documentation

- [ ] 9.1 Add a "Claude Code" section to `README.md` parallel to the existing OpenCode quick start, including install instructions, `nightshift init --target=claude`, plugin alternative, and CLAUDE.md mention
- [ ] 9.2 Document the `--target` flag in README, including auto-detection rules
- [ ] 9.3 Update `AGENTS.md` to describe the dual-target template layout under Repository Structure
- [ ] 9.4 Add a Playwright configuration note to README explaining how to enable the commented MCP block in `.claude/agents/nightshift-dev.md`
- [ ] 9.5 Update `CHANGELOG.md` with the change
- [ ] 9.6 Update `cliff.toml` if needed to ensure changelog generation captures this change

## 10. Release Validation

- [ ] 10.1 Run `pnpm test` — all targets pass
- [ ] 10.2 Run `pnpm run build` — verify `dist/`, plugin manifest, and bundled `agents/`/`skills/` are all produced
- [ ] 10.3 Manually `npm pack` the package and inspect the tarball contents to confirm `.claude-plugin/`, `agents/`, `skills/`, `templates/opencode/`, and `templates/claude/` are all present and `src/`/tests are absent
- [ ] 10.4 Run `nightshift init --target=claude` in a fresh scratch directory under Claude Code and execute a small two-item shift end-to-end to confirm parity with the OpenCode flow
- [ ] 10.5 Run `nightshift init --target=opencode` in a fresh scratch directory under OpenCode and confirm no regression
- [ ] 10.6 Run `openspec validate add-claude-code-target --strict` and confirm pass
- [ ] 10.7 Bump version in `package.json` (minor bump — additive feature) and tag the release per existing auto-release workflow
