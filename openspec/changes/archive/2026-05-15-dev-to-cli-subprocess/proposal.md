## Why

The Nightshift dev role currently runs as a Claude Code subagent. Subagents only see MCPs declared in their own frontmatter — they do **not** inherit the user's top-level MCP configuration (Claude Code global MCP servers, Claude Desktop MCPs, custom internal MCPs, etc.). For Nightshift to be useful in real workflows, the dev needs access to whatever MCPs the user has installed — Slack, Drive, Playwright, internal company MCPs — without Nightshift shipping or knowing about those credentials.

Moving the dev from in-session subagent to top-level `claude -p` subprocess solves this directly: each dev invocation becomes a fresh Claude Code session that inherits the user's full MCP environment, with no special configuration needed.

The manager stays a subagent. Its job is orchestration (read state, pick next item, parse dev output, apply recommendations, update progress) — it does not call MCPs itself, so it doesn't need top-level MCP access. Keeping the manager as a subagent preserves the prose-budget guarantee, the locked-down delegation model (manager can only dispatch dev work), the `context: fork` benefit (manager work stays out of the user's main conversation), and most of today's working architecture.

## What Changes

- **BREAKING** Delete the `nightshift-dev` Claude Code subagent. The `.claude/agents/nightshift-dev.md` file is removed from templates, from plugin output, and from the `nightshift init` scaffolder. On reinstall, `nightshift init` SHALL also delete any pre-existing `.claude/agents/nightshift-dev.md` left over from a prior version.
- **New capability** Add a `/nightshift-do-task` Claude Code skill at the top level (no `context: fork`). The skill takes `<shift-name> <task-name> <item-id>` arguments, reads the relevant shift artifacts, substitutes template variables, executes the task steps, self-validates, writes its own row status to `table.csv`, and emits a structured final report. When invoked via `claude -p`, the skill runs in a fresh top-level Claude session and inherits all user-configured MCPs.
- **Modify manager subagent prose** Replace the "spawn a `nightshift-dev` subagent via the Agent tool" instructions with "spawn a dev subprocess via the Bash tool: `claude -p '/nightshift-do-task <shift> <task> <id>' --output-format stream-json --permission-mode auto ...`". The manager's `tools` allowlist swaps `Agent(nightshift-dev)` for `Bash(claude *)`.
- **Modify `/nightshift-test-task` skill** Same treatment as the manager: invocation switches from "spawn a `nightshift-dev` subagent" to "spawn a `claude -p` subprocess of `/nightshift-do-task`", with the read-only contract preserved (test-task subprocess SHALL run with a `--read-only` flag or equivalent boundary so `table.csv` and `manager.md` remain byte-identical).
- **Add real-time dev observability via stream-json logs** Every dev subprocess writes its `--output-format stream-json` stream to `.nightshift/<shift>/logs/<item-id>-<task-name>-<timestamp>.jsonl`. Users can `tail -f` any log mid-shift for live progress. The manager parses the final `result` event from each log for status and recommendations. The `.nightshift/<shift>/logs/` directory is added to `.nightshift/.gitignore` so logs don't pollute git.
- **Add parallel dispatch helper** Add `scripts/dispatch-batch.sh` bundled with the manager (referenced via `${CLAUDE_SKILL_DIR}` or a similar portable path). It takes a JSON manifest of `[{item_id, task_name}, ...]`, spawns N concurrent `claude -p` processes, waits for all to complete, parses each result, and emits a JSON array of `{item_id, status, recommendations, log_path}` back to the manager. Manager prose for parallel mode changes from "make N parallel `Agent` calls" to "run the dispatch script with this batch manifest".
- **Use `--permission-mode auto`** for both serial and parallel dev subprocesses. The classifier provides safety guardrails (blocks privilege escalation, mass deletion, force-push, etc.) without per-action prompts. The manager SHALL include a "safety boundary" preamble in every dev prompt that the classifier interprets as deny rules (e.g., "do not push to main, do not modify .env files outside the shift directory").
- **Test runner rewrite** `test/run-tests.ts` updates to handle the subprocess tree: per-item log files in the workspace, classifier-failure handling, longer expected durations (subprocess startup is real). Add a `NIGHTSHIFT_TEST_NO_AUTO_MODE` escape hatch that swaps `--permission-mode auto` for `--permission-mode bypassPermissions` in test environments where auto mode is unavailable (e.g., Pro plan, Bedrock).
- **Document plan/model constraints** Update README + AGENTS to note that `--permission-mode auto` requires Claude Code v2.1.83+, a Max/Team/Enterprise/API plan, an eligible model (Sonnet 4.6, Opus 4.6, Opus 4.7), and the Anthropic API provider. Provide a fallback mode (`bypassPermissions`) for users who don't meet the requirements, with the security caveat clearly stated.
- **Update existing specs** to reflect the new architecture: manager-dev contract moves from subagent-spawn to subprocess-spawn; dev-related requirements move from "subagent" framing to "skill running in a top-level Claude session" framing.

