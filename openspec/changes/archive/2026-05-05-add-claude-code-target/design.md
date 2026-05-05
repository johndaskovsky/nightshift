## Context

Nightshift's installer (`src/cli/commands/init.ts`) and scaffolder (`src/core/scaffolder.ts`) hardcode OpenCode-specific paths (`.opencode/agents/`, `.opencode/commands/`) and template names (`templates/agents/`, `templates/commands/`). Templates use OpenCode subagent frontmatter (`mode: subagent`, `permission.bash`, `permission.task`, `playwright_*: true`) and OpenCode slash command frontmatter (`description` only).

Claude Code expresses the same primitives differently:

- **Subagents** live at `.claude/agents/<name>.md` with frontmatter fields `name`, `description`, `tools`, `disallowedTools`, `model`, `mcpServers`, `hooks`, `skills`, `permissionMode`, `memory`, `isolation`, `color`. Tool restriction uses an allowlist (`tools: Read, Grep, Bash`) plus optional `Agent(<subagent>)` syntax to scope which subagents can be spawned. There is no per-agent `bash: { qsv*: allow }` field — bash sub-command pre-approval is project-wide via `.claude/settings.json`'s `permissions.allow` array, or per-skill via `allowed-tools` while the skill is active.
- **Slash commands** are subsumed by **Skills** (`.claude/skills/<name>/SKILL.md`). Per the Claude Code docs: "Custom commands have been merged into skills." Skills add per-skill `allowed-tools`, `disable-model-invocation`, `user-invocable`, `context: fork`, `agent`, dynamic shell injection via `` !`<cmd>` ``, `${CLAUDE_SKILL_DIR}` variable, named arguments, and bundled supporting files.
- **Plugins** package agents + skills + settings into a single distributable unit, discovered automatically by Claude Code.

The two surfaces are similar enough that the manager/dev orchestration logic is portable verbatim, but the frontmatter, scaffold paths, and a handful of idioms differ enough that a single rendered template would be brittle. We chose split templates with full duplication so each runtime's files are debuggable in isolation.

The Claude Code Skills best-practices doc (`platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices`) emphasizes: keep `SKILL.md` under 500 lines, references one level deep, prefer scripts for deterministic operations, write descriptions in third person with explicit triggers, and use `disable-model-invocation: true` for side-effecting workflows.

## Goals / Non-Goals

**Goals:**

- Install Nightshift cleanly into Claude Code projects with zero manual file edits.
- Use Claude-native idioms (Skills, subagent frontmatter, plugin manifest, `context: fork`, dynamic context injection, `${CLAUDE_SKILL_DIR}`) rather than emulating OpenCode patterns.
- Preserve 100% backward compatibility for existing OpenCode users — re-running `nightshift init` in an OpenCode project must produce no Claude Code artifacts.
- Allow auto-detection so users running `nightshift init` in projects that already have `.claude/` get Claude scaffolding by default.
- Keep the manager/dev orchestration semantics identical across runtimes — a shift behaves the same regardless of where it runs.
- Distribute via the existing npm package and as a Claude Code Plugin, so users can pick their install pathway.

**Non-Goals:**

- A shared/rendered template layer that emits both runtimes from one source. The two trees diverge by design.
- Automatic Playwright (or any other MCP) installation. Users configure their own MCP servers.
- A migration tool from OpenCode → Claude Code. The targets coexist.
- Changing OpenCode behavior beyond moving its templates under `templates/opencode/`.
- Redesigning the manager/dev contract, retry logic, parallel execution, or self-improvement loop.

## Decisions

### Decision: Split template trees, no shared rendering

`templates/opencode/{agents,commands}/` and `templates/claude/{agents,skills}/` each hold complete, runtime-specific files. Bodies will be ~85% the same prose; frontmatter, file extensions (`SKILL.md` vs flat `.md`), directory shape (one-file-per-skill in a subdir vs flat), and a handful of idioms will differ.

**Why X over Y:**

- **Considered**: Single template tree with a renderer that injects per-runtime frontmatter and rewrites tool names.
- **Rejected because**: A renderer adds a build-time DSL or templating dependency, makes diffs harder to read, and obscures the actual files Claude/OpenCode load. Drift between runtimes is real but tolerable when the framework is small (8 files per runtime). When semantics genuinely diverge (e.g., the start command becomes one line of frontmatter under Claude via `context: fork`), a renderer would force a lowest-common-denominator design.
- **Trade-off accepted**: Two copies of orchestration prose to keep in sync. Mitigation: the manager/dev system prompts are the most-likely-to-drift surface; we'll keep them as identical as possible and add a test that diffs the prose-equivalent sections after stripping frontmatter.

### Decision: Six skills, all `disable-model-invocation: true`

Every Nightshift "command" mutates state (creates directories, modifies CSV, kicks off long batches). The Skills docs explicitly call out this class of workflow as belonging in `disable-model-invocation: true`. Users explicitly type `/nightshift-create my-job`; Claude does not auto-invoke shifts based on conversation context.

**Side benefit**: descriptions of disabled-invocation skills are removed from the per-session context budget, so the user's `/` menu still discovers them but Claude doesn't pay token cost on every turn.

