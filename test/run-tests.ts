#!/usr/bin/env tsx

/**
 * Nightshift test runner
 *
 * Executes integration tests for the Nightshift CLI and OpenCode commands.
 * Tests run sequentially in dependency order, tracking accuracy and performance.
 *
 * Usage: pnpm test
 */

import { execSync, spawn, type ChildProcess } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  statSync,
  readdirSync,
} from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");
const WORKSPACE_DIR = join(__dirname, "workspace");
const BENCHMARKS_PATH = join(__dirname, "benchmarks.json");
const LOG_PATH = join(__dirname, "test-log.jsonl");
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const BENCHMARK_TOLERANCE_PERCENT = 10;
const TEST_SHIFT_NAME = "test-shift";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Check {
  label: string;
  type: "file" | "dir" | "content" | "csv-column" | "csv-row-count";
  path: string;
  /** For "content" checks: string that must appear in the file */
  contains?: string;
  /** For "csv-column" checks: column name expected in header */
  column?: string;
  /** For "csv-row-count" checks: minimum number of data rows */
  minRows?: number;
}

interface TestResult {
  name: string;
  pass: boolean;
  accuracy: string;
  durationMs: number;
  benchmarkStatus: "NEW" | "FASTER" | "OK" | "SLOW";
  benchmarkDelta?: string;
  error?: string;
}

interface BenchmarkEntry {
  durationMs: number;
  updatedAt: string;
}

type Benchmarks = Record<string, BenchmarkEntry>;

interface TestDefinition {
  name: string;
  run: () => Promise<void>;
  checks: () => Check[];
}

// ---------------------------------------------------------------------------
// Utilities: OpenCode check
// ---------------------------------------------------------------------------

function checkOpenCode(): void {
  try {
    execSync("opencode --version", { stdio: "pipe" });
  } catch {
    console.error("Error: opencode is not installed or not in PATH.");
    console.error("Tests require the OpenCode CLI. Install it from https://opencode.ai");
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Utilities: Workspace management
// ---------------------------------------------------------------------------

function setupWorkspace(): void {
  if (existsSync(WORKSPACE_DIR)) {
    rmSync(WORKSPACE_DIR, { recursive: true });
  }
  mkdirSync(WORKSPACE_DIR, { recursive: true });
}

function cleanupWorkspace(): void {
  if (existsSync(WORKSPACE_DIR)) {
    rmSync(WORKSPACE_DIR, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Utilities: Command execution
// ---------------------------------------------------------------------------

function runCommand(
  command: string,
  args: string[],
  opts: { cwd?: string; timeoutMs?: number } = {},
): Promise<{ stdout: string; exitCode: number }> {
  const cwd = opts.cwd ?? WORKSPACE_DIR;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    let stdout = "";
    let timedOut = false;

    const child: ChildProcess = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });

    let timer: ReturnType<typeof setTimeout> | undefined;
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 5000);
      }, timeoutMs);
    }

    child.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data: Buffer) => {
      // Capture but don't display stderr during tests
      stdout += data.toString();
    });

    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (timedOut) {
        reject(new Error("timeout"));
      } else {
        resolve({ stdout, exitCode: code ?? 1 });
      }
    });

    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });
  });
}

function runOpenCodeCommand(
  commandName: string,
  message?: string,
): Promise<{ stdout: string; exitCode: number }> {
  const args = ["run", "--command", commandName];
  if (message) {
    args.push(message);
  }
  args.push("--format", "json");
  return runCommand("opencode", args, { cwd: WORKSPACE_DIR });
}

// ---------------------------------------------------------------------------
// Utilities: Accuracy validation
// ---------------------------------------------------------------------------

