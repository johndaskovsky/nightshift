#!/usr/bin/env tsx
/**
 * Nightshift init/scaffolder tests.
 *
 * These tests do NOT require OpenCode or Claude Code — they exercise the
 * `nightshift init` scaffolder against temporary fixture directories. Run
 * before `run-tests.ts` (which requires OpenCode and runs full shifts).
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
const PROSE_PARITY_TOLERANCE_PCT = 8;

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
    // 8.1 — regression: --target=opencode produces only .opencode/ and .nightshift/
    name: "init --target=opencode (regression)",
    run: () => {
      const dir = newFixture("opencode-only");
      const { exitCode, stdout } = runInit(dir, ["--target=opencode"]);
      assert(exitCode === 0, `nightshift init exited ${exitCode}\n${stdout}`);
      assertExists(join(dir, ".opencode/agents/nightshift-manager.md"), "opencode manager");
      assertExists(join(dir, ".opencode/agents/nightshift-dev.md"), "opencode dev");
      assertExists(join(dir, ".opencode/commands/nightshift-start.md"), "opencode start cmd");
      assertExists(join(dir, ".nightshift/.gitignore"), "nightshift gitignore");
      assert(!existsSync(join(dir, ".claude")), ".claude/ should NOT exist for opencode target");
      assert(!existsSync(join(dir, "CLAUDE.md")), "CLAUDE.md should NOT exist for opencode target");
    },
  },
  {
    // 8.2 — claude target writes the full Claude layout
    name: "init --target=claude layout",
    run: () => {
      const dir = newFixture("claude-only");
      const { exitCode } = runInit(dir, ["--target=claude"]);
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
      ]) {
        assertExists(join(dir, p), p);
      }
      // No OpenCode artifacts
      assert(!existsSync(join(dir, ".opencode")), ".opencode/ should NOT exist for claude target");
      // Scripts are executable
      const startScript = join(dir, ".claude/skills/nightshift-start/scripts/preflight.sh");
      const mode = statSync(startScript).mode;
      assert((mode & 0o111) !== 0, "preflight.sh should be executable");
    },
  },
  {
    // 8.3 — both target writes both trees
    name: "init --target=both writes both trees",
    run: () => {
      const dir = newFixture("both");
      const { exitCode } = runInit(dir, ["--target=both"]);
      assert(exitCode === 0, "nightshift init exited non-zero");
      assertExists(join(dir, ".opencode/agents/nightshift-manager.md"), "opencode manager");
      assertExists(join(dir, ".claude/agents/nightshift-manager.md"), "claude manager");
      assertExists(join(dir, ".claude/skills/nightshift-start/SKILL.md"), "claude start skill");
      assertExists(join(dir, "CLAUDE.md"), "CLAUDE.md");
    },
  },
  {
    // 8.4 — auto-detect when only .claude/ exists
    name: "init auto-detects claude when .claude/ exists",
    run: () => {
      const dir = newFixture("autodetect-claude");
      mkdirSync(join(dir, ".claude"), { recursive: true });
      const { exitCode, stdout } = runInit(dir, []);
      assert(exitCode === 0, "init exited non-zero");
      assertContains(stdout, "Target: claude (auto-detected)", "auto-detect output");
      assert(!existsSync(join(dir, ".opencode")), ".opencode/ should NOT exist after auto-detect=claude");
      assertExists(join(dir, ".claude/skills/nightshift-start/SKILL.md"), "start skill");
    },
  },
  {
    // 8.5 — every Claude SKILL.md sets disable-model-invocation: true and allowed-tools
    name: "every SKILL.md has disable-model-invocation and allowed-tools",
    run: () => {
      const dir = newFixture("skill-frontmatter");
      runInit(dir, ["--target=claude"]);
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
    // 8.6 — start skill uses context: fork + agent: nightshift-manager
    name: "nightshift-start SKILL.md uses context: fork + agent: nightshift-manager",
    run: () => {
      const dir = newFixture("start-fork");
      runInit(dir, ["--target=claude"]);
      const { front } = frontmatter(join(dir, ".claude/skills/nightshift-start/SKILL.md"));
      assertContains(front, "context: fork", "context: fork");
      assertContains(front, "agent: nightshift-manager", "agent: nightshift-manager");
    },
  },
  {
    // 8.7 — Claude manager body is under 20000 characters
    name: "claude manager body under 20000 characters",
    run: () => {
      const dir = newFixture("manager-budget");
      runInit(dir, ["--target=claude"]);
      const { body } = frontmatter(join(dir, ".claude/agents/nightshift-manager.md"));
      assert(
        body.length < 20000,
        `manager body must be < 20000 chars, got ${body.length}`,
      );
    },
  },
  {
    // 8.8 — settings.json idempotency
    name: "settings.json idempotent re-runs",
    run: () => {
      const dir = newFixture("settings-idempotent");
      runInit(dir, ["--target=claude"]);
      runInit(dir, ["--target=claude"]);
      runInit(dir, ["--target=claude"]);
      const settings = JSON.parse(readFile(join(dir, ".claude/settings.json")));
      const allow: string[] = settings.permissions.allow;
      const qsvCount = allow.filter((e) => e === "Bash(qsv *)").length;
      const flockCount = allow.filter((e) => e === "Bash(flock *)").length;
      assert(qsvCount === 1, `expected 1 qsv entry, got ${qsvCount}`);
      assert(flockCount === 1, `expected 1 flock entry, got ${flockCount}`);
    },
  },
  {
    // 8.9 — settings.json preserves user content during merge
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
      runInit(dir, ["--target=claude"]);
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
    // 8.10 — malformed settings.json halts init
    name: "malformed settings.json halts init and preserves file",
    run: () => {
      const dir = newFixture("settings-malformed");
      mkdirSync(join(dir, ".claude"), { recursive: true });
      const malformed = "{not valid json";
      writeFileSync(join(dir, ".claude/settings.json"), malformed);
      const { exitCode, stdout, stderr } = runInit(dir, ["--target=claude"]);
      assert(exitCode !== 0, "init should exit non-zero on malformed settings.json");
      assertContains(stdout + stderr, "Refusing to overwrite malformed JSON", "error message");
      const after = readFile(join(dir, ".claude/settings.json"));
      assert(after === malformed, "malformed settings.json should be unchanged");
    },
  },
  {
    // 8.11 — CLAUDE.md marker-based replacement is idempotent and preserves surrounding content
    name: "CLAUDE.md marker replacement preserves surrounding content and is idempotent",
    run: () => {
      const dir = newFixture("claudemd-markers");
      const userContent =
        "# My Project\n\nIntro paragraph.\n\n<!-- nightshift:start -->\nold section\n<!-- nightshift:end -->\n\nUser paragraph after.\n";
      writeFileSync(join(dir, "CLAUDE.md"), userContent);
      runInit(dir, ["--target=claude"]);
      const after1 = readFile(join(dir, "CLAUDE.md"));
      assertContains(after1, "# My Project", "preserved heading");
      assertContains(after1, "User paragraph after.", "preserved trailing content");
      assertContains(after1, "Nightshift", "Nightshift section present");
      assert(
        !after1.includes("old section"),
        "old Nightshift section should be replaced",
      );
      // Idempotent
      runInit(dir, ["--target=claude"]);
      const after2 = readFile(join(dir, "CLAUDE.md"));
      const startCount = (after2.match(/nightshift:start/g) ?? []).length;
      const endCount = (after2.match(/nightshift:end/g) ?? []).length;
      assert(startCount === 1, `expected 1 start marker, got ${startCount}`);
      assert(endCount === 1, `expected 1 end marker, got ${endCount}`);
    },
  },
  {
    // 8.12 — CLAUDE.md append-and-warn when markers absent
    name: "CLAUDE.md append-and-warn when markers absent",
    run: () => {
      const dir = newFixture("claudemd-append");
      writeFileSync(join(dir, "CLAUDE.md"), "# Existing Project\n\nUser content.\n");
      const { stdout } = runInit(dir, ["--target=claude"]);
      const after = readFile(join(dir, "CLAUDE.md"));
      assertContains(after, "# Existing Project", "preserved original heading");
      assertContains(after, "<!-- nightshift:start -->", "appended start marker");
      assertContains(after, "<!-- nightshift:end -->", "appended end marker");
      assertContains(stdout, "did not contain Nightshift markers", "warning emitted");
    },
  },
  {
    // 8.13 — prose parity: OpenCode and Claude manager bodies match modulo
    // a small allowlist of substitutions. Compares character lengths of the
    // bodies after stripping frontmatter and runtime-specific phrases.
    name: "manager prose parity (OpenCode ↔ Claude)",
    run: () => {
      const opencodePath = join(
        PROJECT_ROOT,
        "templates/opencode/agents/nightshift-manager.md",
      );
      const claudePath = join(PROJECT_ROOT, "templates/claude/agents/nightshift-manager.md");
      const { body: ocBody } = frontmatter(opencodePath);
      const { body: clBody } = frontmatter(claudePath);
      const norm = (s: string): string =>
        s
          .replace(/Task tool/g, "Agent")
          .replace(/spawn a `nightshift-dev` subagent/g, "invoke the nightshift-dev agent")
          .replace(/spawn N `nightshift-dev` subagents/gi, "invoke N nightshift-dev agents")
          .replace(/dev subagent/gi, "dev agent")
          .replace(/Agent tool/g, "Task tool")
          .replace(/N parallel Agent tool calls/gi, "N parallel Task tool calls")
          .replace(/\s+/g, " ")
          .trim();
      const ocNorm = norm(ocBody);
      const clNorm = norm(clBody);
      const longer = Math.max(ocNorm.length, clNorm.length);
      const shorter = Math.min(ocNorm.length, clNorm.length);
      const driftPct = ((longer - shorter) / longer) * 100;
      assert(
        driftPct < PROSE_PARITY_TOLERANCE_PCT,
        `manager prose drifted ${driftPct.toFixed(1)}% (threshold ${PROSE_PARITY_TOLERANCE_PCT}%); update tolerance or re-sync templates`,
      );
    },
  },
  {
    // 8.14 — benchmark entry: track init --target=claude duration
    name: "init --target=claude benchmark",
    run: () => {
      const dir = newFixture("benchmark-claude");
      const t0 = performance.now();
      const { exitCode } = runInit(dir, ["--target=claude"]);
      const durationMs = Math.round(performance.now() - t0);
      assert(exitCode === 0, "init failed");
      const key = "init-claude";
      const prior = benchmarks[key];
      benchmarks[key] = {
        durationMs:
          prior && durationMs > prior.durationMs ? prior.durationMs : durationMs,
        updatedAt: new Date().toISOString(),
      };
      writeFileSync(BENCHMARKS_PATH, JSON.stringify(benchmarks, null, 2) + "\n");
      // sanity: should run in well under 5s
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

  // Cleanup fixtures on success
  if (failures.length === 0 && existsSync(FIXTURES_ROOT)) {
    rmSync(FIXTURES_ROOT, { recursive: true });
  }

  process.exit(failures.length === 0 ? 0 : 1);
}

main();
