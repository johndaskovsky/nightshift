## 1. Specs

- [x] 1.1 Update main spec `openspec/specs/nightshift-shifts/spec.md`: remove `row` column requirement from table file format, remove row numbering scenario, update table structure scenario to omit `row`
- [x] 1.2 Update main spec `openspec/specs/nightshift-commands/spec.md`: update `nightshift-create` to scaffold table without `row`, update `nightshift-test-task` to use positional index with 1-based display labels, update `nightshift-update-table` to remove row numbering maintenance
- [x] 1.3 Update main spec `openspec/specs/nightshift-agents/spec.md`: remove `row` references from delegation context, replace `row_number` with 0-based positional index, update dev agent placeholder references
- [x] 1.4 Update main spec `openspec/specs/qsv-csv-operations/spec.md`: remove `qsv_index = row_number - 1` conversion, update cell read scenarios to use position directly, replace `qsv select row,<column>` with `qsv select <column>`
- [x] 1.5 Update main spec `openspec/specs/nightshift-tasks/spec.md`: update task test execution scenario to use 0-based index with 1-based display label, clarify `{column_name}` refers to metadata columns only
- [x] 1.6 Update main spec `openspec/specs/test-runner/spec.md`: update `nightshift-create` test expectation to expect table without `row` column

## 2. Templates

- [x] 2.1 Update `templates/agents/nightshift-manager.md`: remove all `row` column references, remove `qsv_index = row_number - 1` conversion formula, update delegation context to pass 0-based index directly, replace `qsv select row,<column>` with `qsv select <column>`
- [x] 2.2 Update `templates/agents/nightshift-dev.md`: remove `row` references from context receiving, update index references to use 0-based positional index directly
- [x] 2.3 Update `templates/commands/nightshift-create.md`: remove `row` column from table scaffolding (empty table.csv with no pre-defined columns)
- [x] 2.4 Update `templates/commands/nightshift-test-task.md`: change user prompt from "row number (1-N)" to "item number (1-N)" with conversion to 0-based qsv index, remove `row` from non-task column exclusion list
- [x] 2.5 Update `templates/commands/nightshift-update-table.md`: remove sequential row numbering maintenance when appending rows

## 3. Documentation

- [x] 3.1 Update `AGENTS.md`: remove `row` as first column convention from CSV conventions section, update repository structure description, update any examples referencing `row`
- [x] 3.2 Update `README.md`: remove `{row}` placeholder example and `row` column references