function runChecks(checks: Check[]): { passed: number; total: number; failures: string[] } {
  let passed = 0;
  const total = checks.length;
  const failures: string[] = [];

  for (const check of checks) {
    const fullPath = check.path.startsWith("/") ? check.path : join(WORKSPACE_DIR, check.path);
    let ok = false;

    switch (check.type) {
      case "file":
        ok = existsSync(fullPath) && statSync(fullPath).isFile();
        break;

      case "dir":
        ok = existsSync(fullPath) && statSync(fullPath).isDirectory();
        break;

      case "content":
        if (existsSync(fullPath) && check.contains) {
          const content = readFileSync(fullPath, "utf-8");
          ok = content.includes(check.contains);
        }
        break;

      case "csv-column":
        if (existsSync(fullPath) && check.column) {
          const header = readFileSync(fullPath, "utf-8").split("\n")[0] ?? "";
          const columns = header.split(",").map((c) => c.trim());
          ok = columns.includes(check.column);
        }
        break;

      case "csv-row-count":
        if (existsSync(fullPath) && check.minRows !== undefined) {
          const lines = readFileSync(fullPath, "utf-8")
            .split("\n")
            .filter((l) => l.trim() !== "");
          const dataRows = lines.length - 1; // subtract header
          ok = dataRows >= check.minRows;
        }
        break;
    }

    if (ok) {
      passed++;
    } else {
      failures.push(check.label);
    }
  }

  return { passed, total, failures };
}

// ---------------------------------------------------------------------------
// Benchmarks
// ---------------------------------------------------------------------------

function loadBenchmarks(): Benchmarks {
  if (!existsSync(BENCHMARKS_PATH)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(BENCHMARKS_PATH, "utf-8")) as Benchmarks;
  } catch {
    return {};
  }
}

function saveBenchmarks(benchmarks: Benchmarks): void {
  writeFileSync(BENCHMARKS_PATH, JSON.stringify(benchmarks, null, 2) + "\n", "utf-8");
}

function compareBenchmark(
  testName: string,
  durationMs: number,
  benchmarks: Benchmarks,
): { status: "NEW" | "FASTER" | "OK" | "SLOW"; delta?: string; priorMs: number | null } {
  const entry = benchmarks[testName];

  if (!entry) {
    // New baseline
    benchmarks[testName] = {
      durationMs,
      updatedAt: new Date().toISOString(),
    };
    return { status: "NEW", priorMs: null };
  }

  const priorMs = entry.durationMs;
  const threshold = priorMs * (1 + BENCHMARK_TOLERANCE_PERCENT / 100);

  if (durationMs < priorMs) {
    // Faster — update benchmark
    const improvement = ((priorMs - durationMs) / priorMs) * 100;
    benchmarks[testName] = {
      durationMs,
      updatedAt: new Date().toISOString(),
    };
    return {
      status: "FASTER",
      delta: `-${improvement.toFixed(1)}%`,
      priorMs,
    };
  } else if (durationMs <= threshold) {
    // Within tolerance
    return { status: "OK", priorMs };
  } else {
    // Regression
    const regression = ((durationMs - priorMs) / priorMs) * 100;
    return {
      status: "SLOW",
      delta: `+${regression.toFixed(1)}%`,
      priorMs,
    };
  }
}

// ---------------------------------------------------------------------------
// Test log
// ---------------------------------------------------------------------------

function appendTestLog(entry: {
  timestamp: string;
  test: string;
  pass: boolean;
  accuracy: string;
  durationMs: number;
  benchmarkMs: number | null;
}): void {
  appendFileSync(LOG_PATH, JSON.stringify(entry) + "\n", "utf-8");
}

// ---------------------------------------------------------------------------
// Summary printer
// ---------------------------------------------------------------------------

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60000);
  const sec = ((ms % 60000) / 1000).toFixed(0);
  return `${min}m ${sec}s`;
}

