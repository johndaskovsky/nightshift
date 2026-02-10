## Context

Task steps currently support a single placeholder syntax: `{column_name}`, which resolves to values from the current table row's metadata columns. The dev agent performs this substitution in its "Substitute Placeholders" step before executing task steps. The manager passes all column values as key-value pairs when delegating to the dev agent.

This system has no mechanism for injecting values that are not in the table — secrets, environment-specific URLs, or shift-level metadata. Task authors must hardcode these values or rely on convention (e.g., referencing the shift directory path as a literal string).

The relevant implementation files are:
- `.opencode/agent/nightshift-dev.md` — Section "2. Substitute Placeholders" (lines 55-61)
- `.opencode/agent/nightshift-manager.md` — Section "4. Delegate to Dev" (lines 78-116)
- `.nightshift/<shift-name>/` — shift directory structure
- `openspec/specs/nightshift-tasks/spec.md` — placeholder specification
- `openspec/specs/nightshift-agents/spec.md` — dev agent execution specification

## Goals / Non-Goals

**Goals:**
- Enable task authors to reference environment-specific values (API keys, base URLs) via `{ENV:VAR_NAME}` syntax
- Enable task authors to reference shift metadata via `{SHIFT:FOLDER}` and `{SHIFT:NAME}` syntax
- Maintain backward compatibility with existing `{column_name}` placeholders
- Keep secrets out of version control via gitignored per-shift `.env` files
- Define clear error semantics for missing or unresolvable variables

**Non-Goals:**
- Dynamic variable computation or expression evaluation (no `{ENV:BASE_URL}/path` concatenation beyond simple substitution)
- Nested variable resolution (no `{ENV:{column_name}}`)
- Variable definitions in `manager.md` or `table.csv` — environment variables live only in `.env`
- Encryption or secret management beyond gitignore
- Changing how the QA agent receives context — QA does not execute steps and does not need variable resolution

## Decisions

### Decision 1: Per-shift `.env` file location

**Choice**: Place `.env` at `.nightshift/<shift-name>/.env` — one per shift directory.

**Alternatives considered**:
- Single global `.nightshift/.env` shared across shifts — rejected because shifts may target different environments or need different credentials. Per-shift scoping is more flexible.
- Environment variables from the host shell — rejected because agents run in sandboxed contexts and cannot reliably access shell environment variables.

**Rationale**: Per-shift `.env` files are simple, familiar (dotenv convention), and naturally scope secrets to the shift that needs them.

### Decision 2: `.env` file format

**Choice**: Standard dotenv format — one `KEY=VALUE` per line, `#` for comments, no multiline values.

```
# API credentials
API_KEY=sk-1234567890
BASE_URL=https://api.example.com

# CMS config
CMS_TOKEN=abc123
```

**Rationale**: Dotenv is universally understood, requires no parser library (simple line-by-line split on first `=`), and matches the existing `.env` convention mentioned in `openspec/project.md`.

### Decision 3: Placeholder syntax with prefixed namespaces

**Choice**: Use `{PREFIX:KEY}` syntax for new variable types, keeping unprefixed `{column_name}` for backward compatibility.

| Syntax | Resolves to | Source |
|--------|-------------|--------|
| `{column_name}` | Table row column value | `table.csv` row data |
| `{ENV:VAR_NAME}` | Environment variable value | `.nightshift/<shift>/.env` |
| `{SHIFT:FOLDER}` | Shift directory path | Computed from shift name |
| `{SHIFT:NAME}` | Shift name | From `manager.md` config |

**Alternatives considered**:
- Unified prefix for all types (e.g., `{COL:name}`, `{ENV:name}`, `{SHIFT:name}`) — rejected because it would be a breaking change to existing `{column_name}` syntax.
- Double-brace syntax (`{{ENV:name}}`) — rejected because it adds complexity with no benefit; the `PREFIX:` namespace already disambiguates.

**Rationale**: The prefix-colon namespace is unambiguous, extensible (future prefixes could be added), and preserves existing behavior for unprefixed placeholders.

### Decision 4: Variable resolution order in the dev agent

**Choice**: The dev agent resolves variables in this order during the "Substitute Placeholders" step:

1. `{SHIFT:*}` — shift metadata (always available, computed)
2. `{ENV:*}` — environment variables (from `.env` file, may be absent)
3. `{column_name}` — table row data (from item data passed by manager)

All three types are resolved in a single pass over the Steps text. Resolution order does not affect behavior since namespaces prevent collisions.

**Rationale**: Single-pass substitution is simple and predictable. The namespacing eliminates any ambiguity about which source a value comes from.

### Decision 5: Error handling for missing variables

**Choice**: Missing variables are hard errors that halt execution immediately (same as current behavior for missing `{column_name}`).

| Scenario | Behavior |
|----------|----------|
| `{ENV:VAR_NAME}` but `.env` has no `VAR_NAME` | Error: report missing env variable |
| `{ENV:VAR_NAME}` but no `.env` file exists | Error: report missing `.env` file |
| `{SHIFT:UNKNOWN}` with unrecognized key | Error: report unknown shift variable (only `FOLDER` and `NAME` are valid) |
| `{column_name}` with missing column | Error: report missing column (existing behavior) |

**Alternatives considered**:
- Default to empty string for missing env variables — rejected because silent failures are worse than explicit errors, especially for secrets.
- Warning + continue — rejected for the same reason.

**Rationale**: Fail-fast aligns with existing behavior and prevents tasks from running with missing critical values.

### Decision 6: Manager passes `.env` contents to dev agent

**Choice**: The manager reads the `.env` file (if it exists) and passes the key-value pairs to the dev agent as part of the delegation prompt, alongside item data.

**Alternatives considered**:
- Have the dev agent read the `.env` file itself — rejected because the dev agent currently receives all context from the manager. Having the dev read files outside its delegation scope breaks the clean separation of concerns.

**Rationale**: Keeps the manager as the sole context provider. The dev agent receives everything it needs in the prompt without needing to know about shift-level file structure.

### Decision 7: Gitignore pattern

**Choice**: Add `.nightshift/**/.env` to the root `.gitignore`.

**Rationale**: Glob pattern covers all current and future shift directories. Uses `**/` to match at any nesting depth within `.nightshift/`.

## Risks / Trade-offs

- **[Risk] `.env` file not created before shift start** → The system only errors when a task actually uses `{ENV:*}` placeholders. A shift with no `{ENV:*}` references runs fine without a `.env` file. The `/nightshift-create` command could scaffold an empty `.env` with a comment, but this is optional.

- **[Risk] Large `.env` files bloating dev agent prompts** → Since `.env` contents are passed in the delegation prompt, very large files could waste context. Mitigation: this is unlikely for the intended use case (a handful of API keys). No size limit is enforced for now.

- **[Risk] Variable name collisions between column names and env vars** → Not possible due to namespace prefixes. `{url}` is always a column, `{ENV:URL}` is always an env var.

- **[Trade-off] No `.env` validation at shift creation time** → The system does not check whether all `{ENV:*}` references in task files have corresponding entries in `.env` until runtime. This is consistent with how `{column_name}` works today (validated at substitution time, not authoring time).
