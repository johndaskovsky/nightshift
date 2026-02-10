## Why

Task steps currently only support `{column_name}` placeholders backed by table row data. There is no way to inject environment-specific secrets (API keys, base URLs, credentials) or reference shift-level metadata (folder path, shift name) in task definitions. This forces task authors to hardcode values or rely on the agent to infer paths, making tasks less portable and reusable across shifts and environments.

## What Changes

- Add per-shift `.env` file support — each shift directory (`.nightshift/<name>/`) gets its own `.env` file for key-value environment variables
- Gitignore all shift `.env` files so secrets never enter version control
- Introduce `{ENV:VAR_NAME}` placeholder syntax in task steps to reference environment variables from the shift's `.env` file
- Introduce `{SHIFT:FOLDER}` placeholder to resolve to the shift directory path (e.g., `.nightshift/create-promo-examples/`)
- Introduce `{SHIFT:NAME}` placeholder to resolve to the shift name (e.g., `create-promo-examples`)
- Extend the dev agent's placeholder substitution logic to handle all three variable types alongside existing `{column_name}` placeholders
- Define clear error behavior for missing environment variables and unknown variable types

## Capabilities

### New Capabilities
- `task-template-variables`: Template variable system for task definitions — covers `.env` file format, `{ENV:*}` placeholder resolution, `{SHIFT:*}` placeholder resolution, variable precedence rules, and error handling for missing variables

### Modified Capabilities
- `nightshift-tasks`: Task steps placeholder syntax is expanding from `{column_name}` only to include `{ENV:VAR_NAME}` and `{SHIFT:*}` prefixed variable types
- `nightshift-agents`: Dev agent placeholder substitution process must handle the new variable types in addition to column name placeholders
- `nightshift-shifts`: Shift directory structure gains a new optional `.env` file and gitignore requirements

## Impact

- **Agent definitions**: `nightshift-dev.md` placeholder substitution section must be updated to resolve `{ENV:*}` and `{SHIFT:*}` variables
- **Agent definitions**: `nightshift-manager.md` delegation prompt must pass the shift `.env` file path (or contents) to the dev agent
- **Gitignore**: `.nightshift/**/.env` must be added to `.gitignore`
- **Task files**: No changes to existing task files — new syntax is additive and opt-in
- **Commands**: `/nightshift-create` may scaffold an empty `.env` file; `/nightshift-add-task` documentation should mention available variable types
- **No breaking changes**: Existing `{column_name}` syntax is unaffected
