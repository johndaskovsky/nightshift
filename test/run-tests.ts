#!/usr/bin/env tsx

/**
 * Nightshift integration test runner
 *
 * Executes integration tests against Claude Code.
 *
 * Test execution order:
 *   1. init
 *   2. nightshift-start
 *   3. nightshift-start-parallel
 *   4. nightshift-start-no-self-improvement
 *   5. nightshift-start-parallel-no-self-improvement
 *
 * Requires the `claude` CLI on PATH; exits with an error if missing.
 *
 * Usage:
 *   pnpm test:integration
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
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes — subprocess overhead + serial + self-improvement is the slowest path
const BENCHMARK_TOLERANCE_PERCENT = 10;
const TEST_SHIFT_NAME = "test-shift";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Check {
  label: string;
  type: "file" | "dir" | "content" | "csv-column" | "csv-row-count";
  path: string;
  contains?: string;
  column?: string;
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
// Utilities: Pre-flight
// ---------------------------------------------------------------------------

function isCliAvailable(command: string): boolean {
  try {
    execSync(`${command} --version`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function requireClaude(): void {
  if (!isCliAvailable("claude")) {
    console.error(
      "Error: claude is not installed or not in PATH. Install it from https://code.claude.com",
    );
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
  if (process.env["NIGHTSHIFT_KEEP_WORKSPACE"]) {
    console.log(`Workspace preserved at ${WORKSPACE_DIR} (NIGHTSHIFT_KEEP_WORKSPACE set)`);
    return;
  }
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
  opts: { cwd?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv } = {},
): Promise<{ stdout: string; exitCode: number }> {
  const cwd = opts.cwd ?? WORKSPACE_DIR;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    let stdout = "";
    let timedOut = false;

    const child: ChildProcess = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: opts.env ?? { ...process.env },
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

/**
 * Invoke a Nightshift skill in Claude Code with permissions pre-approved and
 * background tasks forced synchronous (so `context: fork` skills block the
 * print-mode session until the manager subagent completes).
 */
