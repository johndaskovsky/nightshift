#!/usr/bin/env tsx

/**
 * Nightshift integration test runner
 *
 * Executes integration tests against one or more runtimes (OpenCode, Claude
 * Code). The same shift fixtures and accuracy checks run under each selected
 * runtime so we verify behavioral parity across harnesses.
 *
 * Test execution order, per runtime:
 *   1. init
 *   2. nightshift-start
 *   3. nightshift-start-parallel
 *   4. nightshift-start-no-self-improvement
 *   5. nightshift-start-parallel-no-self-improvement
 *
 * Selecting runtimes:
 *   - `--runtime=opencode` (or env `NIGHTSHIFT_TEST_RUNTIMES=opencode`)
 *   - `--runtime=claude`   (or env `NIGHTSHIFT_TEST_RUNTIMES=claude`)
 *   - `--runtime=both`     (default — runs everything detected on PATH)
 *
 * If a runtime is requested but its CLI is not installed, the runner exits
 * with an error before running anything. If no flag is provided, the runner
 * auto-detects: it runs against every runtime whose CLI is on PATH.
 *
 * Usage:
 *   pnpm test:integration            # auto-detect
 *   pnpm test:integration:opencode   # explicit
 *   pnpm test:integration:claude     # explicit
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
  run: (runtime: Runtime) => Promise<void>;
  checks: () => Check[];
}

type Runtime = "opencode" | "claude";

// ---------------------------------------------------------------------------
// Utilities: Runtime detection and selection
// ---------------------------------------------------------------------------

function isCliAvailable(command: string): boolean {
  try {
    execSync(`${command} --version`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve which runtimes to test based on CLI args, env var, and what's
 * installed on PATH.
 */
