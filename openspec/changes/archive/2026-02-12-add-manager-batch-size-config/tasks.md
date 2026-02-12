## 1. Update Shift Configuration Spec (nightshift-shifts)

- [x] 1.1 Update `openspec/specs/nightshift-shifts/spec.md`: modify the "Manager file format" requirement to add `current-batch-size` and `max-batch-size` as optional fields in the Shift Configuration section, with scenarios for each field present/absent, interaction with `parallel`, and manager updating `current-batch-size` during execution

## 2. Update Parallel Execution Spec (parallel-execution)

- [x] 2.1 Update `openspec/specs/parallel-execution/spec.md`: modify the "Adaptive batch sizing" requirement to read initial batch size from `current-batch-size` (default 2), cap growth at `max-batch-size`, persist batch size changes to `manager.md`, handle invalid values, and ignore both fields when `parallel` is not `true`

## 3. Update Manager Agent Template

- [x] 3.1 Update `templates/agents/nightshift-manager.md` section "1. Read Shift State": add reading `current-batch-size` and `max-batch-size` fields from Shift Configuration, with defaults (2 and no cap) when omitted, and validation of non-positive/non-numeric values
- [x] 3.2 Update `templates/agents/nightshift-manager.md` section "3. Item Selection Algorithm" parallel mode: replace hardcoded `batch_size = 2` with `batch_size = current_batch_size` (read from config), and add cap logic so batch size never exceeds `max_batch_size` after adaptive adjustment
- [x] 3.3 Update `templates/agents/nightshift-manager.md` section "8. Loop" parallel mode: after adjusting batch size (double/halve), apply `max-batch-size` cap, then write the new value back to `current-batch-size` in the Shift Configuration section of `manager.md`

## 4. Update Shift Scaffolding Template

- [x] 4.1 Update `templates/commands/nightshift-create.md`: add commented-out `current-batch-size` and `max-batch-size` fields in the manager.md template, below the existing commented-out `parallel: true` line
