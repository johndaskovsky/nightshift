## Why

The `nightshift init` and `nightshift update` commands scaffold agent and command files into a target project but do not create a `.gitignore` inside `.nightshift/`. Shift execution produces `table.csv.bak` backup files (from qsv operations) that should not be committed to version control. Currently users must manually create and maintain this `.gitignore`, which is easy to forget and leads to noisy diffs or accidental commits of transient backup data.

## What Changes

- Both `nightshift init` and `nightshift update` will create (or overwrite) a `.nightshift/.gitignore` file containing `table.csv.bak` as a default ignore pattern.
- The `.gitignore` write follows the same overwrite-on-every-run pattern used for agent and command files, ensuring the ignore rules stay current across CLI version upgrades.
- The scaffolder gains a new function to write the `.gitignore` file alongside the existing directory and file scaffolding steps.
- The init/update summary output includes the `.gitignore` file in its list of created/updated files.

## Capabilities

### New Capabilities

- `gitignore-scaffold`: Covers the creation and maintenance of `.nightshift/.gitignore` during init and update, including default ignore patterns, idempotent overwrite behavior, and summary output integration.

### Modified Capabilities

- `nightshift-installer`: The init and update commands gain a new scaffolding step (writing `.nightshift/.gitignore`). This changes the behavioral requirements for both commands — specifically, their file generation and summary output sections.

## Impact

- **Code**: `src/core/scaffolder.ts` gains a new `writeGitignoreFile` function. `src/cli/commands/init.ts` and `src/cli/commands/update.ts` call it as an additional step.
- **Templates**: No template file needed — the `.gitignore` content is small and deterministic enough to generate inline (a single line: `table.csv.bak`).
- **Tests**: The integration test suite (`test/run-tests.ts`) should verify that `.nightshift/.gitignore` exists after init and contains the expected pattern.
- **Existing behavior**: No breaking changes. The new step runs after existing scaffolding and does not affect agent/command file generation.