function runShiftCommand(
  commandName: string,
  shiftName: string,
): Promise<{ stdout: string; exitCode: number }> {
  return runCommand(
    "claude",
    [
      "-p",
      `/${commandName} ${shiftName}`,
      "--output-format",
      "json",
      "--dangerously-skip-permissions",
    ],
    {
      cwd: WORKSPACE_DIR,
      env: {
        ...process.env,
        CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: "1",
      },
    },
  );
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
          const dataRows = lines.length - 1;
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
    benchmarks[testName] = {
      durationMs,
      updatedAt: new Date().toISOString(),
    };
    return { status: "NEW", priorMs: null };
  }

  const priorMs = entry.durationMs;
  const threshold = priorMs * (1 + BENCHMARK_TOLERANCE_PERCENT / 100);

  if (durationMs < priorMs) {
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
    return { status: "OK", priorMs };
  } else {
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

  const nameWidth = Math.max(20, ...results.map((r) => r.name.length + 2));

  const header = [
    "Test".padEnd(nameWidth),
    "Result".padEnd(8),
    "Accuracy".padEnd(10),
    "Duration".padEnd(12),
    "Benchmark",
  ].join("  ");
  console.log(header);
  console.log("-".repeat(header.length));

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

const FIXTURE_MANAGER_NO_SELF_IMPROVEMENT = `## Shift Configuration

- name: ${TEST_SHIFT_NAME}
- created: 2026-01-01
- disable-self-improvement: true

## Task Order

1. ${FIXTURE_TASK_NAME}
`;

const FIXTURE_MANAGER_PARALLEL_NO_SELF_IMPROVEMENT = `## Shift Configuration

- name: ${TEST_SHIFT_NAME}
- created: 2026-01-01
- parallel: true
- current-batch-size: 3
- max-batch-size: 3
- disable-self-improvement: true

## Task Order

1. ${FIXTURE_TASK_NAME}
`;

const FIXTURE_TABLE_WITH_DATA = `row,name,${FIXTURE_TASK_NAME}
1,alpha,todo
2,beta,todo
3,gamma,todo
`;

const FIXTURE_TASK_FILE = `## Configuration

- tools: bash

## Steps

1. Run \`echo {name} > {name}.txt\` in the \`{SHIFT:FOLDER}\` directory to create the file

## Validation

- {name}.txt exists in the \`{SHIFT:FOLDER}\` directory
- {name}.txt contains the text "{name}"
`;

function writeFixture(relativePath: string, content: string): void {
  const fullPath = join(WORKSPACE_DIR, relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf-8");
}

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

function ensureInit(): void {
  const claudeReady = existsSync(join(WORKSPACE_DIR, ".claude", "skills"));
  if (!claudeReady) {
    execSync("pnpm build", { cwd: PROJECT_ROOT, stdio: "pipe" });
    const binPath = join(PROJECT_ROOT, "bin", "nightshift.js");
    execSync(`node ${binPath} init`, {
      cwd: WORKSPACE_DIR,
      stdio: "pipe",
    });
  }
}

function cleanShift(): void {
  const shiftDir = join(WORKSPACE_DIR, ".nightshift", TEST_SHIFT_NAME);
  if (existsSync(shiftDir)) {
    rmSync(shiftDir, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Test definitions
// ---------------------------------------------------------------------------

const SHIFT_OUTPUT_CHECKS = (): Check[] => {
  const shiftDir = `.nightshift/${TEST_SHIFT_NAME}`;
  return [
    { label: "alpha.txt exists", type: "file", path: `${shiftDir}/alpha.txt` },
    { label: "beta.txt exists", type: "file", path: `${shiftDir}/beta.txt` },
    { label: "gamma.txt exists", type: "file", path: `${shiftDir}/gamma.txt` },
    { label: "per-item logs dir", type: "dir", path: `${shiftDir}/logs` },
  ];
};

const tests: TestDefinition[] = [
  // -- 1. Init test --
  {
    name: "init",
    run: async () => {
      for (const subdir of [".claude", ".nightshift"]) {
        const p = join(WORKSPACE_DIR, subdir);
        if (existsSync(p)) rmSync(p, { recursive: true });
      }
      const claudeMd = join(WORKSPACE_DIR, "CLAUDE.md");
      if (existsSync(claudeMd)) rmSync(claudeMd);

      execSync("pnpm build", { cwd: PROJECT_ROOT, stdio: "pipe" });
      const binPath = join(PROJECT_ROOT, "bin", "nightshift.js");
      await runCommand("node", [binPath, "init"], { cwd: WORKSPACE_DIR });
    },
    checks: () => [
      { label: ".nightshift/archive/ dir", type: "dir", path: ".nightshift/archive" },
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
      { label: ".claude/agents/ dir", type: "dir", path: ".claude/agents" },
      { label: ".claude/skills/ dir", type: "dir", path: ".claude/skills" },
      {
        label: "claude manager",
        type: "file",
        path: ".claude/agents/nightshift-manager.md",
      },
      {
        label: "claude start skill",
        type: "file",
        path: ".claude/skills/nightshift-start/SKILL.md",
      },
      {
        label: "claude do-task skill",
        type: "file",
        path: ".claude/skills/nightshift-do-task/SKILL.md",
      },
      {
        label: "dispatch-batch helper",
        type: "file",
        path: ".claude/skills/nightshift-start/scripts/dispatch-batch.sh",
      },
      {
        label: ".claude/settings.json exists",
        type: "file",
        path: ".claude/settings.json",
      },
      { label: "CLAUDE.md exists", type: "file", path: "CLAUDE.md" },
    ],
  },

  // -- 2. nightshift-start (sequential) --
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
      await runShiftCommand("nightshift-start", TEST_SHIFT_NAME);
    },
    checks: SHIFT_OUTPUT_CHECKS,
  },

  // -- 3. nightshift-start-parallel --
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
      await runShiftCommand("nightshift-start", TEST_SHIFT_NAME);
    },
    checks: SHIFT_OUTPUT_CHECKS,
  },

  // -- 4. nightshift-start-no-self-improvement --
  {
    name: "nightshift-start-no-self-improvement",
    run: async () => {
      ensureInit();
      cleanShift();
      setupShift({
        manager: FIXTURE_MANAGER_NO_SELF_IMPROVEMENT,
        table: FIXTURE_TABLE_WITH_DATA,
        taskFile: { name: FIXTURE_TASK_NAME, content: FIXTURE_TASK_FILE },
      });
      await runShiftCommand("nightshift-start", TEST_SHIFT_NAME);
    },
    checks: SHIFT_OUTPUT_CHECKS,
  },

  // -- 5. nightshift-start-parallel-no-self-improvement --
  {
    name: "nightshift-start-parallel-no-self-improvement",
    run: async () => {
      ensureInit();
      cleanShift();
      setupShift({
        manager: FIXTURE_MANAGER_PARALLEL_NO_SELF_IMPROVEMENT,
        table: FIXTURE_TABLE_WITH_DATA,
        taskFile: { name: FIXTURE_TASK_NAME, content: FIXTURE_TASK_FILE },
      });
      await runShiftCommand("nightshift-start", TEST_SHIFT_NAME);
    },
    checks: SHIFT_OUTPUT_CHECKS,
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("Nightshift Integration Test Runner");
  console.log("=".repeat(80));

  requireClaude();

  setupWorkspace();
  console.log(`Workspace: ${WORKSPACE_DIR}`);

  const benchmarks = loadBenchmarks();

  const results: TestResult[] = [];

  // Optional filter via NIGHTSHIFT_TEST_FILTER env var. Matches test names
  // that contain the filter string (substring match). Useful for iterating on
  // a single test without paying the full-suite cost.
  const filter = process.env["NIGHTSHIFT_TEST_FILTER"];
  const selectedTests = filter ? tests.filter((t) => t.name.includes(filter)) : tests;
  if (filter) {
    console.log(`Filter: NIGHTSHIFT_TEST_FILTER="${filter}" → ${selectedTests.length} of ${tests.length} tests selected`);
    if (selectedTests.length === 0) {
      console.error(`No tests match filter "${filter}". Available: ${tests.map((t) => t.name).join(", ")}`);
      process.exit(1);
    }
  }

  try {
    for (const test of selectedTests) {
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

      const checks = test.checks();
      const { passed, total, failures } = runChecks(checks);
      const accuracy = `${passed}/${total}`;
      const pass = error === undefined && passed === total;

      if (!pass && failures.length > 0) {
        for (const f of failures) {
          console.log(`  FAIL: ${f}`);
        }
      }

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
    saveBenchmarks(benchmarks);
    cleanupWorkspace();
  }

  printSummary(results);

  const allPassed = results.every((r) => r.pass);
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  cleanupWorkspace();
  process.exit(1);
});
