## Context

Nightshift 2.x (the version this proposal builds on) runs entirely in-session in Claude Code. The user invokes `/nightshift-start`, which forks into a `nightshift-manager` subagent. The manager spawns `nightshift-dev` subagents via the `Agent(nightshift-dev)` tool to execute individual items. Both agents are declared in `.claude/agents/`. Status flows through `table.csv` (dev writes own row via flock+qsv). Recommendations and final status flow as text from the dev subagent's return value to the manager's conversation context.

Claude Code subagents do not inherit the user's top-level MCP configuration. MCPs must be declared in each subagent's frontmatter. This works for things Nightshift owns (we can ship a Playwright example) but fails for the user's installed MCPs (Slack, Drive, internal company MCPs, etc.) since we'd need their credentials.

The user wants the dev to access the user's MCPs. The user accepts that the manager will not (keeping it as a subagent is fine; it just orchestrates).

This change moves the dev to a top-level `claude -p` subprocess invoked from the manager subagent via the Bash tool. The dev becomes a Claude Code skill rather than a subagent. The manager remains a forked subagent, dispatching dev subprocesses directly — no extra nesting layer.

## Goals / Non-Goals

**Goals:**

- A dev process that inherits the user's full MCP configuration on every invocation.
- Real-time observability of dev work via durable, tail-able log files (one per dev invocation).
- Preserve the existing state machine (`todo → done|failed`), retry budget (3 attempts/item), self-validation, self-improvement loop, `disable-self-improvement` flag, and parallel batching with adaptive batch sizing.
- Use `--permission-mode auto` so dev subprocesses have safety guardrails without per-action prompts.
- A documented fallback (`bypassPermissions`) for users whose plan/model/version doesn't qualify for auto mode.
- A clean delete of the `nightshift-dev` subagent: removed from templates, plugin output, scaffolder, and (on `nightshift init`) the user's `.claude/agents/`.

**Non-Goals:**

- Giving the manager subagent access to top-level MCPs. The manager remains a subagent; its work is orchestration only. If a future change wants manager MCPs, that's a separate proposal.
- Building an interactive dashboard or TUI for observing shift progress. Live observability is via plain log files and `tail -f`; a richer dashboard is a follow-up if wanted.
- Replacing `flock + qsv` for `table.csv` mutations. Dev subprocesses use the same locking mechanism the dev subagent used.
- Backwards compatibility with 2.x dev-subagent invocations. This is a major version bump; old call sites break by design.
- Cross-machine parallelism. Parallel dispatch runs on the user's host.

## Decisions

### 1. Dev process is invoked as a skill, not an inline prompt

The manager invokes the dev via `claude -p "/nightshift-do-task <shift-name> <task-name> <item-id>" ...`. The `nightshift-do-task` skill is installed at `.claude/skills/nightshift-do-task/SKILL.md` and is a regular top-level skill (no `context: fork`).

**Alternatives considered:**

- *Ad-hoc prompt synthesis.* Manager constructs a full task prompt and pipes it to `claude -p`. Rejected — the prompt grammar is non-trivial (substitute template vars, articulate retry semantics, document the output contract). Putting it in a versioned skill keeps the contract in one place and lets us evolve it.
- *Inline-args slash command, no positional contract.* Rejected — the skill body needs structured inputs (shift/task/item) to look up the right artifacts; positional args via `$ARGUMENTS` is the existing convention.

**Argument shape:** `/nightshift-do-task <shift-name> <task-name> <item-id>`. The skill resolves the shift directory, reads `manager.md`, `<task-name>.md`, and the corresponding `table.csv` row, performs template substitution, executes, self-validates, writes its own row status, and emits a final structured report.

### 2. Final output format: `--output-format stream-json`, parsed at completion

Every dev subprocess uses `--output-format stream-json`. The full stream is written to a per-item log file. The manager parses the final `result` event from the log (the last JSON line with `"type": "result"`) to extract status, final message text, and recommendation text. This gives us both real-time observability (the stream is being written as the subprocess runs) and a clean final-result parse.

**Alternatives considered:**

- *`--output-format json` only (final-result only, no streaming).* Simpler but no real-time observability. Rejected because real-time was a stated goal.
- *Stream to manager's stdout, manager parses incrementally.* Rejected — the manager is a subagent; it doesn't easily process streaming subprocess output. File-based streaming is robust.
- *Pretty-print output (no JSON).* Rejected — the manager needs to parse status and recommendations programmatically.

