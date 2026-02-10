## 1. Gitignore and Shift Directory Setup

- [x] 1.1 Add `.nightshift/**/.env` pattern to the root `.gitignore` file
- [x] 1.2 Update the `/nightshift-create` command to mention `.env` file support in the scaffolded shift directory (optional: scaffold an empty `.env` with a comment header)

## 2. Update Dev Agent Placeholder Substitution

- [x] 2.1 Update the "Substitute Placeholders" section (section 2) in `.opencode/agent/nightshift-dev.md` to document `{ENV:VAR_NAME}` placeholder syntax — describe how the dev agent reads env variables from the delegation prompt and substitutes them in steps
- [x] 2.2 Update the "Substitute Placeholders" section in `.opencode/agent/nightshift-dev.md` to document `{SHIFT:FOLDER}` and `{SHIFT:NAME}` placeholder syntax — describe resolution to the shift directory path and shift name respectively
- [x] 2.3 Add error handling instructions to the dev agent for: missing env variable, missing `.env` file when `{ENV:*}` is used, and unrecognized `{SHIFT:*}` key
- [x] 2.4 Update the "Input" section of `.opencode/agent/nightshift-dev.md` to document that the dev agent now receives environment variables and shift metadata from the manager

## 3. Update Manager Agent Delegation

- [x] 3.1 Update the "Delegate to Dev" section (section 4) in `.opencode/agent/nightshift-manager.md` to read the shift's `.env` file (if it exists) and include the key-value pairs in the dev agent delegation prompt
- [x] 3.2 Update the "Delegate to Dev" prompt template in `.opencode/agent/nightshift-manager.md` to include an `## Environment Variables` section (from `.env`) and a `## Shift Metadata` section (with `FOLDER` and `NAME`)
- [x] 3.3 Update the "Read Shift State" section (section 1) in `.opencode/agent/nightshift-manager.md` to include reading the `.env` file alongside `manager.md` and `table.csv`

## 4. Update Specs (Main Specs)

- [x] 4.1 Update `openspec/specs/nightshift-tasks/spec.md` — sync the modified "Task steps section" requirement to include `{ENV:*}` and `{SHIFT:*}` placeholder scenarios
- [x] 4.2 Update `openspec/specs/nightshift-agents/spec.md` — sync the modified "Dev agent role" and "Manager agent role" requirements to include env variable and shift metadata handling
- [x] 4.3 Update `openspec/specs/nightshift-shifts/spec.md` — sync the modified "Shift directory structure" requirement to include the optional `.env` file
- [x] 4.4 Create `openspec/specs/task-template-variables/spec.md` — add the new capability spec covering `.env` format, `{ENV:*}` resolution, `{SHIFT:*}` resolution, single-pass substitution, and gitignore requirements

## 5. Verification

- [x] 5.1 Verify that the dev agent documentation correctly describes all three placeholder types with examples and error cases
- [x] 5.2 Verify that the manager agent delegation prompt template includes environment variables and shift metadata sections
- [x] 5.3 Verify that `.gitignore` contains the `.nightshift/**/.env` pattern
- [x] 5.4 Verify backward compatibility — confirm that existing `{column_name}` syntax documentation is preserved unchanged in all modified files
