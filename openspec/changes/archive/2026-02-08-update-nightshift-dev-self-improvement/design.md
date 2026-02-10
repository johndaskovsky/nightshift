## Context

The Nightshift framework uses a three-agent architecture (manager, dev, qa) where the dev agent executes task steps and the qa agent verifies results. Currently, the dev agent is a pure executor — it follows steps literally, reports results, and never modifies the task file. When execution fails, the manager marks the item as `failed` and moves on. Task steps are static for the entire shift, regardless of what the dev learns during execution.

This design covers four interconnected behaviors being added to the dev agent: step self-improvement, validation immutability, self-validation, and retry on failure.

## Goals / Non-Goals

**Goals:**
- Dev agent refines task Steps after each item execution, improving quality for subsequent items
- Validation section is protected from dev modifications (immutable contract)
- Dev agent catches obvious failures via self-validation before QA handoff
- Dev agent retries on self-validation failure with refined steps, reducing unnecessary `failed` statuses
- Bounded retry count to prevent infinite loops

**Non-Goals:**
- Dev agent does NOT replace QA — QA still verifies independently after dev self-validates
- Dev does NOT modify Configuration or Validation sections — only Steps
- No changes to the QA agent's behavior or responsibilities
- No changes to table.csv ownership (manager remains sole writer)
- No changes to the slash commands or shift directory structure

## Decisions

### 1. Dev modifies the task file in-place after execution

**Decision:** After executing steps on an item, the dev agent writes updated Steps back to the task `.md` file in the shift directory.

**Rationale:** Task files live in the shift directory and are ephemeral (archived after shift completion). Modifying them in-place is the simplest approach — no need for a separate "learned steps" storage. Each subsequent item benefits from refinements immediately.

**Alternative considered:** Store step refinements in a separate file (e.g., `<task-name>.refined.md`). Rejected because it adds complexity — the dev would need to merge original and refined steps, and the manager would need to know which file to send.

### 2. Retry limit of 2 (max 3 total attempts per item)

**Decision:** The dev agent attempts execution up to 3 times per item: 1 initial attempt + 2 retries. After 3 failures, the dev reports failure to the manager.

**Rationale:** 3 attempts balances recovery opportunity against resource waste. Most recoverable errors are fixed on the first retry (step refinement addresses the root cause). Beyond 2 retries, the problem is likely systemic and needs human attention.

**Alternative considered:** Configurable retry count per task. Rejected for now — adds complexity to the task file format with minimal benefit. Can be added later if needed.

### 3. Self-validation uses the same Validation section as QA

**Decision:** The dev agent reads the Validation section from the task file and evaluates each criterion, using the same format as QA.

**Rationale:** Using the same criteria ensures consistency — if the dev's self-check passes, QA is likely to pass too. No need for separate "dev-check" criteria.

**Trade-off:** The dev agent now needs read access to the Validation section (which it already has since it receives the full task file). The immutability constraint is about writes, not reads.

### 4. Self-improvement happens BEFORE self-validation

**Decision:** After executing steps, the dev first refines the Steps section based on what it learned, then runs self-validation on the outcomes.

**Rationale:** This ordering ensures that if self-validation fails and a retry is needed, the retry uses the already-refined steps. The improvement is captured regardless of whether validation passes.

### 5. Manager prompt updated, not manager orchestration logic

**Decision:** The manager's core orchestration loop (select item → delegate dev → delegate qa → update status) stays the same. The dev agent handles retries internally — the manager just sees a single dev invocation that either succeeds or fails.

**Rationale:** Keeping retry logic inside the dev agent maintains separation of concerns. The manager doesn't need to know about retries — it just gets a final result. This minimizes changes to the manager and avoids complicating the orchestration flow.

**Alternative considered:** Manager orchestrates retries (re-invokes dev on failure). Rejected because it would require the manager to track retry counts, pass failure context, and add branching logic to the orchestration loop. The dev agent already has all the context needed to retry.

### 6. Dev output contract extended with retry metadata

**Decision:** The dev's result format adds an `Attempts` field showing how many attempts were made and whether self-improvement occurred.

**Rationale:** The manager and QA benefit from knowing if steps were refined and how many attempts were needed. This is observability, not control — the manager doesn't branch on this data.

## Risks / Trade-offs

- **[Risk] Dev self-improvement degrades step quality** — A bad refinement could make steps worse for subsequent items. Mitigation: Steps only get refined based on concrete execution feedback (errors, missing handling), not speculation. The QA agent still independently verifies, catching regressions.

- **[Risk] Retry loop masks systemic issues** — If a task is fundamentally broken, 3 attempts waste time before failing. Mitigation: Bounded at 2 retries. The dev reports all attempt details so the manager's failure log shows the pattern.

- **[Risk] Dev self-validation is less rigorous than QA** — The dev may be biased toward its own work. Mitigation: Self-validation is a pre-check, not a replacement for QA. QA still runs independently with the same criteria.

- **[Trade-off] Task file mutation across items** — Step refinements from item N affect item N+1. This is intentional (learning loop) but means items aren't fully independent. If a refinement is wrong, it could cascade. Acceptable because shifts are ephemeral and the original task authored by the human is preserved in the change/spec history.

- **[Trade-off] Increased dev agent context** — The dev agent now does more per invocation (execute + refine + validate + possibly retry). This increases token usage per item. Acceptable because it reduces overall failures and QA re-invocations.
