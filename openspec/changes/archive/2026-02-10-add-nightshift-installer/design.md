## Context

Nightshift is a batch processing framework for AI agents that runs inside OpenCode. It consists of Markdown-based agent definitions, slash commands, and shift data files -- no traditional source code. Currently, "installation" means cloning the `night-shift` repository and manually copying files into the right directories. There is no way to add Nightshift to an existing project.

OpenSpec (the spec framework Nightshift already uses) solves this same problem with an npm-distributed CLI: `npm install -g @fission-ai/openspec` followed by `openspec init` in a target project. The `init` command scaffolds directories, detects which AI tools the user has, and generates tool-specific skill and command files. An `openspec update` command regenerates those files after CLI upgrades.

Nightshift's installer should follow this pattern closely, adapted for its simpler scope (OpenCode-only, three agents, six commands, no multi-tool detection needed).

### Current file inventory that would become generated output

| File | Purpose | Currently committed |
|------|---------|-------------------|
| `.opencode/agent/nightshift-manager.md` | Manager agent instructions | Yes |
| `.opencode/agent/nightshift-dev.md` | Dev agent instructions | Yes |
| `.opencode/agent/nightshift-qa.md` | QA agent instructions | Yes |
| `.opencode/command/nightshift-create.md` | Create shift command | Yes |
| `.opencode/command/nightshift-start.md` | Start shift command | Yes |
| `.opencode/command/nightshift-archive.md` | Archive shift command | Yes |
| `.opencode/command/nightshift-add-task.md` | Add task command | Yes |
| `.opencode/command/nightshift-test-task.md` | Test task command | Yes |
| `.opencode/command/nightshift-update-table.md` | Update table command | Yes |
| `opencode.jsonc` | Agent permissions config | Yes (needs merge, not overwrite) |
| `.nightshift/archive/.gitkeep` | Archive directory placeholder | Yes |

## Goals / Non-Goals

**Goals:**

- A user can run `npm install -g @johndaskovsky/nightshift` (or equivalent) to get the `nightshift` CLI
- `nightshift init` in any OpenCode project scaffolds the full Nightshift framework: directories, agent files, command files, and `opencode.jsonc` agent block
- `nightshift update` regenerates agent and command files from the CLI's bundled templates without losing user customizations in `opencode.jsonc`
- The CLI is a TypeScript project compiled to ESM JavaScript, distributed via npm
- Non-interactive mode for scripted/CI setup
- The existing `night-shift` repository continues to work as-is (backward compatible)

**Non-Goals:**

