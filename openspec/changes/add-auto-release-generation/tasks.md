## 1. git-cliff Configuration

- [x] 1.1 Create `cliff.toml` at the repository root with regex-based commit parsers matching the project's imperative-mood verbs (Add, Fix, Remove, Update, Switch, Refactor, Rename, Integrate, Support, Correct)
- [x] 1.2 Configure commit parser skip rules for version-only commits (e.g., "0.1.3") and merge commits
- [x] 1.3 Configure changelog body template using Keep a Changelog groups (Added, Changed, Fixed, Removed, Other)
- [x] 1.4 Add a skip rule or `.cliffignore` pattern for automated changelog commits (messages containing `[skip ci]` or `chore(release)`)

## 2. Initial Changelog

- [x] 2.1 Generate `CHANGELOG.md` at the repository root from existing commit history covering all tagged versions (`v0.1.1`, `v0.1.2`, `v0.1.3`)
- [x] 2.2 Verify the generated changelog correctly categorizes existing commits into the expected groups

## 3. GitHub Actions Release Workflow

- [x] 3.1 Create `.github/workflows/release.yml` triggered on tag pushes matching `v*`
- [x] 3.2 Add a job step using `orhun/git-cliff-action` to generate release notes for the tagged version (`--latest` flag)
- [x] 3.3 Add a job step to create a GitHub Release using the tag name as title and generated changelog as body
- [x] 3.4 Add a job step to update `CHANGELOG.md` with the full cumulative changelog and commit it back to the default branch with `[skip ci]` in the commit message
- [x] 3.5 Configure the workflow with appropriate permissions (`contents: write`) for creating releases and pushing commits
