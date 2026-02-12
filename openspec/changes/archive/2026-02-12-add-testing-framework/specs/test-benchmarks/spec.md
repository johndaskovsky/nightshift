## ADDED Requirements

### Requirement: Benchmark storage file
The system SHALL store performance benchmarks in `test/benchmarks.json` as a JSON object mapping test names to benchmark records. Each record SHALL contain `durationMs` (number, milliseconds) and `updatedAt` (string, ISO 8601 timestamp). This file SHALL be committed to the repository (not gitignored).

#### Scenario: First run with no benchmarks file
- **WHEN** the runner completes a test and `test/benchmarks.json` does not exist
- **THEN** the runner SHALL create `test/benchmarks.json` and write the test's duration as the initial benchmark for that test

#### Scenario: Benchmark file structure
- **WHEN** the runner reads `test/benchmarks.json`
- **THEN** the file SHALL parse as a valid JSON object where each key is a test name and each value is an object with `durationMs` (number) and `updatedAt` (string) properties

### Requirement: Performance timing
The system SHALL measure the wall-clock execution duration of each test in milliseconds. Timing SHALL start immediately before the command is invoked and end immediately after the command process exits (or after artifact validation completes, whichever is later).

#### Scenario: Timing a test
- **WHEN** a test executes
- **THEN** the runner SHALL record the duration in milliseconds from command invocation through artifact validation completion

#### Scenario: Timing reported in summary
- **WHEN** the test summary is printed
- **THEN** each test row SHALL include its execution duration in a human-readable format (e.g., "43.2s" or "1m 12s")

### Requirement: Benchmark comparison
The system SHALL compare each test's execution duration against its stored benchmark after the test completes. The comparison SHALL use a configurable tolerance threshold (default: 10%) to account for normal variance.

#### Scenario: Test runs faster than benchmark
- **WHEN** a test completes and its duration is less than the stored benchmark duration
- **THEN** the runner SHALL update the benchmark in `test/benchmarks.json` with the new faster duration and current timestamp, and print a message indicating the improvement and the delta

#### Scenario: Test runs slower within tolerance
- **WHEN** a test completes and its duration exceeds the stored benchmark by less than or equal to the tolerance threshold (default 10%)
- **THEN** the runner SHALL NOT print a warning and SHALL NOT update the benchmark

#### Scenario: Test runs slower beyond tolerance
- **WHEN** a test completes and its duration exceeds the stored benchmark by more than the tolerance threshold (default 10%)
- **THEN** the runner SHALL print a warning to stdout indicating the regression, the current duration, the benchmark duration, and the percentage difference. The benchmark SHALL NOT be updated.

#### Scenario: No existing benchmark for test
- **WHEN** a test completes and no benchmark entry exists for that test name in `test/benchmarks.json`
- **THEN** the runner SHALL store the current duration as the initial benchmark and print a message indicating a new baseline was established

### Requirement: Benchmark tolerance configuration
The system SHALL support a configurable tolerance threshold as a percentage. The default tolerance SHALL be 10%. The tolerance SHALL be defined as a constant in the test runner source code.

#### Scenario: Default tolerance
- **WHEN** no custom tolerance is configured
- **THEN** the runner SHALL use 10% as the regression warning threshold

#### Scenario: Tolerance calculation
- **WHEN** a test's duration is compared to its benchmark
- **THEN** the runner SHALL calculate the threshold as `benchmarkDurationMs * (1 + tolerancePercent / 100)` and only warn if the actual duration exceeds this value

### Requirement: Benchmark data in test log
The system SHALL include the benchmark duration in each test log record appended to `test/test-log.jsonl`, enabling historical comparison of actual vs. benchmark performance.

#### Scenario: Log record includes benchmark
- **WHEN** a test result is appended to `test/test-log.jsonl` and a benchmark exists for that test
- **THEN** the record SHALL include a `benchmarkMs` field with the benchmark duration that was used for comparison (the value at the time of comparison, before any update)

#### Scenario: Log record with no benchmark
- **WHEN** a test result is appended to `test/test-log.jsonl` and no benchmark existed prior to this run
- **THEN** the record SHALL include `benchmarkMs` with a value of `null`

### Requirement: Benchmark summary in test output
The system SHALL include benchmark comparison results in the test summary printed after all tests complete.

#### Scenario: Summary shows benchmark status
- **WHEN** the test summary is printed
- **THEN** each test row SHALL include a benchmark indicator: "NEW" if no prior benchmark existed, "FASTER" with the improvement delta if the benchmark was updated, "OK" if within tolerance, or "SLOW" with the regression delta if beyond tolerance

#### Scenario: Summary footer with overall benchmark status
- **WHEN** the test summary is printed and one or more tests triggered regression warnings
- **THEN** the summary SHALL include a footer line stating the number of performance regressions detected
