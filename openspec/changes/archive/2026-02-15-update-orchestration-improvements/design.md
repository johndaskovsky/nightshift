## Context

Nightshift uses a three-agent architecture (manager, dev, QA) to process batches of items through task definitions. Currently, the manager is the sole writer of `table.csv` -- it sets `in_progress` before dispatching dev, `qa` before dispatching QA, and `done`/`failed` after QA returns. This creates a serialization bottleneck: the manager must wait for each agent to return before writing the next status. In parallel mode, multiple dev/QA agents run concurrently but all status writes are funneled through the manager after results return.

The `nightshift-start` command invokes the manager as a single long-running subagent. There is no mechanism for the manager to report progress back to the command thread, and no recovery if the manager's context is compacted mid-shift.

The `in_progress` status exists solely as a transient marker between delegation and result collection. On resume, any `in_progress` or `qa` items must be reset to `todo`, adding complexity for a state that provides no durable value.

All CSV operations use `qsv` but without file locking, which risks corruption when parallel dev/QA agents write to the same `table.csv` concurrently under the new decentralized model.

## Goals / Non-Goals

**Goals:**

- Eliminate the manager as a state-transition bottleneck by having dev and QA agents write their own status directly to `table.csv`
- Add `flock`-based exclusive file locking to all `qsv` operations on `table.csv` to prevent concurrent write corruption
- Remove `in_progress` from the state machine, simplifying the status model to 4 states: `todo`, `qa`, `done`, `failed`
- Add progress reporting from manager to the `nightshift-start` command thread after each batch
- Add compaction detection and recovery -- restart the manager subagent when context compaction is detected
- Filter step recommendations so only successful dev processes contribute learnings
- Add `{SHIFT:TABLE}` as a new template variable resolving to the full path of `table.csv`
- Make `qsv` and `flock` required (not optional) dependencies
- Update README to reflect all changes

**Non-Goals:**

- Changing the task file format or adding new sections
- Modifying the retry/self-improvement loop within the dev agent
- Adding new agent types or changing the three-agent architecture
- Implementing row-level locking (file-level exclusive lock is sufficient)
- Changing the QA agent's verification logic or criteria format
- Modifying the adaptive batch sizing algorithm

## Decisions

### Decision 1: Dev and QA agents write status directly via flock + qsv

**Choice:** Dev and QA agents gain `qsv*` and `flock*` bash permissions and write their own status transitions to `table.csv` using `flock -x <table_path> qsv edit -i`.

**Alternatives considered:**
- *Keep manager as sole writer* -- This is the current approach. It works but creates a serialization bottleneck. The manager must wait for each agent result, then write the status, then dispatch the next agent. In parallel mode, this means N agents complete concurrently but their status writes are serialized through the manager.
- *Use a separate status file per item* -- Each agent writes to its own file, manager reconciles. This avoids locking but adds significant complexity and fragile reconciliation logic.

**Rationale:** Direct writes with file locking are simpler, eliminate the bottleneck, and let agents be self-contained units of work. The `flock` lock serializes concurrent writes at the OS level, which is well-understood and reliable.

**State transitions by agent:**
- **Dev agent**: `todo` -> `qa` (on success) or `todo` -> `failed` (on failure after retries)
- **QA agent**: `qa` -> `done` (on pass) or `qa` -> `failed` (on fail)
- **Manager**: No longer writes status transitions. Reads status for delegation decisions, applies step recommendations, updates progress counters in `manager.md`.

**What the manager still needs to pass to agents:** The manager must include the table path and the row's qsv index in the delegation prompt so agents can construct the correct `flock`/`qsv` command. The task column name is also needed. These are added to the delegation prompt as a new `## State Update` section.

### Decision 2: Remove `in_progress` from the state machine

**Choice:** Eliminate `in_progress` entirely. The state machine becomes: `todo` -> `qa` -> `done` | `failed`, with `failed` -> `todo` for re-queuing.

**Alternatives considered:**
- *Keep `in_progress` but have dev set it* -- This preserves observability of "work underway" but still requires stale-state recovery on resume. The state provides no durable value since items are either `todo` (not yet completed) or `qa`/`done`/`failed` (completed).
- *Replace `in_progress` with a separate lock file* -- Adds complexity without clear benefit.

**Rationale:** The `in_progress` state only exists between "manager dispatches dev" and "dev finishes." With decentralized state management, the dev agent transitions directly from `todo` to `qa` or `failed` atomically. There is no window where a separate transient state is needed. Removing it eliminates the stale-state recovery logic entirely -- on resume, the manager simply finds `todo` items and dispatches them. If a dev agent was interrupted mid-execution, the item remains `todo` and will be re-processed.

