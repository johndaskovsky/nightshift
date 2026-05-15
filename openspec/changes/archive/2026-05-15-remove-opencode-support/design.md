## Context

Nightshift currently ships as a dual-runtime framework: an OpenCode build (`.opencode/agents/` + `.opencode/commands/`) and a Claude Code build (`.claude/agents/` + `.claude/skills/` + `.claude/settings.json` + `CLAUDE.md`). The CLI installer (`nightshift init`) accepts `--target=<claude|opencode|both>` (default: auto-detect from existing `.claude/`/`.opencode/` directories) and the integration test runner accepts `--runtime=<opencode|claude|both>` so the same fixtures run against both runtimes.

The maintainer's day-to-day work uses Claude Code, and the Claude Code Plugin is the preferred distribution channel going forward. OpenCode is no longer being exercised; keeping its scaffolder branches, templates, test scenarios, and spec scenarios alive is dead weight that slows every change.

This change removes the OpenCode runtime entirely. It is a breaking change to the CLI surface and warrants a 2.0.0 release.

## Goals / Non-Goals

**Goals:**

- A single install path: `nightshift init` (no flag) scaffolds Claude Code artifacts and the shared `.nightshift/` shift directory.
- A single test path: `pnpm test:integration` drives Claude Code only. `Runtime` type, `--runtime` flag, and `NIGHTSHIFT_TEST_RUNTIMES` env var are gone.
- A single template tree: `templates/claude/` is the only template directory. `templates/opencode/` is deleted.
- Single-runtime specs and docs: no comparative language ("identical to OpenCode", "mirrors OpenCode"), no auto-detect prose, no Playwright-for-OpenCode section.
- Clear upgrade signal: 2.0.0 release with a CHANGELOG entry that names the removal and tells OpenCode users to stay on the 1.x line.

**Non-Goals:**

- Migration tooling for existing OpenCode users. There is no scripted "convert your `.opencode/` install to `.claude/`" path — users keep using 1.x or run `nightshift init` fresh.
- Touching the maintainer's local `.opencode/` directory at the repo root. That's the maintainer's own editor configuration for working in *this* repo (opsx commands, openspec skills), not part of the published package. It stays.
- Touching the OpenSpec archive (`openspec/changes/archive/*`). Those files describe what shipped at the time and remain a historical record.
- Rewriting historical CHANGELOG entries. Entries that named OpenCode at the time of their release stay verbatim; only a new entry is added.

## Decisions

### 1. Remove the `--target` flag entirely rather than deprecating it

`nightshift init` accepts no `--target` flag in 2.0. Passing `--target=anything` produces commander's standard "unknown option" error.

**Alternatives considered:**

- *Accept `--target=claude` as a no-op, reject other values with a migration message.* Rejected — adds ~15 lines of glue and a "deprecated flag" warning code path. The maintainer has stated a preference against backwards-compat shims for one-runtime products.
- *Keep auto-detection logic and just disable OpenCode side-effects.* Rejected — auto-detection only existed to choose between two runtimes. With one runtime, the logic is dead weight.

**Why this works:** A major version bump (2.0.0) is the contract that breaks the CLI surface. Users who hit "unknown option" can read the CHANGELOG entry and either drop the flag or downgrade to 1.x.

### 2. Collapse `Target` type out of the public API rather than narrowing it

`Target` and `targetIncludes()` are removed from `src/index.ts` and `src/core/scaffolder.ts`. `resolveTarget()` is deleted (it has no purpose with one runtime). `writeOpenCodeCommandFiles` export is deleted.

**Alternatives considered:**

- *Keep `type Target = "claude"` for API stability.* Rejected — a single-value union is a code smell that signals "this used to be a choice." A future contributor will rightly delete it; doing so now is cleaner.

### 3. Test runner collapses to single-runtime without preserving the `Runtime` abstraction

`test/run-tests.ts` currently parameterizes every test over `Runtime = "opencode" | "claude"`. The refactor inlines `runtime = "claude"` everywhere: drop the type, drop the loop, drop the per-runtime test naming, drop `--runtime` parsing, drop `isCliAvailable("opencode")`, drop `NIGHTSHIFT_TEST_RUNTIMES`. Per-runtime benchmark keys like `nightshift-start.claude` lose their suffix and become `nightshift-start`.

**Alternatives considered:**

- *Keep `Runtime` as a typed alias for future-proofing.* Rejected — speculative; YAGNI.
- *Keep `.claude` suffix on benchmark keys.* Rejected — meaningless when there's only one runtime; readers will wonder what "claude" disambiguates.