**Considered**: leaving model invocation enabled with carefully-scoped descriptions. **Rejected because**: false-positive auto-invocations (Claude deciding to start a shift because the user asked about progress) are higher-stakes than false negatives (the user has to type the command).

### Decision: `/nightshift-start` uses `context: fork` + `agent: nightshift-manager`

The current OpenCode start command is mostly prose telling Claude to "use the Task tool to invoke the nightshift-manager subagent." Under Claude Code, `context: fork` + `agent: nightshift-manager` declares this in frontmatter — the skill body becomes the manager's task prompt directly.

```yaml
---
name: nightshift-start
description: Start or resume execution of a Nightshift shift
disable-model-invocation: true
context: fork
agent: nightshift-manager
allowed-tools: Bash(qsv *) Bash(flock *)
---

Run shift "$ARGUMENTS".

## Pre-flight summary
- Total items: !`flock -x .nightshift/$ARGUMENTS/table.csv qsv count .nightshift/$ARGUMENTS/table.csv`
- ...

Read manager.md for task order. Process all remaining items.
```

**Why**: removes a class of "Claude forgot to delegate" bugs and shrinks the skill to roughly half its OpenCode equivalent. The pre-flight summary numbers are inlined by the harness before the manager subagent ever sees the prompt — one fewer round trip.

**Trade-off**: if a user wants to inspect or alter pre-flight state interactively before the manager runs, they can't (the fork starts immediately). Acceptable: that flow is what `/nightshift-test-task` is for.

### Decision: `allowed-tools: Bash(qsv *) Bash(flock *)` per skill, plus settings.json fallback

Each skill that runs CSV ops sets `allowed-tools` to pre-approve qsv and flock invocations *while the skill is active*. The scaffolder also writes (or merges into) `.claude/settings.json` a project-wide `permissions.allow` list with the same patterns, so the dev and manager subagents — which run outside skill scope — also avoid prompts.

**Why both**: per-skill is precise (the trust is scoped to the workflow). Project-wide is necessary because subagents execute via the Agent tool, not as skill content, and don't inherit skill `allowed-tools`. Both are needed for a friction-free experience.

### Decision: Bundled `scripts/` per skill, paths via `${CLAUDE_SKILL_DIR}`

The Skills best-practices doc strongly recommends scripts over prose-driven CLI invocations for deterministic operations. Nightshift's qsv calls (especially with `--exact`, `--invert-match`, column selection, and 0-based indexing) are exactly this — Claude regularly miswrites them.

Each skill that needs CSV ops bundles helper scripts:

- `nightshift-start/scripts/preflight.sh <shift-name>` — emits JSON of total/done/failed/todo counts per task.
- `nightshift-create/scripts/init-shift.sh <shift-name>` — creates directory structure and base files.
- `nightshift-archive/scripts/archive.sh <shift-name>` — atomically moves into `archive/YYYY-MM-DD-<name>/`.
- etc.

Skills reference scripts via `${CLAUDE_SKILL_DIR}/scripts/<name>.sh` so paths resolve regardless of whether the skill is installed at user, project, or plugin scope. Scripts are POSIX sh, bundle no dependencies beyond qsv/flock/standard utils.

**Considered**: leaving CSV ops as inline prose for parity with OpenCode. **Rejected because**: scripts trade a tiny bit of duplication for a huge reliability win; tokens saved by not loading qsv reference tables in every skill body more than offset.

### Decision: Document Playwright as a user-configured MCP server

The dev subagent does NOT inline `mcpServers: [playwright]`. The subagent template includes a comment showing the inline definition users can paste in if they want Playwright scoped to dev only:

```yaml
# To enable Playwright in this subagent, add:
# mcpServers:
#   - playwright:
#       type: stdio
#       command: npx
#       args: ["-y", "@playwright/mcp@latest"]
```

**Why**: not all shifts use Playwright, and bundling an `npx` invocation in a checked-in subagent file pulls users into a dependency they may not want. Documentation + commented-out example strikes the right balance between discoverability and respect for user choice.

### Decision: CLI flag `--target` with auto-detect default

```
nightshift init                       # auto-detect
nightshift init --target=claude       # write only .claude/
nightshift init --target=opencode     # write only .opencode/
nightshift init --target=both         # write both
```

Auto-detect rules (in order):

1. If `.claude/` exists and `.opencode/` does not → `claude`.
2. If `.opencode/` exists and `.claude/` does not → `opencode`.
3. If both exist → `both` (re-runs already-installed projects keep both targets fresh).
4. If neither exists → `both` (greenfield projects get both surfaces, since users on either harness can pick).

**Considered**: defaulting greenfield projects to `claude` only (since Claude Code is the more recently maintained surface). **Rejected because**: existing OpenCode users running `init` in a fresh project would silently lose OpenCode support without an explicit opt-in. `both` is conservative; users can pin to one with the flag.

The flag is also accepted as `nightshift init -t claude` (short form) for ergonomics.

### Decision: Distribute as both npm CLI and Claude Code Plugin

