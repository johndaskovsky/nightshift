### Requirement: git-cliff configuration for non-conventional commits
The system SHALL include a `cliff.toml` at the repository root that configures git-cliff to parse the project's imperative-mood commit messages using regex-based commit parsers. The configuration SHALL categorize commits into groups based on their leading verb (e.g., "Add" as additions, "Fix" as fixes, "Remove" as removals). Commits that match no category SHALL appear under an "Other" group. Version-only commits (e.g., "0.1.3") SHALL be skipped.

#### Scenario: Addition commits are categorized
- **WHEN** git-cliff processes a commit with a message starting with "Add"
- **THEN** the commit SHALL appear under an "Added" group in the changelog output

#### Scenario: Fix commits are categorized
- **WHEN** git-cliff processes a commit with a message starting with "Fix" or "Correct"
- **THEN** the commit SHALL appear under a "Fixed" group in the changelog output

#### Scenario: Removal commits are categorized
- **WHEN** git-cliff processes a commit with a message starting with "Remove"
- **THEN** the commit SHALL appear under a "Removed" group in the changelog output

#### Scenario: Change commits are categorized
- **WHEN** git-cliff processes a commit with a message starting with "Update", "Switch", "Refactor", or "Rename"
- **THEN** the commit SHALL appear under a "Changed" group in the changelog output

#### Scenario: Support commits are categorized
- **WHEN** git-cliff processes a commit with a message starting with "Support" or "Integrate"
- **THEN** the commit SHALL appear under an "Added" group in the changelog output

#### Scenario: Uncategorized commits fall through
- **WHEN** git-cliff processes a commit that does not match any defined parser pattern
- **THEN** the commit SHALL appear under an "Other" group in the changelog output

#### Scenario: Version-only commits are skipped
- **WHEN** git-cliff processes a commit whose message is only a version string (e.g., "0.1.3")
- **THEN** the commit SHALL be excluded from the changelog output

#### Scenario: Merge commits are skipped
- **WHEN** git-cliff processes a merge commit (message starting with "Merge")
- **THEN** the commit SHALL be excluded from the changelog output

### Requirement: GitHub Actions release workflow
The system SHALL include a GitHub Actions workflow at `.github/workflows/release.yml` that triggers when a tag matching `v*` is pushed. The workflow SHALL use git-cliff to generate release notes for the tagged version and create a GitHub Release with those notes.

#### Scenario: Tag push triggers release workflow
- **WHEN** a tag matching the pattern `v*` (e.g., `v0.2.0`) is pushed to the repository
- **THEN** the release workflow SHALL execute automatically

#### Scenario: Non-tag pushes do not trigger workflow
- **WHEN** a regular commit is pushed to any branch without a tag
- **THEN** the release workflow SHALL NOT execute

#### Scenario: Release notes are generated for the tagged version
- **WHEN** the release workflow executes for tag `v0.2.0`
- **THEN** git-cliff SHALL generate a changelog covering only the commits between the previous tag and `v0.2.0`

#### Scenario: GitHub Release is created
- **WHEN** the release workflow completes changelog generation
- **THEN** a GitHub Release SHALL be created using the tag name as the release title, with the generated changelog as the release body

#### Scenario: CHANGELOG.md is updated in the release
- **WHEN** the release workflow executes
- **THEN** the workflow SHALL update `CHANGELOG.md` in the repository with the full cumulative changelog and commit it back to the default branch

### Requirement: Initial changelog generation
The system SHALL include a `CHANGELOG.md` at the repository root that is generated from existing commit history using git-cliff. The changelog SHALL cover all tagged versions.

#### Scenario: Changelog covers existing tags
- **WHEN** git-cliff generates the initial changelog
- **THEN** the output SHALL include sections for each existing tag (`v0.1.1`, `v0.1.2`, `v0.1.3`) with their respective commits categorized by group

#### Scenario: Changelog is committed to repository
- **WHEN** the initial changelog is generated
- **THEN** `CHANGELOG.md` SHALL be committed to the repository root as part of this change's implementation
