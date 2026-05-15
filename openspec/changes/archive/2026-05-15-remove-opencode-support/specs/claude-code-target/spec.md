## MODIFIED Requirements

### Requirement: Claude Code installation surface
The system SHALL provide a Claude Code installation surface that scaffolds Nightshift agents, skills, and project settings into the standard Claude Code directory layout (`.claude/`) so that Nightshift is fully usable inside Claude Code without manual file edits. Claude Code is the only supported installation surface.

#### Scenario: Init writes Claude Code directories
- **WHEN** `nightshift init` runs in a fresh project
- **THEN** the system SHALL create `.claude/agents/`, `.claude/skills/`, and `.nightshift/archive/`

## REMOVED Requirements

### Requirement: Manager and dev orchestration semantics preserved
**Reason:** This requirement asserted cross-runtime parity between OpenCode and Claude Code. With OpenCode removed, there is no second runtime to preserve parity against — the Claude subagents are the canonical (and only) implementation.
**Migration:** The orchestration contract (state machine, retry budget, self-validation, parallel batch sizing, self-improvement loop, `disable-self-improvement` flag) is still required, but is now specified solely against the Claude Code subagents under the `nightshift-agents` and `nightshift-tasks` specs.
