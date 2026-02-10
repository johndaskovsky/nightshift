## 0. Backport Runtime Features to Templates

The runtime copies (`.opencode/`) of `nightshift-manager.md`, `nightshift-dev.md`, and `nightshift-create.md` are ahead of their templates — they include environment variable support (`{ENV:VAR_NAME}`), shift metadata placeholders (`{SHIFT:FOLDER}`, `{SHIFT:NAME}`), and `.env` file handling that was never backported. These features must be merged into the templates before the parallel execution changes are applied.

- [x] 0.1 Backport `.env` file reading, `{ENV:VAR_NAME}` placeholder substitution, `{SHIFT:FOLDER}` / `{SHIFT:NAME}` placeholder substitution, and shift metadata delegation from `.opencode/agent/nightshift-manager.md` into `templates/agents/nightshift-manager.md`
- [x] 0.2 Backport `{ENV:VAR_NAME}` placeholder substitution, `{SHIFT:FOLDER}` / `{SHIFT:NAME}` placeholder substitution, three-type placeholder resolution, and error handling from `.opencode/agent/nightshift-dev.md` into `templates/agents/nightshift-dev.md`
- [x] 0.3 Backport the "Environment Variables (Optional)" output section from `.opencode/command/nightshift-create.md` into `templates/commands/nightshift-create.md`

## 1. Dev Agent Template — Remove Direct Step Editing, Add Recommendation Reporting

All changes target `templates/agents/nightshift-dev.md`.

- [x] 1.1 Update "Your Role" section: remove "you self-improve steps" / "refine the Steps section of the task file" language; add "you report step improvement recommendations to the manager"
- [x] 1.2 Update "Immutability Rules" section: change to state that the dev agent may NOT modify ANY section of the task file (Steps, Configuration, and Validation are all immutable to the dev)
- [x] 1.3 Rewrite "4. Self-Improve Steps" section to "4. Identify Recommendations": remove all file read/write logic; instead describe in-memory refinement for retries and collecting recommendations for the output
- [x] 1.4 Update "6. Retry on Self-Validation Failure" section: change "Refine the Steps section" to "Refine your approach in-memory"; remove references to writing to the task file
- [x] 1.5 Update "7. Return Results" section: replace `Steps Refined` with `Recommendations` section in the example output block; add example recommendation entries
- [x] 1.6 Update "Output Contract" table: replace `Steps Refined` row with `Recommendations` row (listing suggested step improvements or "None")
- [x] 1.7 Update "Guidelines" section: replace "Do not modify files outside the scope of the task steps and the task file's Steps section" with "Do not modify any files other than those created or required by the task steps — never edit the task file itself"

## 2. Manager Agent Template — Add Step Improvement Responsibility

All changes target `templates/agents/nightshift-manager.md`.

- [x] 2.1 Update "Your Role" section: replace "You process items one at a time, sequentially" with language about processing items sequentially or in parallel batches; add bullet about being responsible for applying step improvements from dev recommendations
- [x] 2.2 Update "4. Delegate to Dev" prompt template: replace responsibility 3 ("Self-improve steps") with "Report recommendations — if you identify improvements to the steps, include them in your Recommendations output section. Do NOT edit the task file." Update the return format to list `recommendations` instead of `steps_refined`
- [x] 2.3 Add new section "4b. Apply Step Improvements" between dev delegation and QA delegation: describe reviewing the dev's Recommendations section, synthesizing improvements, and applying a single coherent update to the task file's Steps section (preserving Configuration and Validation)
- [x] 2.4 Update "Error Handling" section: replace the `steps_refined: true` note with language about processing recommendations from the dev agent

## 3. Manager Agent Template — Add Parallel Batch Dispatch

All changes target `templates/agents/nightshift-manager.md`.

- [x] 3.1 Update "1. Read Shift State" section: add reading the `parallel` field from Shift Configuration
- [x] 3.2 Update "3. Item Selection Algorithm" section: when `parallel: true`, collect up to N `todo` items (batch) instead of selecting one; describe adaptive batch sizing (start at 2, double on all-success, halve on any failure, min 1); when `parallel` is omitted/false, keep current single-item selection
- [x] 3.3 Update "4. Delegate to Dev" section: when parallel, dispatch N dev agents via N parallel Task tool calls in a single message; set all batch items to `in_progress` before dispatching; when sequential, keep current single-delegation flow
- [x] 3.4 Update "4b. Apply Step Improvements" (from task 2.3): describe collecting recommendations from all dev agents in a batch, deduplicating, synthesizing, and applying one coherent update before the next batch
- [x] 3.5 Update "5. Delegate to QA" section: after a parallel batch, run QA sequentially on each successful item (one at a time); failed dev items skip QA and are set to `failed` immediately
- [x] 3.6 Update "8. Loop" section: after processing a batch, adjust batch size (double if all succeeded, halve if any failed), then loop to the next batch; describe this as the adaptive sizing loop

## 4. Create Command Template — Add Parallel Config

- [x] 4.1 Update `templates/commands/nightshift-create.md` to include an optional `parallel: true` field in the generated `manager.md` Shift Configuration section (as a commented-out example or omitted by default)

## 5. Template Config — Update opencode.jsonc Template

- [x] 5.1 Review `templates/opencode.jsonc` for any changes needed to support the parallel execution model (no permission changes expected — verify and confirm)

## 6. Remove Runtime Nightshift Files

Remove the installed/runtime copies from this repo. After this change, only the templates remain as the source of truth — end users get runtime copies via the `nightshift init` CLI installer.

- [x] 6.1 Delete `.opencode/agent/nightshift-manager.md`, `.opencode/agent/nightshift-dev.md`, `.opencode/agent/nightshift-qa.md`
- [x] 6.2 Delete `.opencode/command/nightshift-create.md`, `.opencode/command/nightshift-add-task.md`, `.opencode/command/nightshift-start.md`, `.opencode/command/nightshift-update-table.md`, `.opencode/command/nightshift-test-task.md`, `.opencode/command/nightshift-archive.md`
- [x] 6.3 Remove the three nightshift agent definitions (`nightshift-manager`, `nightshift-dev`, `nightshift-qa`) and their permissions from the root `opencode.jsonc`; preserve any non-nightshift config (e.g., `openspec list*` bash permission)
- [x] 6.4 Delete the `.nightshift/` directory (contains only `archive/.gitkeep`)

## 7. Spec Sync — Update Main Specs

- [x] 7.1 Sync delta spec `nightshift-agents` to main spec at `openspec/specs/nightshift-agents/spec.md` — replace the modified requirements with their updated versions
- [x] 7.2 Sync delta spec `nightshift-tasks` to main spec at `openspec/specs/nightshift-tasks/spec.md` — replace the modified requirements with their updated versions
- [x] 7.3 Sync delta spec `nightshift-shifts` to main spec at `openspec/specs/nightshift-shifts/spec.md` — replace the modified requirement with its updated version
- [x] 7.4 Add new main spec `openspec/specs/parallel-execution/spec.md` — copy from the ADDED spec in the change directory