**Migration of `test/benchmarks.json`:** The file's `nightshift-start.opencode` keys are deleted outright. `nightshift-start.claude` is renamed to `nightshift-start` (and similarly for the other three suffixed keys). Existing baseline numbers are preserved.

### 4. Template tree becomes flat under `templates/claude/`

`templates/opencode/` is deleted. `templates/claude/` keeps its current structure (`agents/`, `skills/`, `CLAUDE.md`, `settings.json`). The `getTemplatePath()` helper continues to take a target argument; the only valid value becomes `"claude"`. Once the helper has only one caller pattern, we delete the argument and inline the directory.

**Note on `package.json` `files` entry:** Currently `files: ["bin/", "dist/", "templates/", ".claude-plugin/", "agents/", "skills/"]`. Removing `templates/opencode/` shrinks the published tarball; the `templates/` glob automatically picks up the new state. No `files:` change required.

### 5. Documentation rewrite is wholesale, not patch-style

`README.md` and `AGENTS.md` are rewritten with OpenCode removed. The Playwright section keeps its Claude Code subsection only. The "Prerequisites" line drops "OpenCode **or**" and lists Claude Code as the only runtime. Project Layout no longer lists `templates/opencode/`.

The CHANGELOG entry for 2.0.0 names the removal at the top:

```
## [2.0.0] - 2026-MM-DD

### BREAKING
- Dropped OpenCode runtime support. Nightshift now installs exclusively for
  Claude Code; the `--target` flag is removed from `nightshift init` and the
  `--runtime`/`NIGHTSHIFT_TEST_RUNTIMES` selectors are removed from the
  integration test runner. Users who depend on OpenCode should stay on 1.1.x.
```

### 6. Spec deltas: MODIFIED for surviving requirements, REMOVED for dropped ones

Five specs (`nightshift-installer`, `nightshift-agents`, `nightshift-commands`, `claude-code-target`, `test-runner`) need delta files. The deltas use OpenSpec's `## REMOVED Requirements` and `## MODIFIED Requirements` sections to express "the old requirement said X, the new requirement says Y." When a current requirement bundles OpenCode-only scenarios alongside Claude scenarios, we MODIFY the requirement to drop the OpenCode scenarios; when an entire requirement only covered OpenCode-specific behavior, we REMOVE it.

## Risks / Trade-offs

- **[Risk] An OpenCode user pulls 2.0.0 and their workflow breaks.** → Mitigation: clear CHANGELOG entry naming 1.1.x as the supported line for OpenCode users; npm semver semantics mean they need to opt into the major bump explicitly.
- **[Risk] The test runner refactor accidentally drops coverage we wanted to keep.** → Mitigation: do the refactor mechanically — every assertion that ran under `runtime === "claude"` continues to run; only the loop and the `runtime === "opencode"` branch disappear. Validate by diffing test counts before/after.
- **[Risk] CHANGELOG entries that name OpenCode become misleading once the runtime is gone.** → Accepted as-is: historical entries describe what shipped *at that time*; rewriting them would be revisionist. The new 2.0.0 entry explicitly notes the removal.
- **[Risk] The maintainer's local `.opencode/` directory at repo root looks orphaned/confusing to outside contributors after the rename.** → Accepted: it's a `.gitignore`'d-by-pattern editor scratch space for opsx + openspec skills used while editing *this* repo. A short note in AGENTS.md (or leaving it as-is) is sufficient; it is not part of the published package.
- **[Trade-off] No deprecation period for the `--target` flag.** → A deprecation cycle would have value if there were many active OpenCode users with automated `nightshift init --target=opencode` invocations. Given the small user base and the major version bump, an immediate removal is cleaner than carrying a deprecation shim for a release we don't plan to ship.

## Migration Plan

1. Land all code/test/doc/spec changes on a single feature branch (`remove-opencode-support`) backed by this OpenSpec change.
2. Bump `package.json` version from `1.1.0` to `2.0.0`.
3. Run `pnpm build` and verify the published tarball no longer contains `templates/opencode/`.
4. Run `pnpm test` end-to-end against Claude Code.
5. Tag and publish `2.0.0`. The 1.1.x line remains on npm for OpenCode users.

## Open Questions

None — the explore conversation resolved scope decisions (`.opencode/` repo-root directory stays; `--target` flag removed entirely; v2.0.0; historical CHANGELOG untouched).
