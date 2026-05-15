## Why

Nightshift today only installs into [OpenCode](https://opencode.ai/). Claude Code has become a first-class agent harness with native primitives — Skills (`.claude/skills/<name>/SKILL.md`), Subagents (`.claude/agents/<name>.md`), Plugins, dynamic context injection, and `context: fork` delegation — that map cleanly onto Nightshift's manager/dev/command model. Supporting Claude Code lets users adopt Nightshift in their existing Claude Code projects without leaving the tool, and lets the framework exercise idioms (skill-level `disable-model-invocation`, MCP-scoped subagents, `${CLAUDE_SKILL_DIR}`-relative scripts) that aren't expressible in OpenCode.

This is an **additive port**, not a migration: OpenCode remains a fully supported target.

## What Changes

- **CLI**: Add `nightshift init --target=<claude|opencode|both>` flag. Default behavior auto-detects existing `.opencode/` or `.claude/` directories; if neither exists, scaffolds `both`.
- **Templates**: Move existing files under `templates/opencode/{agents,commands}/`. Add `templates/claude/{agents,skills}/` with Claude-native versions of all six commands and both agents.
- **Claude agent templates**: Two subagent definition files (`nightshift-manager.md`, `nightshift-dev.md`) using Claude Code subagent frontmatter (`name`, `description`, `tools`, `model`, `mcpServers`, optional `hooks`). Manager declares `tools: Agent(nightshift-dev), Read, Write, Edit, Bash, Glob, Grep`.
- **Claude command templates as Skills**: Six skill directories (`nightshift-{create,add-task,update-table,start,test-task,archive}/SKILL.md`) plus bundled `scripts/` directories for deterministic CSV operations.
- **Skill conventions** (applied to all six):
  - `disable-model-invocation: true` (these are side-effecting workflows; matches the docs' `/deploy`-class guidance and removes descriptions from the per-session context budget)
  - `allowed-tools: Bash(qsv *) Bash(flock *)` to pre-approve CSV ops while the skill is active
  - `$ARGUMENTS` / `$0` substitution for shift-name arguments
  - Live state injected via `` !`flock -x ... qsv ...` `` blocks for pre-flight summaries
  - Bundled scripts referenced via `${CLAUDE_SKILL_DIR}` so paths resolve under personal, project, or plugin install
- **`/nightshift-start` skill**: Uses `context: fork` + `agent: nightshift-manager` to declaratively delegate, replacing the current "use the Task tool to invoke nightshift-manager" prose.
- **Scaffolder**: Init writes `.claude/agents/`, `.claude/skills/<name>/{SKILL.md,scripts/}`, and creates or merges `.claude/settings.json` with project-wide allowlist entries for `Bash(qsv *)` and `Bash(flock *)`.
- **Distribution**: Existing `@johndaskovsky/nightshift` npm package remains. Add a Claude Code Plugin manifest (`.claude-plugin/plugin.json` + bundled `agents/` and `skills/` directories) so the same files install via plugin discovery.
- **Playwright**: Document-only. The Claude dev subagent does NOT inline a Playwright MCP server definition; users configure their own.
- **CLAUDE.md template**: When the target includes Claude, init scaffolds a project-level `CLAUDE.md` describing the agents, skills, and CSV conventions (parallel to the existing AGENTS.md guidance for OpenCode).
- **Tests**: Extend `test/run-tests.ts` to exercise `nightshift init --target=claude` and `--target=both`, asserting directory layout, SKILL.md frontmatter, and scaffolded `settings.json` content.
- **Docs**: README adds a "Claude Code" section parallel to the OpenCode quick start. AGENTS.md updated to describe the dual-target template layout.

## Capabilities

### New Capabilities

- `claude-code-target`: Installation, directory layout, agent format, skill format, plugin distribution, and runtime conventions (dynamic context injection, `context: fork` delegation, MCP server scoping, `${CLAUDE_SKILL_DIR}`) for the Claude Code runtime.

### Modified Capabilities

- `nightshift-installer`: `init` accepts a `--target` flag, auto-detects when omitted, and routes file generation to OpenCode and/or Claude Code directory layouts. The existing OpenCode scaffolding behavior is preserved when `--target=opencode` (or auto-detected).
- `nightshift-commands`: The six command behaviors are unchanged from the user's perspective, but now have a Claude Code surface (Skills) in addition to the OpenCode surface (slash commands). The semantic contract — what each command does — remains identical.
- `nightshift-agents`: The manager and dev agent roles, delegation contract, retry behavior, and self-improvement loop are unchanged. A second runtime expression of these agents exists as Claude Code Subagents alongside the existing OpenCode Subagents.

## Impact

- **Code**:
  - `src/core/scaffolder.ts` — new functions for Claude target (write subagents, skills, settings.json merge); existing functions take a target parameter.
  - `src/core/templates.ts` — resolve template paths under `opencode/` or `claude/` subdirectories.
  - `src/cli/commands/init.ts` — add `--target` option, auto-detection logic, summary output covers both targets.
- **Templates** (file moves + additions):
  - Move: `templates/agents/*` → `templates/opencode/agents/*`, `templates/commands/*` → `templates/opencode/commands/*`.
  - Add: `templates/claude/agents/{nightshift-manager,nightshift-dev}.md`.
  - Add: `templates/claude/skills/nightshift-{create,add-task,update-table,start,test-task,archive}/SKILL.md` plus `scripts/` directories.
  - Add: `templates/claude/CLAUDE.md` and `templates/claude/settings.json` partial.
  - Add: `.claude-plugin/plugin.json` (plugin manifest) — repository-level, distributed via npm `files` entry.
- **Tests**: New cases in `test/run-tests.ts` for `--target=claude`, `--target=both`, and `--target` auto-detection. New benchmark category for Claude target scaffolding.
- **Docs**: README, AGENTS.md, CHANGELOG. New CLAUDE.md template scaffolded into Claude installs.
- **Dependencies**: No new runtime dependencies. `qsv` and `flock` remain prerequisites for both targets.
- **Backward compatibility**: 100% preserved for existing OpenCode users. Re-running `nightshift init` in an OpenCode-only project continues to write only `.opencode/`.
- **Non-goals** (explicitly out of scope):
  - No shared/rendered template layer — the two template trees diverge by design.
  - No automatic Playwright MCP installation.
  - No migration tooling from OpenCode → Claude Code.
  - No changes to OpenCode behavior beyond moving its templates under `templates/opencode/`.
