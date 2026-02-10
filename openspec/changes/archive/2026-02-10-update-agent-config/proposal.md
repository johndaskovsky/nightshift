## Why

Agent configuration is duplicated: the YAML frontmatter in `templates/agents/*.md` and the `"agent"` block in `templates/opencode.jsonc` declare identical description, mode, tools, and permissions for all three Nightshift agents. OpenCode reads agent config from markdown frontmatter directly — the JSONC `"agent"` block is redundant. This duplication creates a maintenance burden (two files to update for every config change) and a divergence risk (one updated, the other forgotten). The `add-parallel-execution` change just modified agent behavior but did not update the JSONC agent block, demonstrating the problem. Additionally, the installer's `config-merger.ts` contains ~100 lines of merge logic solely to sync this redundant block into target projects.

Beyond the agent block, the remaining global permissions in `opencode.jsonc` (bash allowlist, edit/webfetch permissions) are also unnecessary for Nightshift to manage — they are OpenCode project-level configuration that users should own directly. Nightshift should not be in the business of merging or managing `opencode.jsonc` at all.

## What Changes

- **Remove** `templates/opencode.jsonc` entirely — Nightshift no longer ships or manages any `opencode.jsonc` template
- **Remove** `src/core/config-merger.ts` — the entire config merger module and its `mergeOpencodeConfig` function
- **Remove** `test/config-merger.test.ts` — tests for the deleted module
- **Remove** the `jsonc-parser` dependency from `package.json` — no longer needed
- **Remove** `mergeOpencodeConfig` calls from `src/cli/commands/init.ts` and `src/cli/commands/update.ts`
- **Remove** `mergeOpencodeConfig` export from `src/index.ts`
- **Update** the `nightshift-agents` spec to remove the "Agent definitions in opencode.jsonc" requirement — agent definitions live in markdown files only
- **Update** the `nightshift-installer` spec to remove all `opencode.jsonc` merging requirements and references
- **Assess** agent markdown frontmatter for any changes needed to support the `add-parallel-execution` change (e.g., verifying the manager's `task` tool permissions are sufficient for concurrent dispatch)

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `nightshift-agents`: Remove the "Agent definitions in opencode.jsonc" requirement — agents are defined exclusively via markdown frontmatter in `.opencode/agent/` files
- `nightshift-installer`: Remove all `opencode.jsonc` merging, template bundling references, and related requirements; init/update only scaffold directories, write agent files, and write command files

## Impact

- `templates/opencode.jsonc` — deleted entirely
- `src/core/config-merger.ts` — deleted entirely
- `test/config-merger.test.ts` — deleted entirely
- `package.json` — `jsonc-parser` dependency removed
- `src/cli/commands/init.ts` — Step 4 (merge opencode.jsonc) removed
- `src/cli/commands/update.ts` — re-merge step removed
- `src/index.ts` — `mergeOpencodeConfig` export removed
- `openspec/specs/nightshift-agents/spec.md` — one requirement removed
- `openspec/specs/nightshift-installer/spec.md` — multiple requirements updated to remove opencode.jsonc references
- `templates/agents/*.md` — no changes needed (frontmatter already correct for parallel execution)
