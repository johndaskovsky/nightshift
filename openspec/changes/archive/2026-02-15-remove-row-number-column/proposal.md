## Why

The `row` column in `table.csv` is a stored copy of positional information that CSV inherently provides. Since qsv operates on 0-based positional indices (via `qsv slice --index` and `qsv edit -i`), no data-access path actually reads the `row` column value. The system enforces "never reorder existing rows," so physical position and `row` value are always in lockstep. The only bridge between them is the conversion formula `qsv_index = row_number - 1`, which exists solely because `row` is 1-based while qsv is 0-based -- a constant source of mental overhead and potential off-by-one errors.

Removing `row` simplifies the data model, eliminates the conversion formula, reduces scaffolding in commands (`nightshift-create`, `nightshift-update-table`), and removes a convention that must be documented and maintained across specs, agents, and templates.

## What Changes

- **BREAKING**: Remove the `row` column from `table.csv`. Tables will contain only metadata columns and task status columns.
- **BREAKING**: Eliminate the `qsv_index = row_number - 1` conversion formula. Agents will use 0-based positional indices directly from qsv operations.
- Remove `{row}` from the set of available column-name placeholders in task step templates (it will no longer exist as a column).
- Update `nightshift-create` to scaffold `table.csv` without a `row` column.
- Update `nightshift-update-table` to stop maintaining sequential row numbering when appending rows.
- Update `nightshift-test-task` to prompt users with 0-based index or derive 1-based display labels from position rather than a stored column.
- Replace the single `qsv select row,<column>` command pattern with a positional alternative (e.g., `qsv select <column>` without row pairing, or use `qsv slice` for targeted reads).
- Update all agent delegation context to pass `qsv_index` directly (0-based positional) without conversion from a stored `row` value.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `nightshift-shifts`: Remove `row` column requirement from table file format. Remove row numbering scenario. Update table structure scenarios to omit `row`.
- `nightshift-commands`: Update `nightshift-create` to scaffold table without `row`. Update `nightshift-test-task` row selection to use positional index. Update `nightshift-update-table` to remove row numbering maintenance.
- `nightshift-agents`: Remove `row` references from manager delegation context. Update index calculation to use 0-based position directly. Update dev agent placeholder documentation.
- `qsv-csv-operations`: Remove `qsv_index = row_number - 1` conversion requirement. Update cell read operations to reference position directly. Replace `qsv select row,<column>` pattern.
- `nightshift-tasks`: Remove `{row}` from column placeholder examples if present.
- `test-runner`: Update `nightshift-create` test to expect table without `row` column.
- `task-template-variables`: No changes needed (`{row}` was just a column-name placeholder, and column-name placeholder syntax itself is unchanged -- `{row}` simply won't exist as a column anymore).
- `parallel-execution`: No changes needed (parallel execution references "rows" conceptually but does not depend on the `row` column).

## Impact

- **Templates**: `templates/agents/nightshift-manager.md`, `templates/agents/nightshift-dev.md`, `templates/commands/nightshift-create.md`, `templates/commands/nightshift-test-task.md`, `templates/commands/nightshift-update-table.md` all reference the `row` column and need updates.
- **Documentation**: `AGENTS.md` and `README.md` reference the `row` column convention.
- **Existing shifts**: Any active shifts in `.nightshift/` with a `row` column will continue to work (qsv ignores unused columns), but new shifts will not have one. No migration needed.
- **User-facing behavior**: `nightshift-test-task` prompt changes from "row number (1-N)" to a 0-based index or a derived 1-based display label.
