## Why

The `nightshift init` and `nightshift update` CLI commands are functionally identical. Both execute the same four scaffolding steps (create directories, write agent files, write command files, write .gitignore), call the same scaffolder functions, and unconditionally overwrite all files. The `--force` flag accepted by `init` is dead code (the scaffolder never reads it), and the `--yes` flag on both commands is also dead code (neither command ever prompts the user). The only differences are cosmetic: banner text, spinner labels, and footer messaging. Maintaining two commands with ~130 lines of duplicated logic creates maintenance burden, a misleading API surface (two commands that suggest different behavior but do the same thing), and dead-code flags that imply safeguards that don't exist.

## What Changes

- **BREAKING**: Remove the `nightshift update` subcommand entirely. Users should use `nightshift init` for both initial setup and upgrades.
- Remove the `--force` and `--yes` flags from `nightshift init` (dead code -- never consumed by scaffolder, no prompts exist).
- Remove the `force` field from the `ScaffoldOptions` interface in the scaffolder (never read by any function).
- Add first-run detection to `nightshift init`: detect whether Nightshift is already set up (check for `.opencode/agent/nightshift-manager.md`) and adjust messaging accordingly ("Initializing..." + Next Steps on first run, "Updating..." + "Update complete." on subsequent runs).
- Delete `src/cli/commands/update.ts`.
- Update `src/cli/index.ts` to remove the update command registration.
- Update `README.md` to remove all `nightshift update` references and update the Installation section.
- Update `AGENTS.md` to remove `nightshift update` references.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `nightshift-installer`: Remove all update command requirements. Fold idempotency and re-run behavior into the init command. Remove `--force` and `--yes` flag requirements. Add first-run detection requirement.
- `cli-dependency-verification`: Simplify "init or update" references to just "init" since the update command no longer exists.

## Impact

- **Code**: `src/cli/commands/update.ts` deleted. `src/cli/commands/init.ts`, `src/cli/index.ts`, `src/core/scaffolder.ts` modified. `src/index.ts` unaffected (does not export update).
- **CLI API**: `nightshift update` no longer available. **Breaking** for anyone with `nightshift update` in scripts or documentation.
- **Tests**: No changes needed -- tests only exercise `init`, never `update`.
- **Documentation**: `README.md` and `AGENTS.md` updated to remove update references.
- **Dependencies**: No changes to package dependencies.
