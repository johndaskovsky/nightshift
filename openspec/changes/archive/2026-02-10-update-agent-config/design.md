## Context

Nightshift agent configuration currently lives in two places: YAML frontmatter in `templates/agents/*.md` and the `"agent"` block in `templates/opencode.jsonc`. Both declare identical description, mode, tools, and permissions for the three agents. OpenCode reads agent config from markdown frontmatter in `.opencode/agent/` files — the JSONC agent block is redundant.

The installer (`nightshift init` / `nightshift update`) syncs both independently:
- `writeAgentFiles()` copies markdown templates to `.opencode/agent/`
- `mergeOpencodeConfig()` merges the `"agent"` block into target `opencode.jsonc`

The `config-merger.ts` module contains ~80 lines dedicated to extracting agent entries from the template JSONC, checking for existing agent blocks, and performing per-key merges — all for data that is already delivered via the markdown files.

Beyond agents, the remaining global permissions in `opencode.jsonc` (bash allowlist, edit/webfetch permissions) are OpenCode project-level configuration that users should own directly. Nightshift should not manage `opencode.jsonc` at all.

## Goals / Non-Goals

**Goals:**

- Delete the `opencode.jsonc` template entirely — Nightshift does not ship or manage any JSONC config
- Delete `config-merger.ts` and its test file
- Remove the `jsonc-parser` dependency
- Remove all `mergeOpencodeConfig` calls from init/update commands and public exports
- Update `nightshift-agents` and `nightshift-installer` specs to reflect that agent definitions live exclusively in markdown files and `opencode.jsonc` is not managed

**Non-Goals:**

- Changing agent behavior or permissions (those were addressed in `add-parallel-execution`)
- Modifying the markdown agent file format or frontmatter schema
- Changing the `writeAgentFiles()` or `writeCommandFiles()` scaffolder logic
- Adding new CLI commands or flags
- Providing migration tooling for existing users (breaking change accepted)

## Decisions

### Decision 1: Delete opencode.jsonc template entirely

**Choice:** Delete `templates/opencode.jsonc`. Nightshift no longer ships or manages any `opencode.jsonc` configuration.

**Rationale:** OpenCode reads agent config from markdown frontmatter. Global permissions (bash allowlist, edit, webfetch) are project-level settings users should configure themselves. There is no Nightshift-specific config that needs to live in `opencode.jsonc`.

**Alternative considered:** Keep the template with only global permissions. Rejected because these permissions are not Nightshift-specific — they are general OpenCode project settings that vary per project.

### Decision 2: Delete config-merger.ts entirely

**Choice:** Delete `src/core/config-merger.ts` and `test/config-merger.test.ts`. Remove the `mergeOpencodeConfig` export from `src/index.ts`. Remove the `jsonc-parser` dependency from `package.json`.

**Rationale:** With no `opencode.jsonc` template to merge, the entire module is unnecessary. The `jsonc-parser` dependency was used exclusively by this module.

### Decision 3: Remove merge step from init and update commands

**Choice:** Remove Step 4 (merge opencode.jsonc) from `init.ts` and the re-merge step from `update.ts`. These commands now only scaffold directories, write agent files, and write command files.

**Rationale:** There is nothing left to merge. The commands become simpler and faster.

### Decision 4: No changes needed to agent markdown frontmatter for parallel execution

**Assessment:** The manager agent's frontmatter already declares `task: true` in its tools, which is what enables concurrent Task tool calls for parallel batch dispatch. The `permission.task` block already scopes delegation to `nightshift-dev` and `nightshift-qa` only. No frontmatter changes are needed.

**Verified:**
- Manager: `task: true` (enables Task tool for concurrent dispatch) -- correct
- Manager: `permission.task` restricts to dev/qa -- correct
- Dev: `task: false` (cannot delegate) -- correct
- QA: `task: false` (cannot delegate) -- correct
- Dev: `playwright_*: true` (MCP tool access) -- correct
- QA: `write: false, edit: false` (read-only) -- correct

## Risks / Trade-offs

- **[Risk] Breaking change for existing users** -- Users who previously ran `nightshift init` will have `opencode.jsonc` entries from the old template. Running `nightshift update` will no longer touch `opencode.jsonc`, leaving stale entries. This is acceptable: stale agent entries in JSONC alongside markdown agent files may cause duplicate definitions, but users can clean up manually. No migration tooling is provided.

- **[Risk] Users lose global permission defaults** -- The template previously set `edit: "allow"`, `webfetch: "allow"`, and a bash allowlist. Users who relied on `nightshift init` to configure these will need to set them manually. This is acceptable because these are OpenCode project settings, not Nightshift-specific config.
