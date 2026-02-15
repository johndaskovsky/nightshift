## Context

The Nightshift project has no CI/CD, no changelog, and no automated release process. Version tags (`v0.1.1` through `v0.1.3`) exist but produce no GitHub Releases. The project uses imperative-mood commit messages without conventional commit prefixes -- commit messages start with verbs like "Add", "Fix", "Remove", "Update", "Switch", "Integrate", "Support", "Correct".

## Goals / Non-Goals

**Goals:**

- Automatically generate a GitHub Release with categorized changelog when a version tag is pushed
- Configure git-cliff to parse the project's non-conventional commit style using regex-based parsers
- Generate an initial `CHANGELOG.md` from existing history
- Keep the workflow minimal and self-contained (no complex CI pipeline)

**Non-Goals:**

- Automated version bumping or semver calculation -- versions are managed manually via `package.json` and tags
- npm publishing -- the existing `prepublishOnly` script handles that separately
- Branch protection, PR-based releases, or multi-environment deployment
- Conventional commits adoption -- the project retains its current commit style

## Decisions

### Decision 1: Use `orhun/git-cliff-action` GitHub Action

Use the official `orhun/git-cliff-action` rather than installing git-cliff as a binary or npm dependency.

**Rationale**: The Action handles installation, caching, and execution in one step. No local dependency needed. The project already has no CI, so there is no existing pattern to conflict with.

**Alternatives considered**:
- Installing git-cliff via cargo in CI: slower, requires Rust toolchain
- Using git-cliff npm package (`git-cliff-linux`): adds a dev dependency and platform-specific binary
- Writing a custom changelog script: unnecessary when git-cliff already supports regex parsers

### Decision 2: Regex-based commit parsers in `cliff.toml`

Configure `commit_parsers` with regex patterns matching leading verbs to categorize commits into Keep a Changelog groups (Added, Changed, Fixed, Removed, Other).

**Pattern mapping:**

| Regex | Group |
|---|---|
| `^Add\|^Integrate\|^Support` | Added |
| `^Update\|^Switch\|^Refactor\|^Rename` | Changed |
| `^Fix\|^Correct` | Fixed |
| `^Remove` | Removed |
| `^Merge` | (skip) |
| `^\d+\.\d+` | (skip) |
| `.*` | Other |

**Rationale**: The project's commit log consistently uses imperative-mood verbs. These patterns capture the dominant verbs from the existing 20-commit history. The catch-all "Other" group ensures no commits are silently dropped.

**Alternatives considered**:
- Adopting conventional commits: rejected -- user explicitly stated the project does not use them
- Single "Changes" group with no categorization: loses the value of structured changelogs

### Decision 3: Workflow updates `CHANGELOG.md` via commit

The release workflow generates the full changelog and commits the updated `CHANGELOG.md` back to the default branch after creating the GitHub Release.

**Rationale**: Keeps the repository's `CHANGELOG.md` always in sync with releases. Users browsing the repo (not just GitHub Releases) can see the full history.

**Alternatives considered**:
- Only attach changelog to the GitHub Release (no file): users cloning the repo would have no changelog
- Require manual changelog updates: defeats the purpose of automation

### Decision 4: Tag pattern `v*` with tag message as optional context

The workflow triggers on tags matching `v*`. The tag name becomes the release title. The changelog is scoped to commits between the previous tag and the current one (git-cliff's `--latest` flag).

**Rationale**: Matches the existing tagging convention (`v0.1.1`, `v0.1.2`, `v0.1.3`). Using `--latest` ensures only the new version's changes appear in the GitHub Release body while `--output` updates the full cumulative file.

## Risks / Trade-offs

- **[Incomplete verb coverage]** New commit verbs not in the parser list will fall into "Other". This is acceptable -- the catch-all prevents data loss, and parsers can be extended later.
- **[Workflow commit creates noise]** The changelog commit back to `main` adds an automated commit to the history. Mitigated by using `[skip ci]` in the commit message and filtering these commits from future changelogs via `.cliffignore` or commit parser skip rule.
- **[No tag validation]** The workflow does not validate that the tag matches `package.json` version. This is a non-goal for now -- version management remains manual.
- **[First-run bootstrap]** The initial `CHANGELOG.md` must be generated manually as part of implementation since the workflow only runs on new tag pushes. This is a one-time task.