## Capabilities

### New Capabilities

- `dev-subprocess`: Defines the contract for invoking dev work as a `claude -p` subprocess — invocation flags, permission posture, stream-json log format, output schema parsed by the manager, parallel dispatch helper, classifier-fallback behavior, and the model/plan eligibility constraints.

### Modified Capabilities

- `nightshift-agents`: Removes the `nightshift-dev` subagent. Manager subagent's `tools` allowlist swaps `Agent(nightshift-dev)` for `Bash(claude *)`. Manager prose updates from "spawn dev subagent" to "spawn dev subprocess".
- `nightshift-commands`: Adds the `/nightshift-do-task` skill. Updates the `/nightshift-test-task` skill to invoke dev via subprocess with a read-only boundary. Manager-dispatched commands (parallel batches, retries) flow through the new dispatch script.
- `nightshift-installer`: Removes any pre-existing `.claude/agents/nightshift-dev.md` on init. Installs the new `nightshift-do-task` skill directory.
- `claude-code-target`: Updates the architectural description — dev is no longer a subagent surface; it's a top-level skill invoked via the CLI. Adds the dev-subprocess contract as part of the supported Claude Code surface.
- `parallel-execution`: Parallel batching shifts from "N concurrent `Agent` tool calls" to "one `dispatch-batch.sh` invocation that spawns N concurrent `claude -p` processes". Adaptive batch sizing semantics (double on success, halve on failure) are preserved.
- `test-runner`: Substantial update to handle the subprocess tree, per-item log files, classifier-failure handling, and the auto-mode escape hatch.

## Impact

- **Public skill surface (BREAKING):** Users who depended on the `nightshift-dev` subagent being available (e.g., calling it directly from their own automation) lose that surface. The replacement is `claude -p "/nightshift-do-task ..."`. This is a major version bump (2.0.0 → 3.0.0).
- **Permission posture changes (security):** The manager's `tools` allowlist gains `Bash(claude *)`. The manager can in principle invoke any `claude` CLI command. The locked-down "manager can only call `nightshift-dev`" invariant is replaced with "manager can shell out to the Claude CLI". This is a trade-off: today's hard guarantee is replaced with `--permission-mode auto`'s classifier guardrails on the dev side.
- **Dependency on a specific Claude Code version + plan:** Auto mode requires Claude Code v2.1.83+, a Max/Team/Enterprise/API plan, an eligible Sonnet/Opus model, and the Anthropic API provider. Users not on these will need to fall back to `--permission-mode bypassPermissions` (documented), accept the safety trade-off, or stay on 2.x.
- **Performance & cost:** Each dev item is now a fresh `claude -p` process — model initialization, system prompt loading, MCP server spin-up. Expect 5–15s of overhead per item. For typical task durations (30s–2min) this is acceptable. For very small tasks the overhead may dominate. Cost-per-item increases (separate sessions = no shared context).
- **Test runner:** Existing benchmark baselines will be invalidated by the architectural shift. Plan to reset baselines on first post-change run.
- **MCP server load (parallel mode):** N parallel dev subprocesses = N independent connections to each user MCP server. Some MCPs may not be designed for concurrent clients. Worth noting in docs; not blocking.
- **Observability uplift:** Today, the user scrolls back in the conversation to see what a dev agent did. Tomorrow, each dev is a separate `jsonl` log on disk. The user can `tail -f` mid-shift (a real UX improvement) or `cat` a log post-mortem.
- **`.nightshift/` directory layout:** Adds `.nightshift/<shift>/logs/` per shift; adds the corresponding pattern to `.nightshift/.gitignore`.
