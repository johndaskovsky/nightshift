#!/usr/bin/env tsx
/**
 * Nightshift init/scaffolder tests.
 *
 * These tests do NOT require Claude Code — they exercise the `nightshift init`
 * scaffolder against temporary fixture directories. Run before `run-tests.ts`
 * (which requires Claude Code and runs full shifts).
 *
 * Usage: tsx test/init-tests.ts
 */

import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
  statSync,
  readdirSync,
} from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");
const FIXTURES_ROOT = join(__dirname, "init-workspace");
const BIN_PATH = join(PROJECT_ROOT, "bin", "nightshift.js");
const BENCHMARKS_PATH = join(__dirname, "benchmarks.json");

interface TestCase {
  name: string;
  run: () => void;
}

const failures: { name: string; reason: string }[] = [];
const successes: string[] = [];
const benchmarks: Record<string, { durationMs: number; updatedAt: string }> = (() => {
  if (!existsSync(BENCHMARKS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(BENCHMARKS_PATH, "utf-8")) as Record<
      string,
      { durationMs: number; updatedAt: string }
    >;
  } catch {
    return {};
  }
})();

function ensureBuild(): void {
  if (!existsSync(join(PROJECT_ROOT, "dist", "cli", "index.js"))) {
    execSync("pnpm build", { cwd: PROJECT_ROOT, stdio: "pipe" });
  }
}

