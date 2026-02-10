## REMOVED Requirements

### Requirement: Agent definitions in opencode.jsonc
**Reason**: Agent configuration is defined exclusively via YAML frontmatter in markdown agent files (`.opencode/agent/*.md`). The `opencode.jsonc` agent block was redundant — it duplicated the same description, mode, tools, and permissions already declared in the markdown frontmatter. Removing it eliminates divergence risk and maintenance burden.
**Migration**: No action needed. Agent configuration is read from `.opencode/agent/nightshift-manager.md`, `.opencode/agent/nightshift-dev.md`, and `.opencode/agent/nightshift-qa.md` frontmatter. The `nightshift update` command will remove stale agent entries from `opencode.jsonc` automatically.
