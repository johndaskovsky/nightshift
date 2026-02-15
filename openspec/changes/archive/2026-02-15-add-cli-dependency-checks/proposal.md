## Why

The nightshift framework depends on two external CLI tools (`qsv` and `flock`) but currently has no mechanism to verify they are installed. The `nightshift-start` slash command performs a runtime pre-flight check, but this is too late in the workflow — users discover missing dependencies only when they try to run a shift, after setup is complete. The CLI installer (`nightshift init` and `nightshift update`) is the right place to verify and warn about dependencies, since it runs at setup time and already prints a summary of next steps. The `nightshift-installer` spec already requires this for `init` but the implementation has not caught up. Moving dependency awareness to the CLI also simplifies the `nightshift-start` command by removing a step that duplicates installer responsibilities.

## What Changes

- Add dependency verification to `nightshift init` — check whether `qsv` and `flock` are available on `PATH`, and include a warning with install instructions in the summary output if either is missing.
- Add the same dependency verification to `nightshift update` — since `update` overwrites all scaffolded files, it is an equally appropriate time to surface missing dependencies.
- Remove the **Pre-flight dependency checks** step from the `nightshift-start` slash command template — the start command will trust that `init`/`update` have already warned the user. This removes Step 3 (the `qsv --version` / `flock --version` checks and error-stop behavior) and the related guardrail.
- Remove dependency version display from the `nightshift-start` pre-flight summary (the `qsv: v<version>` / `flock: v<version>` lines).

## Capabilities

### New Capabilities

- `cli-dependency-verification`: Covers the CLI installer's ability to detect whether `qsv` and `flock` are installed, warn users with install instructions when they are missing, and confirm availability when they are present.

### Modified Capabilities

- `nightshift-commands`: Remove pre-flight dependency check requirement and scenarios from the `/nightshift-start` command specification.
- `nightshift-installer`: Extend the existing init summary dependency note requirement to cover active verification (not just a static note), and add the same requirement for `nightshift update`.
- `qsv-csv-operations`: Update the "qsv is not available" scenario to reference CLI installer verification instead of nightshift-start pre-flight checks.
- `table-file-locking`: Update the "flock is not available" scenario to reference CLI installer verification instead of nightshift-start pre-flight checks.

## Impact

- **CLI source code**: `src/cli/commands/init.ts` and `src/cli/commands/update.ts` gain dependency checking logic (likely a shared utility in `src/core/`).
- **Slash command template**: `templates/commands/nightshift-start.md` loses its pre-flight dependency check step, simplifying the command.
- **Specs**: Five specs are affected — one new (`cli-dependency-verification`) and four modified (`nightshift-commands`, `nightshift-installer`, `qsv-csv-operations`, `table-file-locking`).
- **No breaking changes**: Users who already have `qsv` and `flock` installed will see no behavior difference. Users who do not will now get earlier, clearer guidance.
