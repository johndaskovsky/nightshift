## Context

The `update-orchestration-improvements` change introduced decentralized status writes (dev and QA agents write their own status to `table.csv` via `flock -x qsv edit -i`), a supervisor loop in `/nightshift-start` that re-invokes the manager after every batch, and compaction detection/recovery. These changes eliminated correctness issues (race conditions, stale `in_progress` states, context window corruption) but introduced significant performance overhead.

The current flow for every batch is:

1. Manager processes a batch (delegates to dev, applies recommendations, delegates to QA)
2. Manager outputs `Progress: M/N` and `Compacted: true|false` and **returns to the supervisor**
3. Supervisor parses the progress report
4. Supervisor runs `qsv search --exact todo` against every task column to verify termination
5. Supervisor re-invokes the manager (via `task_id` if not compacted, fresh if compacted)
6. Manager re-reads state and begins next batch

Steps 2-6 are pure overhead when no compaction has occurred. The supervisor's per-batch gating model forces a round-trip through the command layer for every batch, even though the manager already has all the context it needs to continue. Additionally, dev and QA agents return verbose payloads that the manager mostly ignores — status transitions are already in `table.csv`, and the manager only acts on `overall_status`, `recommendations`, and `error`.

## Goals / Non-Goals

**Goals:**

- Eliminate the supervisor-manager round-trip between batches when no compaction is detected
- Reduce the dev agent output payload to only the fields the manager acts on
- Reduce the QA agent output payload to only the fields the manager acts on
- Eliminate redundant termination checks (qsv queries against every task column after every batch)
- Preserve all existing correctness guarantees: decentralized status writes, compaction recovery, graceful degradation

**Non-Goals:**

- Changing the state machine (`todo` -> `qa` -> `done` / `failed`)
- Changing the dev agent's internal execution process (retries, self-validation, recommendations)
- Changing the QA agent's internal verification process
- Adding new agent types or communication channels
- Optimizing `flock`/`qsv` performance (already sub-millisecond for typical tables)
- Changing the `manager.md` or `table.csv` schema
- Introducing pipeline parallelism across tasks for the same row

## Decisions

### Decision 1: Manager self-continuation with supervisor as safety net

**Choice:** The manager processes all batches autonomously within a single session, only returning to the supervisor when it detects compaction or completes all work. The supervisor no longer gates each batch.

**Alternatives considered:**

- **Keep per-batch gating, reduce overhead** — The supervisor could skip the termination check and immediately re-invoke the manager. This reduces overhead but still forces an unnecessary round-trip through the command layer for every batch. Rejected because the fundamental issue is the gating model, not the checks within it.
- **Timer-based compaction checks** — The manager could check for compaction every N minutes rather than every batch. Rejected because batch boundaries are a natural and reliable checkpoint — timing-based checks would be less predictable and harder to reason about.

**How it works:**

The manager's orchestration loop (section 7 of `nightshift-manager.md`) changes from "process one batch then return to supervisor" to "process all batches until done or compacted." The manager still performs compaction detection at each batch boundary (section 6) — if compacted, it outputs `Compacted: true` and returns. Otherwise it continues to the next batch without returning.

The supervisor changes from a per-batch re-invocation loop to a simpler pattern:
1. Invoke the manager
2. When the manager returns, check the output:
   - If `Compacted: true`: start a fresh manager session and go to step 1
   - If the manager completed normally (no compaction): proceed to final report
3. There is no termination check — the manager itself determines when all work is done

The `Progress: M/N` line is still output by the manager, but as a final summary when it returns, not as an intermediate checkpoint. The manager updates `## Progress` in `manager.md` after each batch as before, which provides durable progress visibility if the session is interrupted.

### Decision 2: Streamlined dev agent output contract

**Choice:** The dev agent's output to the manager is reduced to three fields: `overall_status`, `recommendations`, and `error` (if failed). The verbose sections (Steps, Captured Values, Self-Validation, Attempts) are removed from the inter-agent output contract.

**Alternatives considered:**

- **Keep all fields, compress format** — Instead of removing fields, use a more compact format (e.g., single-line per step instead of multi-line). Rejected because the issue is not formatting but token count — each field adds context window pressure on the manager, and the manager does not use these fields for any decision.
- **Keep Captured Values for QA** — The manager currently passes dev results to QA, including captured values. However, QA independently verifies by using its own tools (Playwright, Read, etc.) — it does not rely on dev's captured values for anything other than "starting point" hints. Removing captured values from the inter-agent boundary means QA works purely from the item data and its own observations, which is actually a stronger verification model. The manager can instead pass a minimal note that dev succeeded for this item.

