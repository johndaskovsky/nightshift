## Context

The nightshift framework requires two external CLI tools — `qsv` (CSV operations) and `flock` (exclusive file locking) — but has no compile-time or install-time verification that they exist. The `nightshift-installer` spec already requires `init` to mention these dependencies in its summary, but the implementation (`init.ts`) does not. Meanwhile, the `nightshift-start` slash command template performs a runtime pre-flight check (`qsv --version` / `flock --version`), which means users only discover missing dependencies when they try to run a shift. This is the wrong point in the workflow — the CLI installer runs at setup time and is the natural place to surface dependency issues.

The CLI source lives in `src/cli/commands/init.ts` and `src/cli/commands/update.ts`, which both call into `src/core/scaffolder.ts`. Neither command currently checks for external dependencies. The `nightshift-start` template (`templates/commands/nightshift-start.md`) has a dedicated Step 3 for pre-flight dependency checks, plus a guardrail and version display in the pre-flight summary.

## Goals / Non-Goals

**Goals:**

- Add dependency verification to `nightshift init` and `nightshift update` that checks whether `qsv` and `flock` are available on `PATH` and warns the user with install instructions if either is missing.
- Remove the pre-flight dependency check step from `nightshift-start` to eliminate the duplicated responsibility.
- Keep dependency verification as a non-blocking warning (not a hard failure) in the CLI — the tools are only needed at shift execution time, not at scaffolding time.

**Non-Goals:**

- Automatically installing `qsv` or `flock` on behalf of the user.
- Checking for minimum versions of `qsv` or `flock` — presence is sufficient.
- Adding dependency checks to other slash commands (e.g., `nightshift-archive`, `nightshift-test-task`) — those commands will naturally fail with clear errors if the tools are missing.

## Decisions

### Decision 1: Shared utility function for dependency checking

Create a `checkDependencies()` function in `src/core/dependencies.ts` that both `init` and `update` call. This avoids duplicating the check logic.

The function will attempt to run `qsv --version` and `flock --version` via `child_process.execSync`, catch failures, and return a structured result indicating which dependencies are present and which are missing.

**Alternatives considered:**
- Inline the check in each command — rejected because it duplicates logic across `init.ts` and `update.ts`.
- Check via `which qsv` / `which flock` — rejected because running the actual command with `--version` is more reliable (confirms the binary is functional, not just present).

### Decision 2: Warn, don't block

The CLI will display a warning section in the summary when dependencies are missing, but will NOT exit with a non-zero code solely due to missing dependencies. The scaffolding operation itself does not need `qsv` or `flock` — they are only needed at shift execution time. A warning is sufficient because:

- Users may install dependencies after scaffolding.
- The CLI's job is to scaffold files — dependency availability is informational.
- A hard failure would prevent scaffolding, which has no actual dependency on these tools.

**Alternatives considered:**
- Exit with non-zero code — rejected because scaffolding succeeds regardless of dependency presence.
- Silent (no check at all) — rejected because users need to know about dependencies before attempting to run a shift.

### Decision 3: Remove pre-flight checks from nightshift-start entirely

Rather than keeping redundant checks in `nightshift-start`, remove Step 3 (pre-flight dependency checks) and the related guardrail entirely. The start command will trust that `init`/`update` have warned the user. If `qsv` or `flock` is genuinely missing at execution time, the agent's bash commands will fail with clear system-level errors.

Also remove the `qsv: v<version>` / `flock: v<version>` lines from the pre-flight summary display (Step 5), since the versions are no longer checked.

**Alternatives considered:**
- Keep a lightweight check in `nightshift-start` alongside the CLI check — rejected because it duplicates responsibility and adds unnecessary steps to every shift execution.

### Decision 4: Summary output format

The dependency status will appear in the summary section of both `init` and `update`, between the file list and the next-steps section. When all dependencies are present, show a confirmation. When any are missing, show a warning block with install instructions.

Example when missing:
```
--- Dependencies ---

  ! qsv is not installed.
    Install: brew install qsv (https://github.com/dathere/qsv)
  ✓ flock
```

Example when all present:
```
--- Dependencies ---

  ✓ qsv
  ✓ flock
```

## Risks / Trade-offs

- **[Risk] Users skip the CLI and manually create files** → They will never see the dependency warning. Mitigation: This is an edge case; the framework is designed around CLI-based scaffolding. If someone bypasses the CLI, they are expected to understand the dependencies.
- **[Risk] `qsv --version` or `flock --version` might hang or take a long time** → Mitigation: Use `execSync` with a short timeout (5 seconds). If it times out, treat as "not found."
- **[Trade-off] Removing pre-flight checks from `nightshift-start` means later failures are less user-friendly** → The system-level errors from bash ("command not found: qsv") are clear enough, and the user was already warned during `init`/`update`.