function resolveRuntimes(): Runtime[] {
  const flag = process.argv.find((a) => a.startsWith("--runtime="))?.split("=")[1];
  const envValue = process.env["NIGHTSHIFT_TEST_RUNTIMES"];
  const requested = flag ?? envValue;

  const opencodeAvailable = isCliAvailable("opencode");
  const claudeAvailable = isCliAvailable("claude");

  if (requested) {
    const requestedRuntimes: Runtime[] =
      requested === "both"
        ? ["opencode", "claude"]
        : (requested.split(",").map((r) => r.trim()) as Runtime[]);

    for (const r of requestedRuntimes) {
      if (r !== "opencode" && r !== "claude") {
        console.error(
          `Error: invalid runtime "${r}". Valid values: opencode, claude, both.`,
        );
        process.exit(1);
      }
      if (r === "opencode" && !opencodeAvailable) {
        console.error(
          "Error: opencode is not installed or not in PATH. Install it from https://opencode.ai",
        );
        process.exit(1);
      }
      if (r === "claude" && !claudeAvailable) {
        console.error(
          "Error: claude is not installed or not in PATH. Install it from https://code.claude.com",
        );
        process.exit(1);
      }
    }
    return requestedRuntimes;
  }

  // Auto-detect: run whichever runtimes are available
  const available: Runtime[] = [];
  if (opencodeAvailable) available.push("opencode");
  if (claudeAvailable) available.push("claude");

  if (available.length === 0) {
    console.error(
      "Error: neither opencode nor claude is installed. Install one (or both) before running integration tests.",
    );
    process.exit(1);
  }

  return available;
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

/**
 * Invoke a Nightshift slash command on the active runtime.
 *
 * For OpenCode, this maps to `opencode run --command <name> "<args> -- <message>"`.
 * For Claude Code, this maps to `claude -p "/<name> <args>"` with permissions
 * pre-approved and background tasks forced synchronous (so `context: fork`
 * skills block the print-mode session until the manager subagent completes).
 */
function runShiftCommand(
  runtime: Runtime,
  commandName: string,
  shiftName: string,
  options: { messageSuffix?: string } = {},
): Promise<{ stdout: string; exitCode: number }> {
  if (runtime === "opencode") {
    const message = options.messageSuffix
      ? `${shiftName} -- ${options.messageSuffix}`
      : shiftName;
    return runCommand(
      "opencode",
      ["run", "--command", commandName, message, "--format", "json"],
      { cwd: WORKSPACE_DIR },
    );
  }

  // Claude Code: invoke the skill directly. We do NOT append the OpenCode
  // message suffix here because Claude treats everything after the skill name
  // as `$ARGUMENTS` (which the skill substitutes into shift paths). The skill
  // body already contains the autonomous instructions.
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
        // Keep `context: fork` skills synchronous so print mode waits for the
        // manager subagent to finish before exiting.
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

/**
 * Ensure the workspace has been init'd. Defaults to `--target=both` so the
 * same workspace can drive shift execution under either runtime without a
 * separate scaffold step.
 */
function ensureInit(): void {
  const opencodeReady = existsSync(join(WORKSPACE_DIR, ".opencode", "commands"));
  const claudeReady = existsSync(join(WORKSPACE_DIR, ".claude", "skills"));
  if (!opencodeReady || !claudeReady) {
    execSync("pnpm build", { cwd: PROJECT_ROOT, stdio: "pipe" });
    const binPath = join(PROJECT_ROOT, "bin", "nightshift.js");
    execSync(`node ${binPath} init --target=both`, {
      cwd: WORKSPACE_DIR,
      stdio: "pipe",
    });
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

const SHIFT_OUTPUT_CHECKS = (): Check[] => {
  const shiftDir = `.nightshift/${TEST_SHIFT_NAME}`;
  return [
    { label: "alpha.txt exists", type: "file", path: `${shiftDir}/alpha.txt` },
    { label: "beta.txt exists", type: "file", path: `${shiftDir}/beta.txt` },
    { label: "gamma.txt exists", type: "file", path: `${shiftDir}/gamma.txt` },
  ];
};

const SHIFT_RUN_MESSAGE = "Start the shift immediately. Do not ask for confirmation.";

const tests: TestDefinition[] = [
  // -- 1. Init test --
  {
    name: "init",
    run: async () => {
      // Remove both runtime trees so init runs fresh for this test
      for (const subdir of [".opencode", ".claude", ".nightshift"]) {
        const p = join(WORKSPACE_DIR, subdir);
        if (existsSync(p)) rmSync(p, { recursive: true });
      }
      // Also remove a possibly-scaffolded CLAUDE.md from a previous run
      const claudeMd = join(WORKSPACE_DIR, "CLAUDE.md");
      if (existsSync(claudeMd)) rmSync(claudeMd);

      execSync("pnpm build", { cwd: PROJECT_ROOT, stdio: "pipe" });
      const binPath = join(PROJECT_ROOT, "bin", "nightshift.js");
      await runCommand("node", [binPath, "init", "--target=both"], {
        cwd: WORKSPACE_DIR,
      });
    },
    checks: () => [
      // Shared
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
      // OpenCode layout
      { label: ".opencode/agents/ dir", type: "dir", path: ".opencode/agents" },
      { label: ".opencode/commands/ dir", type: "dir", path: ".opencode/commands" },
      {
        label: "opencode manager",
        type: "file",
        path: ".opencode/agents/nightshift-manager.md",
      },
      {
        label: "opencode dev",
        type: "file",
        path: ".opencode/agents/nightshift-dev.md",
      },
      {
        label: "opencode create cmd",
        type: "file",
        path: ".opencode/commands/nightshift-create.md",
      },
      {
        label: "opencode start cmd",
        type: "file",
        path: ".opencode/commands/nightshift-start.md",
      },
      // Claude layout
      { label: ".claude/agents/ dir", type: "dir", path: ".claude/agents" },
      { label: ".claude/skills/ dir", type: "dir", path: ".claude/skills" },
      {
        label: "claude manager",
        type: "file",
        path: ".claude/agents/nightshift-manager.md",
      },
      {
        label: "claude dev",
        type: "file",
        path: ".claude/agents/nightshift-dev.md",
      },
      {
        label: "claude start skill",
        type: "file",
        path: ".claude/skills/nightshift-start/SKILL.md",
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
    run: async (runtime) => {
      ensureInit();
      cleanShift();
      setupShift({
        manager: FIXTURE_MANAGER_WITH_TASK,
        table: FIXTURE_TABLE_WITH_DATA,
        taskFile: { name: FIXTURE_TASK_NAME, content: FIXTURE_TASK_FILE },
      });
      await runShiftCommand(runtime, "nightshift-start", TEST_SHIFT_NAME, {
        messageSuffix: SHIFT_RUN_MESSAGE,
      });
    },
    checks: SHIFT_OUTPUT_CHECKS,
  },

  // -- 3. nightshift-start-parallel --
  {
    name: "nightshift-start-parallel",
    run: async (runtime) => {
      ensureInit();
      cleanShift();
      setupShift({
        manager: FIXTURE_MANAGER_PARALLEL,
        table: FIXTURE_TABLE_WITH_DATA,
        taskFile: { name: FIXTURE_TASK_NAME, content: FIXTURE_TASK_FILE },
      });
      await runShiftCommand(runtime, "nightshift-start", TEST_SHIFT_NAME, {
        messageSuffix: SHIFT_RUN_MESSAGE,
      });
    },
    checks: SHIFT_OUTPUT_CHECKS,
  },

  // -- 4. nightshift-start-no-self-improvement --
  {
    name: "nightshift-start-no-self-improvement",
    run: async (runtime) => {
      ensureInit();
      cleanShift();
      setupShift({
        manager: FIXTURE_MANAGER_NO_SELF_IMPROVEMENT,
        table: FIXTURE_TABLE_WITH_DATA,
        taskFile: { name: FIXTURE_TASK_NAME, content: FIXTURE_TASK_FILE },
      });
      await runShiftCommand(runtime, "nightshift-start", TEST_SHIFT_NAME, {
        messageSuffix: SHIFT_RUN_MESSAGE,
      });
    },
    checks: SHIFT_OUTPUT_CHECKS,
  },

  // -- 5. nightshift-start-parallel-no-self-improvement --
  {
    name: "nightshift-start-parallel-no-self-improvement",
    run: async (runtime) => {
      ensureInit();
      cleanShift();
      setupShift({
        manager: FIXTURE_MANAGER_PARALLEL_NO_SELF_IMPROVEMENT,
        table: FIXTURE_TABLE_WITH_DATA,
        taskFile: { name: FIXTURE_TASK_NAME, content: FIXTURE_TASK_FILE },
      });
      await runShiftCommand(runtime, "nightshift-start", TEST_SHIFT_NAME, {
        messageSuffix: SHIFT_RUN_MESSAGE,
      });
    },
    checks: SHIFT_OUTPUT_CHECKS,
  },
];

/**
 * Tests that don't depend on a runtime (e.g. `init`). They still need to run
 * once but should not be repeated per runtime.
 */
const RUNTIME_AGNOSTIC_TESTS = new Set<string>(["init"]);

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("Nightshift Integration Test Runner");
  console.log("=".repeat(80));

  // Pre-flight: figure out which runtimes to test.
  const runtimes = resolveRuntimes();
  console.log(`Runtimes: ${runtimes.join(", ")}`);

  // Setup workspace
  setupWorkspace();
  console.log(`Workspace: ${WORKSPACE_DIR}`);

  // Load benchmarks
  const benchmarks = loadBenchmarks();

  const results: TestResult[] = [];

  // Build the run plan. Runtime-agnostic tests run once with an arbitrary
  // runtime label (we just use the first selected runtime's value but the
  // result row reports "shared"). Runtime-specific tests run once per
  // selected runtime and the test name is suffixed with the runtime.
  type PlannedTest = {
    runtime: Runtime;
    test: TestDefinition;
    displayName: string;
    benchmarkKey: string;
  };

  const plan: PlannedTest[] = [];
  const runtimeAgnosticDone = new Set<string>();

  // Always run runtime-agnostic tests first (init creates the workspace).
  for (const test of tests) {
    if (RUNTIME_AGNOSTIC_TESTS.has(test.name)) {
      plan.push({
        runtime: runtimes[0],
        test,
        displayName: test.name,
        benchmarkKey: test.name,
      });
      runtimeAgnosticDone.add(test.name);
    }
  }

  // Then runtime-specific tests, one entry per selected runtime.
  for (const runtime of runtimes) {
    for (const test of tests) {
      if (runtimeAgnosticDone.has(test.name)) continue;
      plan.push({
        runtime,
        test,
        displayName: `${test.name} [${runtime}]`,
        benchmarkKey: `${test.name}.${runtime}`,
      });
    }
  }

  try {
    for (const planned of plan) {
      const { runtime, test, displayName, benchmarkKey } = planned;
      console.log(`\nRunning: ${displayName}...`);
      const startTime = performance.now();

      let error: string | undefined;
      try {
        await test.run(runtime);
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
      const priorBenchmark = benchmarks[benchmarkKey]?.durationMs ?? null;
      let benchResult: { status: "NEW" | "FASTER" | "OK" | "SLOW"; delta?: string; priorMs: number | null };

      if (pass) {
        benchResult = compareBenchmark(benchmarkKey, durationMs, benchmarks);

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
        name: displayName,
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
        test: benchmarkKey,
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
