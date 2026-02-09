/**
 * Integration test for config-merger.ts
 *
 * Exercises three scenarios:
 *   1. No existing opencode.jsonc — full template is written
 *   2. Existing file without Nightshift agents — agents are added, comments preserved
 *   3. Existing file with stale Nightshift agents — agents updated, non-Nightshift config preserved
 *
 * Also verifies idempotency: running the merger twice produces identical output.
 *
 * Run with: node --import tsx test/config-merger.test.ts
 */

import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mergeOpencodeConfig } from "../src/core/config-merger.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    console.error(`  FAIL: ${message}`);
  }
}

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), "nightshift-merger-test-"));
}

function cleanup(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Scenario 1: No existing file
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 1: No existing opencode.jsonc ---");
{
  const dir = makeTmpDir();
  try {
    const result = mergeOpencodeConfig(dir);
    assert(result.action === "created", `action is "created" (got "${result.action}")`);

    const content = readFileSync(join(dir, "opencode.jsonc"), "utf-8");
    assert(content.includes('"nightshift-manager"'), "contains nightshift-manager");
    assert(content.includes('"nightshift-dev"'), "contains nightshift-dev");
    assert(content.includes('"nightshift-qa"'), "contains nightshift-qa");
    assert(content.includes("// Nightshift manager"), "contains template comments");
  } finally {
    cleanup(dir);
  }
}

// ---------------------------------------------------------------------------
// Scenario 2: Existing file without Nightshift agents
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 2: Existing file without Nightshift agents ---");
{
  const dir = makeTmpDir();
  try {
    const existingContent = `{
  "$schema": "https://opencode.ai/config.json",
  // My custom MCP config
  "mcp": {
    "my-server": { "url": "http://localhost:3000" }
  },

  // Global permissions
  "permission": {
    "bash": {
      "*": "ask",
      "openspec list*": "allow"
    }
  },

  // My existing agents
  "agent": {
    "my-custom-agent": {
      "description": "A custom agent that does cool things",
      "mode": "subagent"
    }
  }
}
`;
    writeFileSync(join(dir, "opencode.jsonc"), existingContent, "utf-8");

    const result = mergeOpencodeConfig(dir);
    assert(result.action === "merged", `action is "merged" (got "${result.action}")`);

    const content = readFileSync(join(dir, "opencode.jsonc"), "utf-8");

    // Nightshift agents added
    assert(content.includes('"nightshift-manager"'), "contains nightshift-manager after merge");
    assert(content.includes('"nightshift-dev"'), "contains nightshift-dev after merge");
    assert(content.includes('"nightshift-qa"'), "contains nightshift-qa after merge");

    // Existing config preserved
    assert(content.includes('"my-custom-agent"'), "preserves existing agent");
    assert(content.includes('"my-server"'), "preserves existing MCP config");
    assert(content.includes('"openspec list*"'), "preserves existing bash permissions");

    // Comments preserved
    assert(content.includes("// My custom MCP config"), "preserves user comment (MCP)");
    assert(content.includes("// Global permissions"), "preserves user comment (permissions)");
    assert(content.includes("// My existing agents"), "preserves user comment (agents)");
  } finally {
    cleanup(dir);
  }
}

// ---------------------------------------------------------------------------
// Scenario 3: Existing file with stale Nightshift agents
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 3: Existing file with stale Nightshift agents ---");
{
  const dir = makeTmpDir();
  try {
    const staleContent = `{
  "$schema": "https://opencode.ai/config.json",
  // User comment at top
  "mcp": {},

  "permission": {
    "bash": {
      "*": "ask",
      "openspec list*": "allow"
    }
  },

  "agent": {
    // User's own agent
    "my-agent": {
      "description": "My agent",
      "mode": "subagent"
    },
    // Stale nightshift manager with old config
    "nightshift-manager": {
      "description": "OLD description that should be replaced",
      "mode": "subagent",
      "tools": {
        "write": false
      }
    },
    "nightshift-dev": {
      "description": "OLD dev description",
      "mode": "subagent"
    },
    "nightshift-qa": {
      "description": "OLD qa description",
      "mode": "subagent"
    }
  }
}
`;
    writeFileSync(join(dir, "opencode.jsonc"), staleContent, "utf-8");

    const result = mergeOpencodeConfig(dir);
    assert(result.action === "merged", `action is "merged" (got "${result.action}")`);

    const content = readFileSync(join(dir, "opencode.jsonc"), "utf-8");

    // Agents updated with current descriptions
    assert(
      content.includes("Orchestrate a Nightshift shift"),
      "manager description updated from stale"
    );
    assert(
      content.includes("Execute Nightshift task steps"),
      "dev description updated from stale"
    );
    assert(
      content.includes("Verify Nightshift task completion"),
      "qa description updated from stale"
    );

    // Old descriptions gone
    assert(!content.includes("OLD description"), "old manager description removed");
    assert(!content.includes("OLD dev description"), "old dev description removed");
    assert(!content.includes("OLD qa description"), "old qa description removed");

    // Non-Nightshift config preserved
    assert(content.includes('"my-agent"'), "preserves user agent");
    assert(content.includes('"openspec list*"'), "preserves openspec bash permission");

    // Comments preserved
    assert(content.includes("// User comment at top"), "preserves top-level user comment");
    assert(content.includes("// User's own agent"), "preserves user agent comment");
  } finally {
    cleanup(dir);
  }
}

// ---------------------------------------------------------------------------
// Scenario 4: Idempotency — running twice produces identical output
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 4: Idempotency ---");
{
  const dir = makeTmpDir();
  try {
    const existingContent = `{
  "$schema": "https://opencode.ai/config.json",
  // Keep this comment
  "mcp": {},
  "permission": {
    "bash": { "*": "ask" }
  },
  "agent": {
    "other-agent": { "description": "Not nightshift", "mode": "subagent" }
  }
}
`;
    writeFileSync(join(dir, "opencode.jsonc"), existingContent, "utf-8");

    // First merge
    mergeOpencodeConfig(dir);
    const firstPass = readFileSync(join(dir, "opencode.jsonc"), "utf-8");

    // Second merge
    mergeOpencodeConfig(dir);
    const secondPass = readFileSync(join(dir, "opencode.jsonc"), "utf-8");

    assert(firstPass === secondPass, "two consecutive merges produce identical output");
  } finally {
    cleanup(dir);
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) {
  process.exit(1);
}
