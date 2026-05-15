## Why

Maintaining two runtime surfaces (OpenCode and Claude Code) doubles the cost of every change: parallel templates, parallel agent prose, parallel integration tests, and parallel spec scenarios. Going forward we want to invest exclusively in the Claude Code integration, which is where the maintainer's own development happens and where the plugin distribution lives. Removing OpenCode now eliminates dead-weight branches in the scaffolder, simplifies the test runner, and lets new features ship without writing them twice.

## What Changes

- **BREAKING** Remove the `--target` flag from `nightshift init`. The command now installs Claude Code artifacts unconditionally; there is no auto-detection step and no `opencode`/`both` option.
- **BREAKING** Remove the `writeOpenCodeCommandFiles` export and the `"opencode"`/`"both"` values from the `Target` type. `Target` collapses to a single concept (Claude Code) and the type can be deleted.
- **BREAKING** Remove the `--runtime` flag and `NIGHTSHIFT_TEST_RUNTIMES` environment variable from `test/run-tests.ts`. Drop the runtime-selection abstraction; the integration suite runs Claude Code only.
- Delete the `templates/opencode/` directory (agents and slash commands).
- Delete OpenCode-specific tests: opencode regression cases in `test/init-tests.ts`, the OpenCode↔Claude prose-parity test, and any runtime-parameterized assertions in `test/run-tests.ts` collapse to Claude-only.
- Drop the `test:integration:opencode` and `test:integration:both` scripts from `package.json`. Drop the `"opencode"` keyword.
- Rename per-runtime benchmark keys in `test/benchmarks.json` (e.g. `nightshift-start.opencode` is deleted; `nightshift-start.claude` becomes `nightshift-start`).
- Update `README.md`, `AGENTS.md`, and the project's own `CLAUDE.md` (via templates) to describe a Claude-Code-only product. The Playwright (OpenCode) subsection is removed.
- Add a CHANGELOG entry documenting the removal and pointing OpenCode users at the last 1.x release.
- The maintainer-local `.opencode/` directory at the repo root (used as the maintainer's own editor config for opsx/openspec workflows on this repo) is out of scope and remains untouched.
- The historical OpenSpec archive under `openspec/changes/archive/` is unchanged — those records describe what shipped at the time.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `nightshift-installer`: Drop all OpenCode scaffolding requirements. Remove `--target`/auto-detection; `nightshift init` becomes a single-runtime command.
- `nightshift-agents`: Remove the requirement that Claude subagents mirror OpenCode subagents. The Claude subagents become the canonical definitions; cross-runtime parity language is dropped.
- `nightshift-commands`: Remove the requirement that Claude skills produce behavior identical to OpenCode slash commands. Skills become the canonical command surface; cross-runtime parity language is dropped.
- `claude-code-target`: Remove the "preserve cross-runtime semantics" requirement and any contrast-with-OpenCode language. This spec describes the only supported install surface, no longer "the Claude Code install surface".
- `test-runner`: Remove the runtime-selection requirements (`--runtime`, `NIGHTSHIFT_TEST_RUNTIMES`, per-runtime benchmark labels). Collapse to a Claude-only integration suite.

## Impact

- **Public CLI surface (BREAKING)**: `nightshift init --target=...` and the `Target` type / `writeOpenCodeCommandFiles` export disappear. Calls for a major version bump (1.1.0 → 2.0.0). Users who need OpenCode support stay on the 1.x line.
- **npm package contents**: `templates/opencode/` is excluded from the published tarball.
- **Test infrastructure**: `test/run-tests.ts` simplifies — the `Runtime` type, runtime detection, and per-runtime loop disappear. Integration tests run against Claude Code only.
- **Documentation**: README/AGENTS describe a single runtime. The Playwright section loses its OpenCode subsection.
- **Plugin manifest** (`.claude-plugin/plugin.json`): unaffected — already Claude-only.
- **Shift data on disk** (`.nightshift/<shift-name>/...`): unaffected — runtime-agnostic.
- **Existing users**: OpenCode users have no automated migration. They remain on 1.x (the last release with OpenCode support); the CHANGELOG entry points there explicitly.
