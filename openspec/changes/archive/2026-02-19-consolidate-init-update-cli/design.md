## Context

The Nightshift CLI exposes two subcommands: `nightshift init` and `nightshift update`. Both call the same four scaffolder functions (`scaffoldDirectories`, `writeAgentFiles`, `writeCommandFiles`, `writeGitignoreFile`) and produce identical results. The `update` command was intended to be the "re-run after upgrading the CLI" path, but the implementation diverged from intent: both commands unconditionally overwrite all framework-managed files, making them functionally identical. The `--force` flag on `init` is accepted but never consumed by the scaffolder, and `--yes` is accepted by both commands but neither prompts the user.

The codebase currently has:
- `src/cli/commands/init.ts` (136 lines) -- accepts `--force` and `--yes`, passes `force` to scaffolder (ignored)
- `src/cli/commands/update.ts` (130 lines) -- accepts `--yes`, hardcodes `force: true` (also ignored)
- `src/core/scaffolder.ts` -- `ScaffoldOptions.force` is defined but never read; `existsSync` checks are only for labeling ("created" vs "updated")
- `src/cli/index.ts` -- registers both commands

## Goals / Non-Goals

**Goals:**

- Consolidate to a single `nightshift init` command that handles both first-time setup and upgrades
- Remove ~130 lines of duplicated code (`update.ts`)
- Remove dead-code flags (`--force`, `--yes`) and the unused `force` field from `ScaffoldOptions`
- Add first-run detection so `init` adjusts its messaging: "Initializing..." + Next Steps on first run, "Updating..." + "Update complete." on re-run
- Update documentation (README.md, AGENTS.md) and specs to reflect the single-command model

**Non-Goals:**

- Implementing actual skip-existing-files behavior (if desired in the future, that's a separate change)
- Adding prompts or confirmation dialogs (the current commands don't prompt; keeping that)
- Changing the scaffolder's overwrite-always behavior (this is the correct behavior for framework-managed files)
- Changing the test suite (tests already only exercise `init`)

## Decisions

### 1. First-run detection mechanism

**Decision**: Check for the existence of `.opencode/agent/nightshift-manager.md` in the target directory. If it exists, this is a re-run; if not, this is a fresh init.

**Alternatives considered**:
- Check for `.nightshift/` directory -- less precise; the directory could exist without Nightshift being properly initialized
- Check for any `.opencode/` content -- too broad; other OpenCode tools may create this directory
- Use a version marker file (`.nightshift/.version`) -- adds complexity for marginal benefit; introduces a new file to manage

**Rationale**: The manager agent file is the most specific indicator of a completed Nightshift installation. It's written during init and is framework-managed (always overwritten), making it a reliable sentinel.

### 2. Messaging behavior based on detection

**Decision**: The `init` command will use two messaging modes:

| Mode | Banner | Dir spinner | File spinners | Footer |
|------|--------|-------------|---------------|--------|
| First run | "Initializing Nightshift..." | "Creating directories..." | "Writing agent/command files..." | "--- Next Steps ---" section |
| Re-run | "Updating Nightshift files..." | "Ensuring directories..." | "Updating agent/command files..." | "Update complete." |

**Rationale**: Preserves the user experience distinction that the two-command model provided, without requiring two commands. Users see contextually appropriate messaging.

### 3. Remove flags entirely rather than keeping as no-ops

**Decision**: Remove `--force` and `--yes` from the CLI interface. Remove `force` from `ScaffoldOptions`.

**Alternatives considered**:
- Keep flags as accepted no-ops for backward compatibility -- misleading; suggests behavior that doesn't exist
- Implement `--force` properly (skip existing files by default, overwrite with flag) -- out of scope; changes the fundamental scaffolding behavior and would be a separate change

**Rationale**: Dead flags create a misleading API surface. Removing them is honest and clean. Since `nightshift update` is also being removed (the primary "upgrade" path), there's no backward-compat scenario where users rely on these flags.

### 4. Delete update.ts rather than refactoring into init.ts

**Decision**: Delete `src/cli/commands/update.ts` entirely and modify `init.ts` to incorporate the first-run detection logic.

**Rationale**: The update command has no unique logic worth preserving. All functional code already exists in `init.ts` and the shared scaffolder. The first-run detection is a small addition (~10 lines) to `init.ts`.

## Risks / Trade-offs

- [Breaking change for `nightshift update` users] Anyone with `nightshift update` in scripts or CI will get an unknown command error. **Mitigation**: This is a v1.0 package with a small user base. The migration is trivial: replace `nightshift update` with `nightshift init`. Document the breaking change in release notes.
- [First-run detection false positive] If `.opencode/agent/nightshift-manager.md` exists from a non-Nightshift source, the messaging will say "Updating" on what is actually a first-time init. **Mitigation**: The file name is Nightshift-specific; false positives are extremely unlikely. The functional outcome is identical regardless of messaging mode.
- [Specs reference `nightshift update`] Multiple spec files and archived changes reference the update command. **Mitigation**: Delta specs will remove/modify the relevant requirements. Archived changes are historical records and don't need updating.
