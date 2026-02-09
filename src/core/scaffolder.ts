import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { readdirSync } from "node:fs";
import { getTemplatePath } from "./templates.js";

export interface ScaffoldOptions {
  targetDir: string;
  force?: boolean;
  onWrite?: (path: string, action: "created" | "updated" | "skipped") => void;
}

export interface ScaffoldResult {
  actions: Array<{ path: string; action: "created" | "updated" | "skipped" }>;
}

/**
 * Create the required directory structure for Nightshift.
 */
export function scaffoldDirectories(targetDir: string): void {
  const dirs = [
    join(targetDir, ".nightshift", "archive"),
    join(targetDir, ".opencode", "agent"),
    join(targetDir, ".opencode", "command"),
  ];

  for (const dir of dirs) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Write agent template files to the target project.
 */
export function writeAgentFiles(options: ScaffoldOptions): ScaffoldResult {
  const result: ScaffoldResult = { actions: [] };
  const agentsDir = getTemplatePath("agents");
  const targetAgentDir = join(options.targetDir, ".opencode", "agent");

  const agentFiles = ["nightshift-manager.md", "nightshift-dev.md", "nightshift-qa.md"];

  for (const file of agentFiles) {
    const content = readFileSync(join(agentsDir, file), "utf-8");
    const targetPath = join(targetAgentDir, file);
    const action = existsSync(targetPath) ? "updated" : "created";

    writeFileSync(targetPath, content, "utf-8");
    result.actions.push({ path: targetPath, action });
    options.onWrite?.(targetPath, action);
  }

  return result;
}

/**
 * Write command template files to the target project.
 */
export function writeCommandFiles(options: ScaffoldOptions): ScaffoldResult {
  const result: ScaffoldResult = { actions: [] };
  const commandsDir = getTemplatePath("commands");
  const targetCommandDir = join(options.targetDir, ".opencode", "command");

  const commandFiles = readdirSync(commandsDir).filter(
    (f) => f.startsWith("nightshift-") && f.endsWith(".md")
  );

  for (const file of commandFiles) {
    const content = readFileSync(join(commandsDir, file), "utf-8");
    const targetPath = join(targetCommandDir, file);
    const action = existsSync(targetPath) ? "updated" : "created";

    writeFileSync(targetPath, content, "utf-8");
    result.actions.push({ path: targetPath, action });
    options.onWrite?.(targetPath, action);
  }

  return result;
}

