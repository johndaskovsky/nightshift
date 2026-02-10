## Context

Nightshift processes shifts sequentially: the manager picks one row, delegates to dev, waits for results, delegates to QA, updates status, and loops. The dev agent directly edits the task file's Steps section after each item to improve instructions for subsequent items.

This works well for small shifts but becomes a bottleneck at scale. Many tasks involve latency-bound operations (browser automation, API calls) where multiple items could be processed concurrently. The current learning model — where the dev agent writes to the task file — creates a write contention problem that must be solved before parallelism is possible.

The framework is entirely Markdown/CSV-based. All orchestration logic lives in the manager agent's instructions (`.opencode/agent/nightshift-manager.md`). There is no application code to modify — changes are expressed through agent instruction rewrites and spec updates.

## Goals / Non-Goals

**Goals:**
- Enable the manager to dispatch multiple dev agents concurrently for different rows of the same task
- Move step improvement responsibility from the dev agent to the manager, eliminating task file write contention
- Make batch size adaptive — start small, scale up when things are working, scale down on failures
- Preserve full backward compatibility for sequential mode (no `parallel` config = current behavior, except the learning model change)
- Apply the centralized learning model to both sequential and parallel modes for consistency

**Non-Goals:**
- Parallel execution of different tasks within the same row (task ordering within a row remains strictly sequential)
- Concurrent QA verification (QA remains sequential after each dev batch to keep verification simple)
- Dynamic resource management or rate limiting (the manager adjusts batch size, but does not manage system resources)
- Parallel execution across multiple shifts simultaneously

## Decisions

### Decision 1: Batch-based parallel dispatch

The manager processes items in batches rather than streaming. A batch is a group of rows that are all dispatched to dev agents concurrently for the same task. The manager waits for all dev agents in a batch to complete before proceeding to QA and the next batch.

**Rationale:** Batch-based execution is simpler to reason about than streaming. It creates natural synchronization points where the manager can update the table, apply learnings, and adjust batch size. It also maps cleanly to the Task tool's capabilities — the manager issues N parallel Task tool calls.

**Alternatives considered:**
- *Streaming dispatch* (launch new dev agents as others finish): More efficient utilization but significantly more complex state management. The manager would need to track in-flight work while dispatching new items. Deferred to a future enhancement.
- *Task-level parallelism* (run different tasks on different rows simultaneously): Violates the sequential task ordering constraint per row and complicates status tracking. Out of scope.

### Decision 2: Adaptive batch sizing with conservative start

The manager starts with a batch size of 2 and adjusts based on the success rate of completed batches:
- If all items in a batch succeed → increase batch size (double, capped at a maximum)
- If any items in a batch fail → decrease batch size (halve, minimum of 1)
- If batch size reaches 1, the manager is effectively in sequential mode with centralized learning

No hard maximum is specified in the design — the manager applies judgment based on the shift's complexity and observed behavior. The spec will define the starting size and adjustment rules.

**Rationale:** A conservative start avoids wasting items on a broken task. Doubling on success allows fast ramp-up for well-defined tasks. Halving on failure provides quick fallback. Starting at 2 (not 1) gives the manager immediate signal about whether parallelism is viable.

**Alternatives considered:**
- *Fixed batch size from config* (e.g., `parallel: 5`): Simple but doesn't adapt to reality. A fixed size of 10 with a broken task wastes 10 items before learning.
- *Start at 1 and scale up*: Too conservative — the first batch is just sequential mode. Starting at 2 gives a meaningful signal immediately.

### Decision 3: Centralized learning via recommendation reports

The dev agent no longer edits the task file. Instead, it includes a `Recommendations` section in its result output describing what step improvements it would suggest. The manager collects recommendations from all dev agents in a batch, deduplicates and synthesizes them, and applies a single coherent update to the Steps section between batches.

In sequential mode, this simplifies to: dev reports recommendations, manager applies them immediately before the next item.

