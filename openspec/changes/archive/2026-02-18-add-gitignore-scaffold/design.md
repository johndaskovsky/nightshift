## Context

The `nightshift init` and `nightshift update` commands scaffold framework files into a target project. Currently they create directories (`.nightshift/archive/`, `.opencode/agent/`, `.opencode/command/`), write agent Markdown files from bundled templates, and write command Markdown files by scanning the templates directory. Neither command creates a `.gitignore` in the `.nightshift/` directory.

During shift execution, qsv operations produce `table.csv.bak` backup files alongside `table.csv`. These transient files should not be committed to version control. The existing spec for `task-template-variables` notes that `.nightshift/**/.env` should be gitignored, but no automation exists for this either.

## Goals / Non-Goals

**Goals:**

- Add a `.nightshift/.gitignore` file containing `table.csv.bak` to the scaffolding performed by both `init` and `update`
- Follow the same overwrite-on-every-run pattern used by agent and command file writes so the ignore list stays current across CLI upgrades
- Include the `.gitignore` file in the init/update summary output
- Keep the implementation minimal and consistent with existing scaffolder patterns

**Non-Goals:**

- Managing `.gitignore` entries in the project root (users handle their own root `.gitignore`)
- Supporting user-customizable ignore patterns or merge logic (the file is framework-managed and overwritten each run)
- Adding `.env` patterns to this `.gitignore` (can be addressed separately if needed)

## Decisions

### Decision 1: Generate content inline rather than using a template file

The `.gitignore` content is a single line (`table.csv.bak`). Adding a template file to `templates/` for this would add packaging and resolution overhead for trivial content. The scaffolder will generate the content as a string constant.

**Alternatives considered:**
- Template file in `templates/gitignore` — adds a file, a template resolution path, and template-reading logic for a single line. Rejected as over-engineered.

### Decision 2: New `writeGitignoreFile` function in `scaffolder.ts`

The new function follows the same signature pattern as `writeAgentFiles` and `writeCommandFiles` — it accepts `ScaffoldOptions`, returns `ScaffoldResult`, and uses the `onWrite` callback to report its action. This keeps the scaffolder API consistent.

**Alternatives considered:**
- Inline the write directly in `init.ts` and `update.ts` — duplicates logic across two files and breaks the pattern of all file writes living in the scaffolder module. Rejected.

### Decision 3: Place `.gitignore` at `.nightshift/.gitignore` (not per-shift)

A single `.gitignore` at the `.nightshift/` root covers all shift subdirectories via Git's cascading ignore rules. `table.csv.bak` at this level matches `table.csv.bak` in any nested shift directory.

**Alternatives considered:**
- Per-shift `.gitignore` — would require writing a file into each shift directory, which is managed by the manager agent at runtime, not by the installer. Also redundant since Git cascades ignore rules downward. Rejected.

### Decision 4: Overwrite on every run (no merge)

Consistent with agent and command files, the `.gitignore` is framework-managed and overwritten on every `init`/`update`. This ensures the ignore list reflects the current CLI version's expectations. Users who need additional ignore patterns can add them to the project root `.gitignore` or a shift-level `.gitignore`.

## Risks / Trade-offs

- [Overwrite removes user edits] If a user manually adds patterns to `.nightshift/.gitignore`, running `init` or `update` will silently replace them. **Mitigation**: This is consistent with how agent and command files work. Document that this file is framework-managed. Users can add custom patterns to the project root `.gitignore` instead.
- [Single pattern may be insufficient long-term] Only `table.csv.bak` is included initially. Future qsv or agent operations may produce other transient files. **Mitigation**: The overwrite-on-every-run pattern means new patterns can be added in future CLI versions and will propagate on `update`.