function printSummary(results: TestResult[]): void {
  console.log("\n" + "=".repeat(80));
  console.log("TEST RESULTS");
  console.log("=".repeat(80));

  // Column widths
  const nameWidth = Math.max(20, ...results.map((r) => r.name.length + 2));

  // Header
  const header = [
    "Test".padEnd(nameWidth),
    "Result".padEnd(8),
    "Accuracy".padEnd(10),
    "Duration".padEnd(12),
    "Benchmark",
  ].join("  ");
  console.log(header);
  console.log("-".repeat(header.length));

  // Rows
  for (const r of results) {
    const status = r.pass ? "PASS" : "FAIL";
    const benchLabel =
      r.benchmarkStatus === "NEW"
        ? "NEW"
        : r.benchmarkStatus === "FASTER"
          ? `FASTER (${r.benchmarkDelta})`
          : r.benchmarkStatus === "SLOW"
            ? `SLOW (${r.benchmarkDelta})`
            : "OK";

    const row = [
      r.name.padEnd(nameWidth),
      status.padEnd(8),
      r.accuracy.padEnd(10),
      formatDuration(r.durationMs).padEnd(12),
      benchLabel,
    ].join("  ");
    console.log(row);
  }

  console.log("-".repeat(header.length));

  // Footer
  const passCount = results.filter((r) => r.pass).length;
  const failCount = results.filter((r) => !r.pass).length;
  const slowCount = results.filter((r) => r.benchmarkStatus === "SLOW").length;

  console.log(`\n${passCount} passed, ${failCount} failed out of ${results.length} tests`);
  if (slowCount > 0) {
    console.log(`Warning: ${slowCount} performance regression(s) detected`);
  }
}

// ---------------------------------------------------------------------------
// Fixtures: deterministic shift content for each test
// ---------------------------------------------------------------------------

const FIXTURE_TASK_NAME = "hello_world";

const FIXTURE_MANAGER_EMPTY = `## Shift Configuration

- name: ${TEST_SHIFT_NAME}
- created: 2026-01-01
<!-- - parallel: true -->

## Task Order

(no tasks yet — use \`/nightshift-add-task ${TEST_SHIFT_NAME}\` to add tasks)
`;

const FIXTURE_MANAGER_WITH_TASK = `## Shift Configuration

- name: ${TEST_SHIFT_NAME}
- created: 2026-01-01

## Task Order

1. ${FIXTURE_TASK_NAME}
`;

const FIXTURE_MANAGER_PARALLEL = `## Shift Configuration

- name: ${TEST_SHIFT_NAME}
- created: 2026-01-01
- parallel: true
- current-batch-size: 3
- max-batch-size: 3

## Task Order

1. ${FIXTURE_TASK_NAME}
`;

const FIXTURE_TABLE_EMPTY = `row\n`;

const FIXTURE_TABLE_WITH_TASK = `row,${FIXTURE_TASK_NAME}\n`;

const FIXTURE_TABLE_WITH_DATA = `row,name,${FIXTURE_TASK_NAME}
1,alpha,todo
2,beta,todo
3,gamma,todo
`;

const FIXTURE_TABLE_ALL_DONE = `row,name,${FIXTURE_TASK_NAME}
1,alpha,done
2,beta,done
3,gamma,done
`;

const FIXTURE_TASK_FILE = `## Configuration

- tools: bash

## Steps

1. Run \`echo {name} > {name}.txt\` in the \`{SHIFT:FOLDER}\` directory to create the file

## Validation

- {name}.txt exists in the \`{SHIFT:FOLDER}\` directory
- {name}.txt contains the text "{name}"
`;