**What the dev agent keeps internally:** The dev agent still runs the full execution process — retries, self-validation, step-by-step tracking, captured values. These are used within its own session for retry decisions and self-improvement. They simply are not serialized back to the manager.

**What changes in the manager's delegation to QA:** The manager no longer passes dev's full results to QA. Instead, the QA prompt includes only the validation criteria, item data, and a note that dev completed successfully. QA has always been designed to verify independently — the dev results were informational, not authoritative.

### Decision 3: Streamlined QA agent output contract

**Choice:** The QA agent's output to the manager is reduced to two fields: `overall_status` (`PASS` or `FAIL`) and `summary` (brief text). The per-criterion details are removed from the inter-agent output.

**Alternatives considered:**

- **Keep per-criterion details** — The manager could use per-criterion details for logging or diagnostics. However, the manager does not act on per-criterion information — it only needs to know pass/fail and optionally log a failure reason. The QA agent's summary already contains enough detail for failure logging. Rejected as unnecessary.

**What the QA agent keeps internally:** The QA agent still evaluates each criterion independently and records per-criterion pass/fail with reasons. This drives its overall determination and its summary text. The per-criterion detail simply is not serialized back to the manager.

### Decision 4: Supervisor reads progress from manager.md instead of qsv queries

**Choice:** When the supervisor needs to check termination after the manager returns, it reads the `## Progress` section from `manager.md` instead of running `qsv search --exact todo` against every task column.

With the self-continuation model (Decision 1), the supervisor no longer performs per-batch termination checks at all — the manager runs until completion or compaction. The supervisor only needs to check the manager's output message to determine the next action. This decision applies to the final status report: the supervisor reads `manager.md` for the final counts rather than independently querying `table.csv`.

**Rationale:** The manager already writes accurate progress to `manager.md` after each batch. Querying `table.csv` independently was a redundant verification that the supervisor performed out of caution. With decentralized status writes and `flock -x` locking, the data in `table.csv` is authoritative, and the manager's progress section accurately reflects it.

### Decision 5: QA delegation without dev results passthrough

**Choice:** The manager's QA delegation prompt no longer includes the `## Dev Results` section. QA receives only the validation criteria, item data, and state update parameters.

**Rationale:** The QA agent is designed to independently verify outcomes. It uses its own tools (Playwright, Read, Glob) to check validation criteria against observable state. Including dev results was informational and occasionally served as a "starting point" for QA (e.g., checking a URL that dev captured). However, the item data already contains the necessary context (URLs, identifiers, etc.) and QA is more trustworthy when it verifies from scratch rather than from dev's self-report.

This also reduces the QA prompt size, which is compounded in parallel mode where N QA agents are dispatched simultaneously.

## Risks / Trade-offs

**[Risk: Manager runs too long without supervisor check]** The manager now runs autonomously until compaction or completion. If the manager enters an infinite loop or gets stuck, the supervisor cannot intervene. **Mitigation:** The manager's compaction detection (checking shift name, directory, current task from working memory) serves as a circuit breaker. Additionally, OpenCode's built-in session timeout provides an outer bound. The manager's progress writes to `manager.md` provide observability — if a shift is interrupted, the progress section shows how far it got.

**[Risk: QA without dev results may miss context]** Removing dev results from the QA prompt means QA cannot use dev's captured values as hints. **Mitigation:** QA has always been required to independently verify — dev results were supplementary. The item data contains all identifying information (URLs, names, IDs) needed for verification. QA's verification quality is actually stronger when it does not rely on dev's self-report.

**[Risk: Debugging failures is harder with reduced output]** When a dev or QA agent fails, the manager receives less diagnostic information. **Mitigation:** The `error` field on dev failures still contains the full failure description. The `summary` field on QA failures contains the assessment. For deeper debugging, the agent sessions themselves retain full detail — the reduced output is only the inter-agent boundary. Users can use `/nightshift-test-task` for detailed single-item debugging, which runs dev and QA with full output visible to the user.

**[Trade-off: Progress visibility during execution]** The supervisor no longer displays `Progress: M/N` between batches because it does not receive intermediate reports. Users see progress only when the manager completes or is restarted after compaction. **Mitigation:** The manager writes progress to `manager.md` after each batch, so durable progress is always available. Users can read `manager.md` or `table.csv` directly for real-time status.