### 3. Permission posture: `--permission-mode auto` with a `bypassPermissions` fallback

Dev subprocesses run with `--permission-mode auto` by default. The auto-mode classifier blocks privilege escalation, mass deletion, force-push, and other risky actions without per-action prompts. The manager-supplied dev prompt includes a "safety boundary" preamble — auto mode treats user-stated boundaries as deny signals, so we leverage that for extra constraints (e.g., "do not modify files outside `{SHIFT:FOLDER}` and `.nightshift/<shift>/`; do not push to git; do not modify `.env` files").

When auto mode is unavailable (Pro plan, Bedrock/Vertex, non-eligible model, older Claude Code), the manager falls back to `--permission-mode bypassPermissions`. Manager prose covers both modes and documents the trade-off.

**Alternatives considered:**

- *`--permission-mode acceptEdits` only.* Rejected — acceptEdits doesn't pre-approve `claude` CLI invocations or many Bash operations Nightshift dev needs. Constantly hitting prompts would defeat the autonomous batch model.
- *`--allowedTools "Bash(mkdir *) Bash(qsv *) Bash(flock *) Read Write Edit mcp__*"`.* Pre-approves Nightshift's needs + all MCP tools. Considered, but: (a) it doesn't pre-approve other Bash the user's MCP-invoked tasks might need (e.g., `curl`, `git`); (b) it doesn't pre-approve task-defined `tools` from the task file's Configuration section. Auto mode covers the broader surface with classifier guardrails. We may add narrow allow-rules **on top of** auto mode in the future.
- *`--permission-mode dontAsk` with a comprehensive allow-list.* Rejected — composing the right allow-list is impossible when the dev needs to use whatever MCPs the user has. dontAsk denies anything not pre-approved.

**Detecting auto-mode availability:** The manager (or a pre-flight helper script) runs a one-shot `claude --permission-mode auto -p "echo ready"` probe before dispatching the first dev. If it errors with the auto-mode unavailability message, the manager logs a notice and falls back to `bypassPermissions` for all subsequent dev invocations in the shift. The probe runs once per shift, not per item.

### 4. Classifier-failure budget

Auto mode in `-p` (non-interactive) aborts the session after 3 consecutive classifier denials or 20 total. If a dev subprocess aborts this way, the manager sees a non-zero exit code and no `result` event in the log file. The manager treats this exactly like any other dev failure:

- Decrement the retry counter (item still has up to 3 attempts).
- Log the classifier denial reason from the stream-json log (it'll appear as a non-result event).
- Retry the item, or mark it `failed` if attempts exhausted.

There is no special "classifier failure" status; it folds into `failed`. The recommendations channel may surface "this task is hitting auto-mode denials; consider revising the task to avoid X" so the self-improvement loop can adapt the task definition.

### 5. Log file location and format

Per dev invocation: `.nightshift/<shift>/logs/<item-id>-<task-name>-<YYYY-MM-DDTHH-MM-SS>.jsonl`.

- One JSON object per line (the stream-json format).
- `<item-id>` matches the `row` column of `table.csv`.
- `<task-name>` matches the task column / task file name.
- Timestamp ensures retries don't overwrite earlier attempts; each retry gets its own log.

Logs are gitignored via `.nightshift/.gitignore` (existing file gains a `**/logs/` pattern). Logs are NOT moved when a shift is archived — they remain alongside the shift directory in the archive, providing a durable post-mortem record. If users need to recycle disk, they can delete `.nightshift/archive/*/logs/` manually.

**Alternatives considered:**

- *Single shared log file per shift.* Rejected — concurrent appenders (in parallel mode) would corrupt the file; per-invocation files avoid the problem entirely.
- *Logs in `/tmp` or `~/.nightshift-logs`.* Rejected — co-locating with the shift directory makes them easy to find, easy to gitignore, and survives directory moves.

### 6. Parallel dispatch via bundled script

Adaptive parallel batches today are "N concurrent `Agent(nightshift-dev)` tool calls in one manager message." With subprocesses we need to spawn N concurrent `claude -p` processes and wait for all of them. Composing that in a manager prompt is brittle. Solution: bundle a `dispatch-batch.sh` helper that does it.

The helper script lives at `templates/claude/skills/nightshift-start/scripts/dispatch-batch.sh` (alongside the existing `preflight.sh`), is installed by the scaffolder under `.claude/skills/nightshift-start/scripts/`, and is referenced from the manager prose via `${CLAUDE_SKILL_DIR}/scripts/dispatch-batch.sh`.

**Contract:**

- **Input:** stdin or a path to a JSON file containing `{"shift": "...", "items": [{"item_id": "1", "task": "create_page"}, ...], "permission_mode": "auto", "log_dir": ".nightshift/<shift>/logs"}`.
- **Behavior:** Spawns one `claude -p "/nightshift-do-task ${shift} ${task} ${item_id}" --output-format stream-json --permission-mode ${permission_mode} > ${log_dir}/${item_id}-${task}-${timestamp}.jsonl` per item, runs them in parallel, waits for all to exit.
- **Output (stdout):** A single JSON document `{"results": [{"item_id": "1", "exit_code": 0, "status": "done|failed", "recommendations": "...", "log_path": "..."}, ...]}` parsed by the manager.
- **Concurrency control:** Honors the manager's `current-batch-size` (passed as the number of items in the batch; the helper itself doesn't subdivide further).