/** Write a file, creating parent directories as needed. */
function writeFixture(relativePath: string, content: string): void {
  const fullPath = join(WORKSPACE_DIR, relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf-8");
}

/** Set up a shift with manager.md, table.csv, and optionally a task file. */
function setupShift(opts: {
  manager: string;
  table: string;
  taskFile?: { name: string; content: string };
}): void {
  const shiftDir = `.nightshift/${TEST_SHIFT_NAME}`;
  writeFixture(`${shiftDir}/manager.md`, opts.manager);
  writeFixture(`${shiftDir}/table.csv`, opts.table);
  if (opts.taskFile) {
    writeFixture(`${shiftDir}/${opts.taskFile.name}.md`, opts.taskFile.content);
  }
}

/** Ensure the workspace has been init'd (has .opencode/ and .nightshift/archive/). */
function ensureInit(): void {
  if (!existsSync(join(WORKSPACE_DIR, ".opencode", "command"))) {
    execSync("pnpm build", { cwd: PROJECT_ROOT, stdio: "pipe" });
    const binPath = join(PROJECT_ROOT, "bin", "nightshift.js");
    execSync(`node ${binPath} init`, { cwd: WORKSPACE_DIR, stdio: "pipe" });
  }
}

/** Remove the test shift directory so the next test starts clean. */
function cleanShift(): void {
  const shiftDir = join(WORKSPACE_DIR, ".nightshift", TEST_SHIFT_NAME);
  if (existsSync(shiftDir)) {
    rmSync(shiftDir, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Test definitions
// ---------------------------------------------------------------------------

const tests: TestDefinition[] = [
  // -- 1. Init test --
  {
    name: "init",
    run: async () => {
      // Remove .opencode so init runs fresh for this test
      const opencodePath = join(WORKSPACE_DIR, ".opencode");
      if (existsSync(opencodePath)) {
        rmSync(opencodePath, { recursive: true });
      }
      const nightshiftPath = join(WORKSPACE_DIR, ".nightshift");
      if (existsSync(nightshiftPath)) {
        rmSync(nightshiftPath, { recursive: true });
      }
      execSync("pnpm build", { cwd: PROJECT_ROOT, stdio: "pipe" });
      const binPath = join(PROJECT_ROOT, "bin", "nightshift.js");
      await runCommand("node", [binPath, "init"], { cwd: WORKSPACE_DIR });
    },
    checks: () => [
      { label: ".nightshift/archive/ dir", type: "dir", path: ".nightshift/archive" },
      { label: ".opencode/agent/ dir", type: "dir", path: ".opencode/agent" },
      { label: ".opencode/command/ dir", type: "dir", path: ".opencode/command" },
      {
        label: "nightshift-manager.md",
        type: "file",
        path: ".opencode/agent/nightshift-manager.md",
      },
      { label: "nightshift-dev.md", type: "file", path: ".opencode/agent/nightshift-dev.md" },
      {
        label: "nightshift-create.md",
        type: "file",
        path: ".opencode/command/nightshift-create.md",
      },
      {
        label: "nightshift-add-task.md",
        type: "file",
        path: ".opencode/command/nightshift-add-task.md",
      },
      {
        label: "nightshift-update-table.md",
        type: "file",
        path: ".opencode/command/nightshift-update-table.md",
      },
      {
        label: "nightshift-start.md",
        type: "file",
        path: ".opencode/command/nightshift-start.md",
      },
      {
        label: "nightshift-test-task.md",
        type: "file",
        path: ".opencode/command/nightshift-test-task.md",
      },
      {
        label: "nightshift-archive.md",
        type: "file",
        path: ".opencode/command/nightshift-archive.md",
      },
      {
        label: ".nightshift/.gitignore exists",
        type: "file",
        path: ".nightshift/.gitignore",
      },
      {
        label: ".nightshift/.gitignore contains table.csv.bak",
        type: "content",
        path: ".nightshift/.gitignore",
        contains: "table.csv.bak",
      },
    ],
  },

  // -- 2. nightshift-start test --
  // Fixture: shift with task, 3 rows all at "todo"
  {
    name: "nightshift-start",
    run: async () => {
      ensureInit();
      cleanShift();
      setupShift({
        manager: FIXTURE_MANAGER_WITH_TASK,
        table: FIXTURE_TABLE_WITH_DATA,
        taskFile: { name: FIXTURE_TASK_NAME, content: FIXTURE_TASK_FILE },
      });
      await runOpenCodeCommand(
        "nightshift-start",
        `${TEST_SHIFT_NAME} -- Start the shift immediately. Do not ask for confirmation.`,
      );
    },
    checks: () => {
      const shiftDir = `.nightshift/${TEST_SHIFT_NAME}`;
      return [
        { label: "alpha.txt exists", type: "file" as const, path: `${shiftDir}/alpha.txt` },
        { label: "beta.txt exists", type: "file" as const, path: `${shiftDir}/beta.txt` },
        { label: "gamma.txt exists", type: "file" as const, path: `${shiftDir}/gamma.txt` },
      ];
    },
  },

  // -- 3. nightshift-start-parallel test --
  // Fixture: shift with task, 3 rows all at "todo", parallel mode with batch size 3
  {
    name: "nightshift-start-parallel",
    run: async () => {
      ensureInit();
      cleanShift();
      setupShift({
        manager: FIXTURE_MANAGER_PARALLEL,
        table: FIXTURE_TABLE_WITH_DATA,
        taskFile: { name: FIXTURE_TASK_NAME, content: FIXTURE_TASK_FILE },
      });
      await runOpenCodeCommand(
        "nightshift-start",
        `${TEST_SHIFT_NAME} -- Start the shift immediately. Do not ask for confirmation.`,
      );
    },
    checks: () => {
      const shiftDir = `.nightshift/${TEST_SHIFT_NAME}`;
      return [
        { label: "alpha.txt exists", type: "file" as const, path: `${shiftDir}/alpha.txt` },
        { label: "beta.txt exists", type: "file" as const, path: `${shiftDir}/beta.txt` },
        { label: "gamma.txt exists", type: "file" as const, path: `${shiftDir}/gamma.txt` },
      ];
    },
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("Nightshift Test Runner");
  console.log("=".repeat(80));

  // Pre-flight: check OpenCode
  checkOpenCode();
  console.log("OpenCode: available");

  // Setup workspace
  setupWorkspace();
  console.log(`Workspace: ${WORKSPACE_DIR}`);

  // Load benchmarks
  const benchmarks = loadBenchmarks();

  const results: TestResult[] = [];

  try {
    for (const test of tests) {
      console.log(`\nRunning: ${test.name}...`);
      const startTime = performance.now();

      let error: string | undefined;
      try {
        await test.run();
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        if (error === "timeout") {
          console.log(`  TIMEOUT after ${formatDuration(DEFAULT_TIMEOUT_MS)}`);
        } else {
          console.log(`  ERROR: ${error}`);
        }
      }

      const durationMs = Math.round(performance.now() - startTime);

      // Run accuracy checks
      const checks = test.checks();
      const { passed, total, failures } = runChecks(checks);
      const accuracy = `${passed}/${total}`;
      const pass = error === undefined && passed === total;

      if (!pass && failures.length > 0) {
        for (const f of failures) {
          console.log(`  FAIL: ${f}`);
        }
      }

      // Benchmark comparison — only update benchmarks for passing tests
      const priorBenchmark = benchmarks[test.name]?.durationMs ?? null;
      let benchResult: { status: "NEW" | "FASTER" | "OK" | "SLOW"; delta?: string; priorMs: number | null };

      if (pass) {
        benchResult = compareBenchmark(test.name, durationMs, benchmarks);

        if (benchResult.status === "NEW") {
          console.log(`  Benchmark: NEW baseline (${formatDuration(durationMs)})`);
        } else if (benchResult.status === "FASTER") {
          console.log(
            `  Benchmark: FASTER ${benchResult.delta} (${formatDuration(durationMs)} vs ${formatDuration(benchResult.priorMs!)})`,
          );
        } else if (benchResult.status === "SLOW") {
          console.log(
            `  WARNING: Performance regression ${benchResult.delta} (${formatDuration(durationMs)} vs ${formatDuration(benchResult.priorMs!)})`,
          );
        }
      } else {
        // Failed tests: report prior benchmark for reference but do not update
        benchResult = { status: "OK", priorMs: priorBenchmark };
        if (priorBenchmark !== null) {
          console.log(`  Benchmark: skipped (test failed, prior ${formatDuration(priorBenchmark)})`);
        }
      }

      console.log(`  ${pass ? "PASS" : "FAIL"} (${accuracy}) in ${formatDuration(durationMs)}`);

      results.push({
        name: test.name,
        pass,
        accuracy,
        durationMs,
        benchmarkStatus: benchResult.status,
        benchmarkDelta: benchResult.delta,
        error,
      });

      // Append to test log
      appendTestLog({
        timestamp: new Date().toISOString(),
        test: test.name,
        pass,
        accuracy,
        durationMs,
        benchmarkMs: priorBenchmark,
      });
    }
  } finally {
    // Save benchmarks
    saveBenchmarks(benchmarks);

    // Cleanup workspace
    cleanupWorkspace();
  }

  // Print summary
  printSummary(results);

  // Exit code
  const allPassed = results.every((r) => r.pass);
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  cleanupWorkspace();
  process.exit(1);
});
