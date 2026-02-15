## Context

The Nightshift framework uses `table.csv` as the canonical data store for shift items. Every table currently has a `row` column as its first column containing sequential 1-based integers (1, 2, 3, ...). All actual data operations use qsv, which addresses rows by 0-based positional index. The system bridges these two numbering systems with the formula `qsv_index = row_number - 1`.

The system enforces that rows are never reordered or deleted during execution, which means physical CSV position and the `row` column value are always equivalent (offset by 1). The `row` column is therefore redundant -- it stores information that CSV structure already provides.

The `row` column is referenced across 6 specs, 5 template files, and 2 documentation files. It affects the manager agent (delegation context, index conversion), dev agent (placeholder resolution), commands (scaffolding, user prompts, row numbering maintenance), and qsv operation patterns.

## Goals / Non-Goals

**Goals:**
- Remove the `row` column from the table data model entirely
- Eliminate the `qsv_index = row_number - 1` conversion formula from all agents and documentation
- Simplify command scaffolding (`nightshift-create` no longer seeds `row`, `nightshift-update-table` no longer maintains numbering)
- Update the `qsv select row,<column>` pattern to work without a `row` column
- Maintain backward compatibility with existing active shifts (qsv ignores extra columns)

**Non-Goals:**
- Migrating existing active shifts to remove their `row` columns (they continue to work as-is)
- Adding a replacement identifier column (position is sufficient)
- Changing qsv's 0-based indexing behavior
- Modifying the `{column_name}` placeholder syntax itself (only `{row}` ceases to exist as a valid column)

## Decisions

### Decision 1: Use 0-based positional index everywhere

**Choice**: Agents will work with 0-based qsv positional indices directly, with no stored identifier column.

**Rationale**: qsv natively uses 0-based indices for `slice --index` and `edit -i`. Eliminating the conversion layer removes a class of off-by-one errors and simplifies every agent's mental model. The manager already computes `qsv_index` before delegation -- now that value IS the index, not a derived one.

**Alternative considered**: Replace `row` with a 0-based `index` column. Rejected because it would still be a stored copy of positional information -- the same redundancy problem in different clothing.

### Decision 2: Replace `qsv select row,<column>` with `qsv select <column>`

**Choice**: The single `qsv select row,<column>` pattern (used to read a column across all rows paired with row identifiers) will be replaced with `qsv select <column>` alone.

**Rationale**: The `row` pairing was used for human-readable output showing which value belongs to which row. Without the `row` column, qsv output is still ordered by position, so the pairing is implicit. If agents need to correlate values with positions, they can use `qsv slice` for targeted reads or `qsv search` output which includes positional context.

**Alternative considered**: Use `qsv enum` to dynamically add a row number during reads. Rejected as unnecessary complexity -- the use case for `row,<column>` pairing is narrow (manager reading status overview), and `qsv search --select <column>` already provides what the manager actually needs (filtering by status value).

### Decision 3: Use 1-based display labels for user-facing prompts

**Choice**: `nightshift-test-task` will present item numbers as 1-based to users (derived from position + 1) but convert to 0-based for qsv operations internally.

**Rationale**: Users expect 1-based numbering ("item 1, 2, 3"). The conversion is trivial (display = position + 1, qsv_index = display - 1) and contained to one location (the test-task command). This is a UI concern, not a data model concern.

**Alternative considered**: Show 0-based indices to users. Rejected as unintuitive -- "test item 0" is confusing.

### Decision 4: No migration for existing shifts

**Choice**: Existing active shifts with a `row` column will continue to work without modification. qsv ignores columns that aren't referenced by name in operations, and all operations use positional indices.

**Rationale**: The `row` column is inert in existing tables -- no qsv command reads it by value. Its presence causes no harm. Forcing users to re-scaffold active shifts would be disruptive with zero functional benefit.

## Risks / Trade-offs

- **[Risk] `{row}` placeholder in existing task files** -- If any active shift uses `{row}` in task step templates, removing the column would cause the placeholder to resolve to nothing. Mitigation: This is documented as a breaking change. In practice, `{row}` usage is theoretical (the explore session found no concrete examples).
- **[Risk] User confusion about 0-based vs 1-based** -- Without a stored `row` column, the system uses 0-based qsv indices internally. User-facing commands must be careful to display 1-based labels. Mitigation: The conversion is contained to `nightshift-test-task` (the only interactive command that asks users to pick a row).
- **[Trade-off] Loss of `qsv select row,<column>` convenience** -- The manager loses a quick way to see a status column paired with identifiers. Accepted: The manager's actual need is status filtering (`qsv search`), not paired display.
