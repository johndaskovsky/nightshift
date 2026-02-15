## Context

The Nightshift orchestration loop currently follows a four-agent pipeline: supervisor invokes manager, manager delegates to dev, manager delegates to QA, manager reports back to supervisor. This pipeline includes three mechanisms that add overhead without reliable value:

1. **Compaction detection**: The manager self-checks whether its LLM context has been truncated after every batch. This check is unfalsifiable — an LLM cannot reliably detect its own context compaction — and adds reasoning overhead to every loop iteration.

2. **QA subagent**: After the dev agent completes and self-validates, the manager invokes a separate QA agent to independently verify the same validation criteria. The dev already has a 3-attempt retry loop with self-validation; the QA step is redundant verification.

3. **Progress writes**: The manager queries `table.csv` for status counts, writes them to the `## Progress` section in `manager.md`, then reads them back from `manager.md` at completion or compaction. This is a denormalized cache of data already canonical in `table.csv`.

The state machine currently has 5 status values (`todo`, `in_progress`, `qa`, `done`, `failed`), but the agent implementation only uses 4 (`todo`, `qa`, `done`, `failed`). The `in_progress` status is specified but never implemented.

## Goals / Non-Goals

**Goals:**
- Reduce per-item token cost by eliminating the QA agent invocation
- Simplify the orchestration loop by removing compaction detection and the supervisor recovery loop
- Eliminate redundant file writes by removing the `## Progress` section from `manager.md`
- Align the spec-defined state machine with the actual implementation (3 states: `todo`, `done`, `failed`)
- Preserve all existing resume semantics — `table.csv` remains the source of truth for shift state

**Non-Goals:**
- Changing the dev agent's self-validation or retry logic (these remain as-is)
- Changing the step improvement mechanism (manager still applies recommendations from dev)
- Introducing new monitoring or observability features
- Changing qsv operations or CSV format beyond removing the `qa` status value
- Changing the parallel dispatch mechanism (adaptive batch sizing, concurrent dev dispatch remain)

## Decisions

### Decision 1: Remove QA agent entirely, not just skip it

**Choice**: Delete `nightshift-qa.md` and all QA delegation logic, rather than making QA optional or conditional.

**Rationale**: The dev agent already self-validates using the same validation criteria that QA would check. The dev has a 3-attempt retry loop, so failures are retried before being reported. QA adds a full agent invocation per item for independent verification that, in practice, confirms what the dev already reported. Removing QA entirely (rather than making it optional) avoids configuration complexity and keeps the mental model simple.

**Alternative considered**: Make QA opt-in via a `qa: true` field in task configuration. Rejected because it adds branching complexity for a feature that provides diminishing value given the dev's self-validation.

### Decision 2: Dev writes `done`/`failed` directly (no intermediate `qa` status)

**Choice**: The dev agent writes `done` on success and `failed` on failure. The `qa` status value is removed entirely.

**Rationale**: Without a QA agent, the `qa` status has no semantic meaning. The dev's self-validation is the final determination of success or failure. The state machine simplifies to: `todo -> done | failed`, with `failed -> todo` for re-queuing.

**Impact on resume**: On resume, the manager queries `table.csv` for `todo` items only. There are no `qa` items to dispatch since QA no longer exists. Items that were `in_progress` in specs (but never implemented) are also removed, so there are no transient states to recover from.

### Decision 3: Remove `in_progress` status from specs

**Choice**: Remove `in_progress` from the valid status values, aligning specs with the current implementation.

**Rationale**: The manager agent template has never implemented `in_progress`. The parallel execution spec references it for batch dispatch, but the actual manager code does not write `in_progress` before dispatching dev agents. Removing it from specs eliminates a source of confusion between specified and actual behavior.

**Impact on parallel batch state**: The parallel execution spec described setting items to `in_progress` before dispatch so interrupted batches could be detected on resume. Since this was never implemented, removing it changes nothing in practice. The existing resume logic (re-process `todo` items) already handles interrupted batches correctly because dev agents write `done` or `failed` atomically — if interrupted before writing, the item stays `todo`.

### Decision 4: Remove compaction detection entirely, not replace it

**Choice**: Remove all compaction detection logic. The manager runs until completion or error. The supervisor invokes it once and reads the result.

**Rationale**: Compaction detection asks the LLM "can you still remember the shift name, directory, and current task?" This is unreliable because: (a) a compacted LLM is equally likely to hallucinate the values as to report uncertainty, and (b) the check adds reasoning overhead every iteration. The existing resume mechanism already handles the failure case: if the manager errors out or the session is interrupted, the user re-runs `/nightshift-start` and the manager picks up from `table.csv` state.

**Alternative considered**: Replace the self-check with a deterministic signal (e.g., context window token count). Rejected because OpenCode does not expose context window metrics to subagents, and the existing resume logic makes recovery unnecessary.

### Decision 5: Supervisor becomes invoke-once

**Choice**: The supervisor invokes the manager once via the Task tool. No loop, no compaction recovery.

**Rationale**: With compaction detection removed, the supervisor has no reason to loop. If the manager completes, the supervisor reads the completion output. If the manager errors, the session fails and the user re-runs the command. The resume logic handles recovery.

**Impact**: The `nightshift-start` command becomes significantly simpler — it performs pre-flight checks, invokes the manager, and reports results.

### Decision 6: Completion summary derived from `table.csv` via qsv

**Choice**: At completion, the manager derives final counts (done, failed, remaining, total) by querying `table.csv` with qsv commands, then outputs them to the supervisor.

**Rationale**: This eliminates the write-then-read-back pattern where the manager wrote counts to `manager.md` and then read them back at completion. The qsv queries are the same ones the manager was already running to generate the progress data — the only change is that the results go directly to the output instead of being cached in a file first.

### Decision 7: Remove `## Progress` section from `manager.md` entirely

**Choice**: Remove the `## Progress` section from the manager file format and the `nightshift-create` template.

**Rationale**: The Progress section was a denormalized cache of `table.csv` data. With completion counts derived directly from qsv queries, there is no consumer of the Progress section. Human visibility into progress is provided by the supervisor's output and by querying `table.csv` directly (e.g., via `/nightshift-start` pre-flight summary).

## Risks / Trade-offs

**[No independent verification]** Removing QA means the dev agent is both executor and sole validator. If the dev consistently misinterprets a validation criterion, there is no second opinion to catch it. **Mitigation**: The dev's 3-attempt retry loop and explicit self-validation criteria provide reasonable confidence. Users can spot-check results using `/nightshift-test-task` which shows detailed step and validation output.

**[No mid-shift progress in `manager.md`]** Users can no longer glance at `manager.md` to see current progress. **Mitigation**: The pre-flight summary in `/nightshift-start` shows current status breakdown. Users can also run `qsv search` commands directly against `table.csv`.

**[No automatic recovery from context limits]** If the manager hits context limits on a very large shift, it will error rather than gracefully yielding. **Mitigation**: The resume logic handles this — the user re-runs `/nightshift-start` and processing continues from the last committed state in `table.csv`. The existing state machine ensures no work is lost because status writes are atomic.

**[Migration for existing shifts]** Shifts with items in `qa` status will not be processable under the new system without manual intervention. **Mitigation**: A migration step (documented in tasks) will use `qsv edit -i` to set `qa` items to `done` before the new system is deployed. In practice, this affects very few shifts since `qa` is a transient state.