The npm package gains a `.claude-plugin/plugin.json` manifest at the package root, and the `files` entry in `package.json` includes it. Users on Claude Code can install via plugin discovery without ever running `nightshift init`. Users on OpenCode (or who prefer the CLI flow) keep the existing npm install + `nightshift init` path.

The plugin manifest:

```json
{
  "name": "nightshift",
  "version": "1.0.x",
  "description": "Long-running unsupervised batch agent framework",
  "author": "johndaskovsky",
  "agents": "agents",
  "skills": "skills"
}
```

The plugin's `agents/` and `skills/` directories are copies of `templates/claude/agents/` and `templates/claude/skills/` (or symlinks during development; copies in published artifact). A small build step (or addition to `build.js`) materializes them on `pnpm run build`.

**Considered**: shipping the plugin as a separate npm/git repo. **Rejected because**: keeps versioning unified; one PR updates both pathways; the same `templates/claude/` source drives both.

### Decision: Subagent template uses Claude-native frontmatter, semantic prose unchanged

The Claude `nightshift-manager.md`:

```yaml
---
name: nightshift-manager
description: Orchestrate a Nightshift shift — read manager.md and table.csv, delegate items to dev agent, update status. Use when the user runs /nightshift-start.
tools: Agent(nightshift-dev), Read, Write, Edit, Bash, Glob, Grep
model: sonnet
---
```

`tools: Agent(nightshift-dev)` is the Claude Code idiom for "this subagent can spawn nightshift-dev and no other subagent." This replaces OpenCode's `permission.task: { nightshift-dev: allow, "*": deny }`.

The body — orchestration logic, qsv command tables, state machine, parallel batching algorithm, self-improvement loop — stays prose-equivalent to the OpenCode version. Where the OpenCode prose says "use the Task tool," the Claude prose says "spawn a `nightshift-dev` subagent."

The `nightshift-dev.md` mirror has `tools: Read, Write, Edit, Bash, Glob, Grep` (no `Agent` — dev cannot spawn subagents) plus a documented (commented) `mcpServers` block.

### Decision: New CLAUDE.md template scaffolded into Claude installs

When the target includes Claude, init writes a `CLAUDE.md` to the project root (or merges with existing) describing:

- That Nightshift agents and skills are present.
- Project conventions (kebab-case shifts, snake_case task names, qsv requirements).
- Pointers to `/nightshift-create`, etc.

This parallels the existing `AGENTS.md` for OpenCode. Both files coexist when target is `both`.

**Merge behavior**: if `CLAUDE.md` already exists, the installer detects a `<!-- nightshift-managed-section -->` marker and replaces only that section, preserving the user's surrounding content. If the marker is absent, the installer appends the section (and its markers) to the end of the file. Same approach is used for `.claude/settings.json`.

## Risks / Trade-offs

- **[Skill content lifecycle vs. long shifts]** → Mitigation: the Skills doc warns that invoked skills enter context once and aren't re-read on later turns; auto-compaction re-attaches up to 5K tokens of each invoked skill (combined budget 25K). The current `nightshift-manager.md` is ~340 lines / ~3K tokens, comfortably within the 5K re-attach budget. We'll add a test that lints the Claude manager skill stays under that threshold.

- **[Drift between OpenCode and Claude prose]** → Mitigation: a snapshot test in `test/run-tests.ts` extracts the prose body (excluding frontmatter and runtime-specific tool-name strings) of each pair of agent/command files and asserts they're identical modulo a small allowlist of substitutions (e.g., `Task tool` ↔ `spawn a subagent`). Catches accidental divergence at PR time.

- **[Plugin vs. CLI install collisions]** → Mitigation: a user could install the plugin AND run `nightshift init --target=claude` in the same project, producing duplicate skills (one set in `<plugin>/skills/`, one in `.claude/skills/`). Claude Code's precedence rules say project skills override personal which override plugin, so the local copy wins. Document this in README and have init detect and warn if both pathways are present.

- **[`disable-model-invocation: true` removes auto-discovery]** → Mitigation: every skill description begins with the explicit invocation form ("Use `/nightshift-start <name>` to..."). Users who don't know about the framework won't have Claude proactively suggest it, but that's the same behavior as OpenCode slash commands today.

- **[settings.json merge complexity]** → Mitigation: settings.json may have user-authored `permissions.allow` entries we shouldn't overwrite. Init reads the existing file, parses JSON, ensures `Bash(qsv *)` and `Bash(flock *)` are present in `permissions.allow` (idempotent), and writes back with stable key order. If the file is malformed JSON, init aborts with a clear error rather than overwriting.

- **[Live change detection edge case]** → Mitigation: per the Skills doc, "Creating a top-level skills directory that did not exist when the session started requires restarting Claude Code." First-time init in a project with no prior `.claude/skills/` requires a session restart for skills to load. The init command's "Next Steps" output explicitly tells users to restart Claude Code if it was already running.

- **[CLAUDE.md merge ambiguity]** → Mitigation: marker-based section replacement is safer than full overwrite but breaks if a user accidentally deletes the markers. The installer falls back to "append a fresh section" in that case rather than failing, and prints a warning so the user can manually de-duplicate.
