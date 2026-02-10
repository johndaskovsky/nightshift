## Why

The dev agent currently executes task steps blindly and hands off to QA without any self-assessment. When steps are suboptimal or fail, the dev reports the failure to the manager, which marks the item as `failed` — there is no opportunity for the dev to learn from the execution, refine the steps, or retry. This makes the system brittle: a single recoverable error permanently fails an item, and task step quality never improves across items within a shift.

## What Changes

- **Dev self-improves task steps**: After executing steps on an item, the dev agent updates the Steps section of the task file based on what it learned during execution (e.g., correcting assumptions, adding missing error handling, clarifying ambiguous instructions). These refinements benefit all subsequent items in the shift.
- **Validation criteria are immutable**: The dev agent must NEVER modify the Validation section of a task file. Validation criteria are the acceptance contract — only humans (via task authoring) can change them.
- **Dev runs self-validation**: After completing steps, the dev agent evaluates the task's Validation criteria itself before reporting back to the manager. This catches obvious failures early without consuming a QA invocation.
- **Retry loop on self-validation failure**: If the dev's self-validation detects a failure, the dev refines the steps and retries execution (up to a bounded limit) rather than immediately reporting failure to the manager. Only persistent failures escalate.

## Capabilities

### New Capabilities

(none — all changes modify existing capabilities)

### Modified Capabilities

- `nightshift-tasks`: Task file mutability rules — Steps section becomes mutable by the dev agent, Validation section is explicitly immutable
- `nightshift-agents`: Dev agent role expands to include step refinement, self-validation, and retry logic; manager orchestration updated to accommodate the new dev workflow

## Impact

- `.opencode/agent/nightshift-dev.md` — Major rewrite: add self-improvement, self-validation, retry loop, and immutability rules
- `.opencode/agent/nightshift-manager.md` — Update delegation prompt to inform dev of new responsibilities; adjust error handling for retry-aware results
- `openspec/specs/nightshift-tasks/spec.md` — Delta spec adding mutability rules for task file sections
- `openspec/specs/nightshift-agents/spec.md` — Delta spec expanding dev agent role and updating manager delegation flow