- Multi-tool support (Nightshift is OpenCode-only, unlike OpenSpec's 20+ tool adapters)
- Plugin system or schema customization (Nightshift has a fixed three-agent architecture)
- Shell completions or telemetry (keep it minimal for v1)
- GUI or web dashboard
- Publishing to npm under the `@fission-ai` scope (this is a personal/independent project)

## Decisions

### Decision 1: TypeScript CLI with commander, matching OpenSpec's stack

Use TypeScript compiled to ESM JavaScript with `commander` for argument parsing, `chalk` for terminal colors, and `ora` for spinners. This mirrors OpenSpec's exact stack, making the codebases feel consistent.

**Alternatives considered:**
- Plain JavaScript (no compile step) -- rejected because TypeScript catches errors at build time and the OpenSpec model works well
- Bun-native binary -- rejected because npm distribution is the standard pattern and Bun isn't universally installed

### Decision 2: Templates bundled in the npm package, not fetched remotely

Agent `.md` files and command `.md` files are bundled inside the npm package under a `templates/` directory (included via `package.json` `"files"`). The `init` and `update` commands read from these bundled templates and write them to the target project.

**Alternatives considered:**
- Fetch templates from GitHub at install time -- rejected because it adds a network dependency and versioning complexity
- Embed templates as string literals in TypeScript -- rejected because Markdown files are easier to maintain as separate files

### Decision 3: Merge strategy for opencode.jsonc

The `init` command must handle `opencode.jsonc` carefully because users may have their own agent definitions, MCP servers, and permission overrides. Strategy:

1. If `opencode.jsonc` does not exist: create it with the full Nightshift config
2. If it exists: parse the JSONC, merge only the `agent` block (add/update `nightshift-manager`, `nightshift-dev`, `nightshift-qa`), preserve all other keys (`mcp`, `permission`, user-defined agents)
3. On `update`: re-merge the agent block only, preserving user additions

This requires a JSONC parser that preserves comments. Use a lightweight approach: read the file, find the `"agent"` block, and perform a targeted merge rather than a full parse-serialize cycle that would strip comments.

**Alternatives considered:**
- Overwrite `opencode.jsonc` entirely -- rejected because it destroys user customization
- Separate Nightshift config file -- rejected because OpenCode reads a single `opencode.jsonc`
- Instruct users to manually add the agent block -- rejected because it defeats the purpose of an installer

### Decision 4: Package name and scope

Use `@johndaskovsky/nightshift` as the npm package name (scoped to the author's npm account). The CLI binary name is `nightshift`.

**Alternatives considered:**
- Unscoped `nightshift` -- likely taken on npm and harder to claim
- `@nightshift/cli` -- requires creating an npm org

### Decision 5: Project structure mirrors OpenSpec

```
nightshift/                     # Repository root (renamed or new repo)
├── bin/nightshift.js           # CLI entry point (imports dist/)
├── src/                        # TypeScript source
│   ├── cli/
│   │   ├── index.ts            # Commander setup, registers commands
│   │   └── commands/
│   │       ├── init.ts         # nightshift init implementation
│   │       └── update.ts       # nightshift update implementation
│   ├── core/
│   │   ├── scaffolder.ts       # Directory/file creation logic
│   │   ├── config-merger.ts    # opencode.jsonc merge logic
│   │   └── templates.ts        # Template resolution (find bundled templates)
│   └── index.ts                # Public API exports
├── templates/                  # Bundled Markdown templates
│   ├── agents/
│   │   ├── nightshift-manager.md
│   │   ├── nightshift-dev.md
│   │   └── nightshift-qa.md
│   ├── commands/
│   │   ├── nightshift-create.md
│   │   ├── nightshift-start.md
│   │   ├── nightshift-archive.md
│   │   ├── nightshift-add-task.md
│   │   ├── nightshift-test-task.md
│   │   └── nightshift-update-table.md
│   └── opencode.jsonc          # Default opencode.jsonc with agent block
├── dist/                       # Compiled output (gitignored)
├── package.json
├── tsconfig.json
└── build.js                    # Build script (like OpenSpec's)
```

### Decision 6: Update is idempotent and safe

`nightshift update` overwrites agent and command files unconditionally (these are framework files, not user-authored). It re-merges the `opencode.jsonc` agent block. It does NOT touch:
- `.nightshift/` (shift data)
- `opencode.jsonc` keys outside the three Nightshift agent entries
- Any user-added commands or agents in `.opencode/`

## Risks / Trade-offs

- **[JSONC merge complexity]** Merging into `opencode.jsonc` while preserving comments and formatting is non-trivial. There is no standard JSONC library that round-trips comments perfectly. -> Mitigation: Use `jsonc-parser` from VS Code which handles comments via edit operations rather than full parse-serialize cycles.

- **[Template drift]** If a user manually edits a generated agent file and then runs `nightshift update`, their changes are overwritten. -> Mitigation: Document this clearly. Agent/command files are framework-managed. Users who need custom behavior should modify `opencode.jsonc` permissions (which are preserved) rather than editing agent Markdown directly.

- **[Package naming]** The name `nightshift` may conflict with existing npm packages. -> Mitigation: Use scoped package name `@johndaskovsky/nightshift`.

- **[Separate repo question]** The CLI source could live in the existing `night-shift` repo or a new dedicated repo. -> Mitigation: Start in the existing repo. The `templates/` directory can be populated from the current committed files. If the project grows, extract to a separate repo later.

## Migration Plan

1. Move existing `.opencode/agent/nightshift-*.md` and `.opencode/command/nightshift-*.md` files into `templates/`
2. Build the CLI source in `src/` and `bin/`
3. Test `nightshift init` against a fresh directory to verify scaffolding
4. Test `nightshift update` against the current `night-shift` repo to verify it produces identical files
5. Publish to npm as `@johndaskovsky/nightshift`
6. Update the repository README with new installation instructions
7. Update `.gitignore` to ignore generated agent/command files in target projects (but keep them committed in the Nightshift repo itself for development)

## Open Questions

- Should `nightshift init` also scaffold an initial `openspec/` directory with Nightshift specs, or should that remain a separate `openspec init` concern?
- Should the CLI include a `nightshift version` command, or is `nightshift --version` (built into commander) sufficient?
