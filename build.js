#!/usr/bin/env node

/**
 * Build script for @johndaskovsky/nightshift
 *
 * Steps:
 *   1. Compile TypeScript source to JavaScript (dist/).
 *   2. Materialize plugin artifacts (agents/ and skills/) at the package root
 *      from templates/claude/ so the npm package is also installable as a
 *      Claude Code Plugin.
 *   3. Sync the plugin manifest version with package.json.
 *   4. Verify each skill directory has a SKILL.md and that bundled scripts are
 *      executable.
 */

import { execSync } from "node:child_process";
import {
  rmSync,
  existsSync,
  cpSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  chmodSync,
} from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, "dist");
const claudeTemplatesDir = resolve(__dirname, "templates", "claude");
const pluginAgentsDir = resolve(__dirname, "agents");
const pluginSkillsDir = resolve(__dirname, "skills");
const pluginManifestPath = resolve(__dirname, ".claude-plugin", "plugin.json");
const packageJsonPath = resolve(__dirname, "package.json");

// 1. Clean dist
if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true });
  console.log("Cleaned dist/");
}

// 2. Compile TypeScript
console.log("Compiling TypeScript...");
try {
  execSync("npx tsc", { stdio: "inherit", cwd: __dirname });
} catch {
  console.error("TypeScript compilation failed.");
  process.exit(1);
}

// 3. Materialize plugin artifacts at the package root.
// Wipe the previous output to avoid stale files persisting after template
// renames or removals.
for (const dir of [pluginAgentsDir, pluginSkillsDir]) {
  if (existsSync(dir)) rmSync(dir, { recursive: true });
}
cpSync(join(claudeTemplatesDir, "agents"), pluginAgentsDir, { recursive: true });
cpSync(join(claudeTemplatesDir, "skills"), pluginSkillsDir, { recursive: true });
console.log("Materialized plugin agents/ and skills/ from templates/claude/");

// 4. Sync plugin manifest version with package.json
const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
const manifest = JSON.parse(readFileSync(pluginManifestPath, "utf-8"));
if (manifest.version !== pkg.version) {
  manifest.version = pkg.version;
  writeFileSync(pluginManifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
  console.log(`Updated plugin manifest version → ${pkg.version}`);
}

// 5. Verify plugin artifacts: every skill must have a SKILL.md, every script
//    must be executable.
const failures = [];
const skillNames = readdirSync(pluginSkillsDir).filter((name) => {
  return statSync(join(pluginSkillsDir, name)).isDirectory();
});
for (const skillName of skillNames) {
  const skillDir = join(pluginSkillsDir, skillName);
  if (!existsSync(join(skillDir, "SKILL.md"))) {
    failures.push(`skills/${skillName}/SKILL.md missing`);
    continue;
  }
  const scriptsDir = join(skillDir, "scripts");
  if (existsSync(scriptsDir) && statSync(scriptsDir).isDirectory()) {
    for (const scriptName of readdirSync(scriptsDir)) {
      if (!scriptName.endsWith(".sh")) continue;
      const scriptPath = join(scriptsDir, scriptName);
      const mode = statSync(scriptPath).mode;
      if ((mode & 0o111) === 0) {
        // Auto-fix: re-mark executable. cpSync may strip bits on some FSes.
        chmodSync(scriptPath, 0o755);
      }
    }
  }
}

if (failures.length > 0) {
  console.error("Plugin artifact verification failed:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(`Verified ${skillNames.length} skill directories.`);
console.log("Build complete.");