function newFixture(name: string): string {
  const dir = join(FIXTURES_ROOT, name);
  if (existsSync(dir)) rmSync(dir, { recursive: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

function runInit(
  cwd: string,
  args: string[] = [],
): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(`node ${BIN_PATH} init ${args.join(" ")}`, {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number };
    return {
      stdout: e.stdout?.toString() ?? "",
      stderr: e.stderr?.toString() ?? "",
      exitCode: e.status ?? 1,
    };
  }
}

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

function assertExists(path: string, label: string): void {
  assert(existsSync(path), `expected to exist: ${label} (${path})`);
}

function readFile(path: string): string {
  return readFileSync(path, "utf-8");
}

function assertContains(haystack: string, needle: string, label: string): void {
  assert(haystack.includes(needle), `expected ${label} to contain "${needle}"`);
}

function frontmatter(filePath: string): { front: string; body: string } {
  const raw = readFile(filePath);
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  assert(match, `expected YAML frontmatter in ${filePath}`);
  return { front: match[1], body: match[2] };
}

const tests: TestCase[] = [
  {
    name: "init writes the full Claude layout",
    run: () => {
      const dir = newFixture("claude-layout");
      const { exitCode } = runInit(dir);
      assert(exitCode === 0, "nightshift init exited non-zero");
      for (const p of [
        ".claude/agents/nightshift-manager.md",
        ".claude/agents/nightshift-dev.md",
        ".claude/skills/nightshift-create/SKILL.md",
        ".claude/skills/nightshift-add-task/SKILL.md",
        ".claude/skills/nightshift-update-table/SKILL.md",
        ".claude/skills/nightshift-start/SKILL.md",
        ".claude/skills/nightshift-test-task/SKILL.md",
        ".claude/skills/nightshift-archive/SKILL.md",
        ".claude/skills/nightshift-create/scripts/init-shift.sh",
        ".claude/skills/nightshift-start/scripts/preflight.sh",
        ".claude/skills/nightshift-archive/scripts/archive.sh",
        ".claude/settings.json",
        "CLAUDE.md",
        ".nightshift/.gitignore",
      ]) {
        assertExists(join(dir, p), p);
      }
      const startScript = join(dir, ".claude/skills/nightshift-start/scripts/preflight.sh");
      const mode = statSync(startScript).mode;
      assert((mode & 0o111) !== 0, "preflight.sh should be executable");
    },
  },
  {
    name: "init rejects the legacy --target flag",
    run: () => {
      const dir = newFixture("legacy-target-flag");
      const { exitCode, stdout, stderr } = runInit(dir, ["--target=claude"]);
      assert(exitCode !== 0, "init should exit non-zero for unknown flag");
      assertContains(
        stdout + stderr,
        "unknown option",
        "commander error for unknown --target flag",
      );
    },
  },
  {
    name: "every SKILL.md has disable-model-invocation and allowed-tools",
    run: () => {
      const dir = newFixture("skill-frontmatter");
      runInit(dir);
      const skillsDir = join(dir, ".claude/skills");
      const skillNames = readdirSync(skillsDir).filter((n) =>
        statSync(join(skillsDir, n)).isDirectory(),
      );
      assert(skillNames.length === 6, `expected 6 skills, got ${skillNames.length}`);
      for (const name of skillNames) {
        const path = join(skillsDir, name, "SKILL.md");
        const { front } = frontmatter(path);
        assertContains(front, "disable-model-invocation: true", `${name} disable-model-invocation`);
        assertContains(front, "Bash(qsv *)", `${name} allowed-tools qsv`);
        assertContains(front, "Bash(flock *)", `${name} allowed-tools flock`);
      }
    },
  },
  {
    name: "nightshift-start SKILL.md uses context: fork + agent: nightshift-manager",
    run: () => {
      const dir = newFixture("start-fork");
      runInit(dir);
      const { front } = frontmatter(join(dir, ".claude/skills/nightshift-start/SKILL.md"));
      assertContains(front, "context: fork", "context: fork");
      assertContains(front, "agent: nightshift-manager", "agent: nightshift-manager");
    },
  },
  {
    name: "claude manager body under 20000 characters",
    run: () => {
      const dir = newFixture("manager-budget");
      runInit(dir);
      const { body } = frontmatter(join(dir, ".claude/agents/nightshift-manager.md"));
      assert(
        body.length < 20000,
        `manager body must be < 20000 chars, got ${body.length}`,
      );
    },
  },
  {
    name: "settings.json idempotent re-runs",
    run: () => {
      const dir = newFixture("settings-idempotent");
      runInit(dir);
      runInit(dir);
      runInit(dir);
      const settings = JSON.parse(readFile(join(dir, ".claude/settings.json")));
      const allow: string[] = settings.permissions.allow;
      const qsvCount = allow.filter((e) => e === "Bash(qsv *)").length;
      const flockCount = allow.filter((e) => e === "Bash(flock *)").length;
      assert(qsvCount === 1, `expected 1 qsv entry, got ${qsvCount}`);
      assert(flockCount === 1, `expected 1 flock entry, got ${flockCount}`);
    },
  },
  {
    name: "settings.json preserves user-authored content",
    run: () => {
      const dir = newFixture("settings-merge");
      mkdirSync(join(dir, ".claude"), { recursive: true });
      writeFileSync(
        join(dir, ".claude/settings.json"),
        JSON.stringify({
          permissions: { allow: ["Bash(ls *)"], deny: ["Bash(rm -rf *)"] },
          theme: "dark",
        }) + "\n",
      );
      runInit(dir);
      const settings = JSON.parse(readFile(join(dir, ".claude/settings.json")));
      assert(settings.theme === "dark", "user theme preserved");
      assert(
        settings.permissions.deny.includes("Bash(rm -rf *)"),
        "user deny rule preserved",
      );
      assert(
        settings.permissions.allow.includes("Bash(ls *)"),
        "user allow rule preserved",
      );
      assert(
        settings.permissions.allow.includes("Bash(qsv *)"),
        "qsv added",
      );
      assert(
        settings.permissions.allow.includes("Bash(flock *)"),
        "flock added",
      );
    },
  },
  {
    name: "malformed settings.json halts init and preserves file",
    run: () => {
      const dir = newFixture("settings-malformed");
      mkdirSync(join(dir, ".claude"), { recursive: true });
      const malformed = "{not valid json";
      writeFileSync(join(dir, ".claude/settings.json"), malformed);
      const { exitCode, stdout, stderr } = runInit(dir);
      assert(exitCode !== 0, "init should exit non-zero on malformed settings.json");
      assertContains(stdout + stderr, "Refusing to overwrite malformed JSON", "error message");
      const after = readFile(join(dir, ".claude/settings.json"));
      assert(after === malformed, "malformed settings.json should be unchanged");
    },
  },
  {
    name: "CLAUDE.md marker replacement preserves surrounding content and is idempotent",
    run: () => {
      const dir = newFixture("claudemd-markers");
      const userContent =
        "# My Project\n\nIntro paragraph.\n\n<!-- nightshift:start -->\nold section\n<!-- nightshift:end -->\n\nUser paragraph after.\n";
      writeFileSync(join(dir, "CLAUDE.md"), userContent);
      runInit(dir);
      const after1 = readFile(join(dir, "CLAUDE.md"));
      assertContains(after1, "# My Project", "preserved heading");
      assertContains(after1, "User paragraph after.", "preserved trailing content");
      assertContains(after1, "Nightshift", "Nightshift section present");
      assert(
        !after1.includes("old section"),
        "old Nightshift section should be replaced",
      );
      runInit(dir);
      const after2 = readFile(join(dir, "CLAUDE.md"));
      const startCount = (after2.match(/nightshift:start/g) ?? []).length;
      const endCount = (after2.match(/nightshift:end/g) ?? []).length;
      assert(startCount === 1, `expected 1 start marker, got ${startCount}`);
      assert(endCount === 1, `expected 1 end marker, got ${endCount}`);
    },
  },
  {
    name: "CLAUDE.md append-and-warn when markers absent",
    run: () => {
      const dir = newFixture("claudemd-append");
      writeFileSync(join(dir, "CLAUDE.md"), "# Existing Project\n\nUser content.\n");
      const { stdout } = runInit(dir);
      const after = readFile(join(dir, "CLAUDE.md"));
      assertContains(after, "# Existing Project", "preserved original heading");
      assertContains(after, "<!-- nightshift:start -->", "appended start marker");
      assertContains(after, "<!-- nightshift:end -->", "appended end marker");
      assertContains(stdout, "did not contain Nightshift markers", "warning emitted");
    },
  },
  {
    name: "init benchmark",
    run: () => {
      const dir = newFixture("benchmark-init");
      const t0 = performance.now();
      const { exitCode } = runInit(dir);
      const durationMs = Math.round(performance.now() - t0);
      assert(exitCode === 0, "init failed");
      const key = "init";
      const prior = benchmarks[key];
      benchmarks[key] = {
        durationMs:
          prior && durationMs > prior.durationMs ? prior.durationMs : durationMs,
        updatedAt: new Date().toISOString(),
      };
      writeFileSync(BENCHMARKS_PATH, JSON.stringify(benchmarks, null, 2) + "\n");
      assert(durationMs < 5000, `init too slow: ${durationMs}ms`);
    },
  },
];

function main(): void {
  console.log("Nightshift init/scaffolder tests");
  console.log("=".repeat(60));

  ensureBuild();
  if (existsSync(FIXTURES_ROOT)) rmSync(FIXTURES_ROOT, { recursive: true });
  mkdirSync(FIXTURES_ROOT, { recursive: true });

  for (const test of tests) {
    process.stdout.write(`  ${test.name} ... `);
    try {
      test.run();
      successes.push(test.name);
      console.log("PASS");
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      failures.push({ name: test.name, reason });
      console.log("FAIL");
      console.log(`    ${reason}`);
    }
  }

  console.log("=".repeat(60));
  console.log(
    `${successes.length}/${tests.length} passed${failures.length > 0 ? `, ${failures.length} failed` : ""}`,
  );

  if (failures.length === 0 && existsSync(FIXTURES_ROOT)) {
    rmSync(FIXTURES_ROOT, { recursive: true });
  }

  process.exit(failures.length === 0 ? 0 : 1);
}

main();