**Impact on parallel mode:** In the current design, the manager sets all batch items to `in_progress` before dispatching dev agents, serving as a "claim" mechanism. With this change, items remain `todo` until a dev agent completes. The risk of double-dispatch (two dev agents picking up the same `todo` item) is mitigated by the manager's centralized item selection -- the manager decides which items to dispatch in each batch and does not re-select items it has already dispatched in the current batch.

### Decision 3: flock for file locking

**Choice:** Use `flock -x <table_path>` as a prefix to all `qsv` commands that operate on `table.csv`. The lock file is the table itself.

**Alternatives considered:**
- *Use a separate `.lock` file* -- Standard practice but adds another file to manage and clean up.
- *Use advisory locks via qsv itself* -- qsv has no built-in locking mechanism.
- *No locking, rely on manager serialization* -- This is the current implicit approach. It works only because the manager is the sole writer and serializes all writes. With decentralized writes, this breaks.

**Rationale:** `flock` is a lightweight POSIX utility. Using the table file itself as the lock target avoids managing separate lock files. Exclusive locks (`-x`) ensure only one process writes at a time. The `flock` command from [discoteq/flock](https://github.com/discoteq/flock) is a standalone binary installable via `brew install flock` and provides cross-platform compatibility.

**Lock granularity:** File-level exclusive lock on the entire `table.csv`. This is coarser than row-level locking but sufficient -- `qsv edit -i` operations are fast (sub-millisecond for typical table sizes), so lock contention is minimal even in parallel mode. The lock is held only for the duration of the single `qsv` command.

**Command pattern:** All `qsv` operations on `table.csv` across all agents and commands are prefixed:
```bash
flock -x <table_path> qsv edit -i <table_path> <column> <index> <value>
flock -x <table_path> qsv search --exact <value> --select <column> <table_path>
flock -x <table_path> qsv count <table_path>
```

Read-only `qsv` commands (search, count, slice, select, headers, table) also use `flock -x` to ensure consistent reads -- a read during a concurrent write could see partial data.

### Decision 4: Manager progress reporting with compaction recovery

**Choice:** After each batch (or each item in sequential mode), the manager outputs a structured progress line. The `nightshift-start` command thread monitors this output and restarts the manager if compaction is detected.

**Progress report format from manager:**
```
Progress: M/N
Compacted: true|false
```

Where M = number of items fully completed (`done` across all tasks), N = total items.

The manager determines `Compacted: true` if it detects that its context was compacted during the batch. The mechanism for detection is checking whether it has lost track of state it previously held (e.g., it can check a sentinel value in its context).

**nightshift-start command thread behavior:**
1. Invoke the manager via Task tool
2. When the manager returns with a progress report:
   - If `Compacted: false` or not present: re-invoke the same manager session (using `task_id`) to continue
   - If `Compacted: true`: discard the current manager session and start a fresh one
3. Repeat until the manager reports completion (all items done/failed) or no `todo` items remain

This changes `nightshift-start` from a single Task tool invocation to a loop that supervises the manager across batches.

**Alternatives considered:**
- *Single long-running manager invocation* -- Current approach. No progress visibility, no compaction recovery. The manager runs until it finishes or the context is exhausted.
- *Manager writes progress to a file* -- The command thread would need to poll the file, which is fragile with subagent execution timing.

**Rationale:** The Task tool returns the agent's final message, which naturally includes the progress report. The command thread can parse this and decide whether to continue or restart. This uses existing mechanisms without adding file-based coordination.

### Decision 5: Conditional recommendation incorporation

**Choice:** The manager only applies step recommendations from dev processes with `overall_status: "SUCCESS"`. Recommendations from `FAILED` processes are discarded.

**Alternatives considered:**
- *Apply all recommendations regardless of outcome* -- Current approach. Risk: a dev that failed because of a flawed approach might recommend changes based on that flawed approach, degrading step quality.
- *Apply recommendations from failed processes only if they relate to error handling* -- Too subjective and hard to evaluate automatically.

**Rationale:** A successful dev process has empirically validated its approach. Its recommendations come from a working execution and are likely to improve reliability. A failed process may have recommendations based on incorrect assumptions or flawed approaches. Discarding them is a safe default -- the same improvements will likely be suggested by the next successful execution.

### Decision 6: `{SHIFT:TABLE}` template variable

**Choice:** Add `{SHIFT:TABLE}` as a new shift placeholder that resolves to the full path of the shift's `table.csv` file.

**Resolution:** `{SHIFT:TABLE}` resolves to `<shift-directory-path>/table.csv` (e.g., `.nightshift/my-batch-job/table.csv`).

**Error handling:** `{SHIFT:KEY}` validation updated -- valid keys are now `FOLDER`, `NAME`, and `TABLE`. Any other key reports an error.

### Decision 7: qsv and flock as required dependencies

**Choice:** Both `qsv` and `flock` become required. Pre-flight checks in `nightshift-start` fail with an error (not a warning) if either is missing.

**Pre-flight check behavior:**
```bash
# Check qsv
qsv --version

# Check flock
flock --version
```

If either check fails, `nightshift-start` stops with:
```
Error: Required dependency missing.
Install qsv: brew install qsv (https://github.com/dathere/qsv)
Install flock: brew install flock (https://github.com/discoteq/flock)
```

The command does not proceed to shift execution.

**Rationale:** With decentralized state management, `qsv` is no longer "nice to have" -- it is the mechanism by which dev and QA agents write status. `flock` is required to prevent concurrent write corruption. Making both required simplifies the codebase (no fallback paths) and prevents subtle failures.

### Decision 8: Agent permission changes

**Dev agent gains:**
- `"qsv*": allow` in bash permissions (for writing status to `table.csv`)
- `"flock*": allow` in bash permissions (for file locking)

**QA agent gains:**
- `"qsv*": allow` in bash permissions (for writing status to `table.csv`)
- `"flock*": allow` in bash permissions (for file locking)

**Manager retains** `"qsv*": allow` but now uses it only for reads (search, count, slice, select, headers, table) and step recommendation application. The manager no longer uses `qsv edit -i` for status transitions.

**Manager also gains** `"flock*": allow` since its read operations should also be locked for consistency.

## Risks / Trade-offs

**[Risk: Double-dispatch in parallel mode]** Without `in_progress` as a claim mechanism, there is a theoretical risk that the manager could dispatch the same `todo` item to two dev agents in overlapping batches. **Mitigation:** The manager's item selection is centralized and batch-scoped -- it selects N items, dispatches them, and waits for all to return before selecting the next batch. The manager never runs two batch selections concurrently. Additionally, the progress-reporting loop in `nightshift-start` ensures only one manager session is active at a time.

**[Risk: Lock contention under high parallelism]** With many concurrent agents writing to `table.csv` via `flock -x`, lock contention could slow execution. **Mitigation:** `qsv edit -i` operations are sub-millisecond for typical table sizes (hundreds of rows). Even with 10+ concurrent agents, the total lock wait time is negligible. The lock is held only for the duration of the single `qsv` command, not for the entire agent execution.

**[Risk: flock availability on non-macOS platforms]** `flock` from discoteq/flock is primarily distributed via Homebrew. Linux systems have a built-in `flock` in `util-linux`, but the behavior may differ slightly. **Mitigation:** Document Homebrew installation as the primary path. The discoteq/flock binary is a standalone Go binary that could be downloaded directly from GitHub releases for non-Homebrew platforms.

**[Risk: Breaking change for existing shifts]** Shifts with `in_progress` statuses in `table.csv` will not work correctly after this update. **Mitigation:** Document the migration path (manually update `in_progress` values to `todo`). The `nightshift update` command regenerates agent/command files but does not touch shift data, so existing table data persists.

**[Risk: Compaction detection reliability]** The manager's ability to detect its own compaction depends on implementation-specific behavior of the AI runtime. **Mitigation:** Use a conservative approach -- the manager checks for state consistency at the start of each batch. If the manager cannot confirm it has the expected context (e.g., it does not know the shift name or directory), it reports `Compacted: true` and the command thread restarts it.

**[Trade-off: Coarser state visibility]** Removing `in_progress` means there is no observable state for "work is currently happening on this item." Items appear as `todo` until the dev agent finishes. **Accepted:** The progress reporting mechanism (`Progress: M/N`) provides batch-level visibility, which is sufficient for monitoring. Per-item "in flight" visibility was never exposed to users in a meaningful way.

**[Trade-off: Manager loses write authority]** The manager is no longer the "sole writer" of `table.csv`. This is a fundamental architectural change. **Accepted:** File locking ensures write safety. The simplification of the manager's role (read + delegate + apply recommendations) is a net benefit. The manager still coordinates all work -- it just no longer serializes status writes.