This script is also used in serial mode (with a single-item batch), so the manager always invokes the same helper for both modes. Reduces prose surface and keeps one code path.

### 7. Test-task skill: read-only boundary

`/nightshift-test-task` today invokes a dev subagent that mutates nothing. With the subprocess design, we need the subprocess to also mutate nothing. Two complementary mechanisms:

- The `nightshift-do-task` skill accepts a `--read-only` argument (e.g., a 4th positional). When set, the skill skips the "write own row status" step and the "apply recommendations" step.
- The test-task skill's invocation prompt includes a boundary line ("do not modify table.csv, do not modify manager.md, do not modify the task file") that the auto-mode classifier interprets as deny.

Defense in depth: even if the prompt-level boundary is forgotten, the skill-level read-only flag prevents mutation.

### 8. Manager `tools` allowlist

Current: `tools: Agent(nightshift-dev), Read, Write, Edit, Bash, Glob, Grep`.
New: `tools: Read, Write, Edit, Bash, Glob, Grep`. The narrow `Bash(...)` allow-rules in `.claude/settings.json` get an additional entry: `Bash(claude *)` so manager-spawned subprocesses don't require permission prompts.

**Why drop `Agent(...)` entirely:** The manager no longer spawns subagents. Removing the `Agent` tool ensures the manager can't accidentally fork into some other subagent if a future task or prompt instructs it to.

### 9. Manager prose stays under the 5,000-token budget

Adding subprocess-dispatch prose, parallel-batch helper invocation, log parsing, and classifier-fallback handling will bloat the manager body. The existing budget check (`< 20,000 characters`) remains. If we blow it, options include:

- Push more logic into the `dispatch-batch.sh` helper (manager just calls the script and parses one JSON blob).
- Push more logic into the `nightshift-do-task` skill body (so the manager doesn't need to articulate task execution at all — it just dispatches and parses).
- Drop the most verbose existing prose sections (e.g., redundant tool-usage examples).

The goal is to keep manager prose oriented at orchestration semantics; details of how the dev does its work live in the do-task skill.

### 10. Backward compatibility cleanup

`nightshift init` SHALL detect a pre-existing `.claude/agents/nightshift-dev.md` (left over from a 2.x install) and delete it. Without this, users on the 3.0 upgrade would have a stale subagent file alongside the new do-task skill — confusing and potentially active if the manager prose ever references the old subagent name.

The deletion is silent unless the file content differs from the 2.x template (i.e., the user customized it). In that case, the file is renamed `.claude/agents/nightshift-dev.md.bak.<timestamp>` and a warning is surfaced.

### 11. Plugin manifest update

The plugin (root-level `agents/` and `skills/`) materialization in `build.js` is driven from `templates/claude/`. Once `nightshift-dev.md` is deleted from `templates/claude/agents/` and `nightshift-do-task/` is added to `templates/claude/skills/`, the build script picks up the changes automatically. The plugin manifest version bumps from 2.0.0 to 3.0.0 alongside package.json.

## Risks / Trade-offs

- **[Risk] Auto mode classifier aborts a dev mid-shift.** → Manager treats it as a normal dev failure, retries up to 3 attempts per item, then marks `failed`. Failures surface in the final shift report; user can revise the task definition or fall back to `bypassPermissions`.
- **[Risk] Users on Pro / Bedrock / Vertex / older Claude Code can't use auto mode.** → Documented fallback to `--permission-mode bypassPermissions`. README clearly states the trade-off (no classifier guardrails). The pre-flight probe auto-detects and falls back without user intervention.
- **[Risk] Manager subagent's `Bash(claude *)` allow is a broad permission grant.** → True; the manager could in principle invoke any Claude CLI command. Mitigated by: (a) the manager's task is constrained to the prompt it received; (b) manager prose explicitly limits `claude` invocations to `/nightshift-do-task`; (c) the user is in the loop on what shifts get run. Acknowledged trade-off vs. today's hard guarantee.
- **[Risk] Per-invocation subprocess overhead (model init, MCP spin-up) materially slows shifts.** → Quantified at 5–15s per item. Acceptable for typical task durations. Documented; not optimizable without architectural change. Parallel mode helps amortize.
- **[Risk] N concurrent MCP connections overload poorly-designed MCP servers.** → Out of our control. Users can cap `max-batch-size` to limit concurrency. Documented as a known limitation.
- **[Risk] Stream-json log files grow large.** → Per-item logs are typically <100KB. Gitignored. Users can prune `.nightshift/archive/*/logs/` manually. No automated retention policy (deliberate — the logs are evidence and users decide when to delete).
- **[Risk] Test runner benchmarks become inflated and noisy.** → Reset baselines on first post-change run. The architectural shift makes prior baselines incomparable.
- **[Risk] `--permission-mode auto` requirements (v2.1.83+, plan, model) shift over time as Claude Code evolves.** → Documented at proposal time. Users with stale Claude Code will hit the fallback path; the fallback is documented.
- **[Trade-off] Observability changes shape.** → Conversation-transcript review is gone for dev work; per-invocation log files replace it. Users who liked scrolling back lose that. Users who want `tail -f` on a live agent gain that. Net-positive for the operator workflow, net-different for casual inspection.

## Migration Plan

This is a major version bump (2.x → 3.0.0).

1. Implement on a single feature branch (`dev-to-cli-subprocess`) backed by this OpenSpec change.
2. Bump `package.json` version from `2.0.0` to `3.0.0`. Sync plugin manifest version.
3. Update CHANGELOG with a `## [3.0.0]` entry under a `### BREAKING` heading: dev is now a subprocess, `nightshift-dev` subagent file is removed on init, manager allowlist changes, observability semantics change.
4. Run `pnpm build` and verify the published tarball contains `templates/claude/skills/nightshift-do-task/` and no `templates/claude/agents/nightshift-dev.md`.
5. Run `pnpm test:init` and `pnpm test:integration`. Reset benchmark baselines. Update test runner to handle subprocess tree and classifier-fallback.
6. Tag and publish `3.0.0`. 2.x remains on npm for users who can't accept the breaking changes.

**No automated upgrade path for active shifts:** Shifts in flight under 2.x continue under 2.x. On upgrade to 3.0, the next `nightshift init` removes the stale `nightshift-dev.md` and installs the new `nightshift-do-task` skill. Active shift data in `.nightshift/<shift>/` is unaffected — it's runtime-agnostic.

**Rollback:** Users can downgrade to 2.x via npm (`npm install -g @johndaskovsky/nightshift@2`). The `nightshift-dev` subagent file would need to be re-created by re-running `nightshift init` on 2.x.

## Open Questions

- **Should the manager bake the auto-mode probe result into `manager.md`?** I.e., on first dispatch, write `permission-mode: auto` or `permission-mode: bypassPermissions` to `manager.md` so resumes don't re-probe. Cleaner UX but adds an extra mutable field to `manager.md`. Default proposal: no — re-probe on resume, it's cheap. Reconsider if the probe is annoying in practice.
- **Should the do-task skill set `disable-model-invocation: true`?** The skill is meant to be invoked via the CLI subprocess flow, not by Claude auto-selecting it. Yes, set the flag. (Captured in spec deltas.)
- **Concurrency cap independent of `max-batch-size`?** If a user has `max-batch-size: 20`, that's 20 concurrent `claude` processes + 20 concurrent MCP connections. Some hosts will tip over. We could expose a `dispatch-batch.sh` cap (env var `NIGHTSHIFT_MAX_CONCURRENCY=8`) as a host-level governor. Default proposal: not in this change. Users can set `max-batch-size` deliberately. Revisit if this becomes a complaint.
- **What about the existing `nightshift-test-task` skill — does it also dispatch via `dispatch-batch.sh`?** It's a one-item, no-state-mutation invocation. Could go through the helper (consistency) or directly call `claude -p` (simpler). Default proposal: directly. The helper script's value is parallel + status parsing; test-task needs neither.