**Rationale:** This solves the write contention problem (multiple devs can't safely edit the same file) and gives the manager better visibility into how tasks evolve. It also produces higher-quality improvements — the manager sees patterns across multiple items rather than each dev agent only seeing its own item. The dev still performs self-improvement during retries within its own execution (refining its in-memory understanding of steps), but does not persist changes to the file.

**Alternatives considered:**
- *Lock-based file editing* (dev acquires a lock before editing): The Task tool doesn't support file locking, and Markdown files have no locking mechanism. Would require introducing infrastructure that doesn't exist.
- *Last-write-wins*: Simple but loses improvements. If dev A improves step 3 and dev B improves step 5, only one edit survives.
- *Merge-based approach* (dev agents write to separate files, manager merges): Adds file management complexity for marginal benefit over recommendation reports.

### Decision 4: Dev retains in-memory self-improvement during retries

The dev agent still refines its approach across retry attempts within a single invocation — it just doesn't write those refinements to the task file. The dev uses the step improvements in-memory for retries 2 and 3, and reports its final recommendations to the manager.

**Rationale:** The retry loop (3 attempts) happens within a single dev agent invocation. The dev needs to learn from attempt 1 to improve attempt 2. Removing in-memory self-improvement would break the retry mechanism. The change is specifically about who persists improvements to the task file, not about whether the dev can learn during its own execution.

### Decision 5: Manager applies step improvements between batches

After collecting results from a batch, the manager:
1. Reviews all recommendations from successful and failed dev agents
2. Identifies common patterns and deduplicates similar suggestions
3. Applies a single, coherent update to the Steps section of the task file
4. Proceeds to QA delegation for successful items and the next batch

In sequential mode, this happens after every item (batch size of 1).

**Rationale:** Applying between batches ensures the next batch benefits from all learnings. Applying a single coherent update (rather than sequential per-dev updates) produces better step quality and avoids contradictory edits.

### Decision 6: Parallel config in manager.md

The `parallel` option is a simple boolean in the Shift Configuration section of `manager.md`:

```markdown
## Shift Configuration

- name: my-batch-job
- created: 2026-02-08
- parallel: true
```

When omitted or `false`, the manager uses sequential processing (batch size fixed at 1). When `true`, the manager uses adaptive batch sizing starting at 2.

**Rationale:** A boolean is the simplest useful interface. Advanced tuning (custom start size, max size, ramp-up strategy) can be added later as additional config fields without breaking the boolean.

**Alternatives considered:**
- *Numeric value* (e.g., `parallel: 5` for fixed batch size): Tempting but conflates "enable parallelism" with "set batch size." The adaptive sizing is a better default.
- *Separate config section*: Over-engineered for a single boolean. Can be expanded later if needed.

### Decision 7: Table state management during parallel execution

When dispatching a batch, the manager sets all batch items to `in_progress` before dispatching any dev agents. When all dev agents return, the manager updates statuses based on results (to `qa` for successes, `failed` for failures). QA is then run sequentially on the successful items.

**Rationale:** Setting all items to `in_progress` up front gives accurate state visibility if the shift is interrupted mid-batch. On resume, all `in_progress` items get reset to `todo` per the existing stale status recovery logic — the entire batch is effectively retried, which is correct since partial batch results may be inconsistent.

## Risks / Trade-offs

**[Risk] Batch failure wastes multiple items** → The adaptive sizing mitigates this. Starting at 2 limits initial exposure. Halving on failure quickly returns to sequential mode. Items marked `failed` can be re-queued manually via `/nightshift-update-table`.

**[Risk] Manager recommendation synthesis is lossy** → The manager may miss or incorrectly merge recommendations from concurrent devs. Mitigation: the manager processes recommendations in a structured way (the dev output contract defines a clear format), and errs on the side of applying all non-contradictory suggestions.

**[Risk] Breaking change to dev agent role** → Existing shifts and task files that assume the dev edits Steps directly will behave differently. Mitigation: the dev's retry loop still works (in-memory refinement), and the manager now handles persistence. No user-facing behavior change — steps still improve over time, just through a different mechanism.

**[Trade-off] Sequential QA after parallel dev** → QA could also be parallelized, but this adds complexity with minimal benefit (QA is typically faster than dev execution). Keeping QA sequential simplifies the batch lifecycle.

**[Trade-off] No task-level parallelism** → Tasks within a row remain sequential. This preserves the existing ordering guarantee but means a 3-task shift can't overlap tasks across rows. Acceptable for the initial implementation.
