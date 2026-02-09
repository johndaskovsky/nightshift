import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as jsonc from "jsonc-parser";
import { getTemplatePath } from "./templates.js";

/** The three Nightshift agent keys */
const NIGHTSHIFT_AGENT_KEYS = [
  "nightshift-manager",
  "nightshift-dev",
  "nightshift-qa",
] as const;

export interface MergeResult {
  action: "created" | "merged";
  path: string;
}

/**
 * Create or merge opencode.jsonc in the target project.
 *
 * Strategy:
 * - If no file exists: copy the full template
 * - If file exists: parse it, merge only the three Nightshift agent entries
 *   into the "agent" block, preserving everything else including comments
 */
export function mergeOpencodeConfig(targetDir: string): MergeResult {
  const targetPath = join(targetDir, "opencode.jsonc");
  const templatePath = getTemplatePath("opencode.jsonc");
  const templateContent = readFileSync(templatePath, "utf-8");

  if (!existsSync(targetPath)) {
    // No existing file — write the full template
    writeFileSync(targetPath, templateContent, "utf-8");
    return { action: "created", path: targetPath };
  }

  // Existing file — merge the agent block
  const existingContent = readFileSync(targetPath, "utf-8");
  const templateTree = jsonc.parseTree(templateContent);
  const existingTree = jsonc.parseTree(existingContent);

  if (!templateTree || !existingTree) {
    throw new Error("Failed to parse opencode.jsonc files");
  }

  // Extract agent definitions from template
  const templateAgents: Record<string, unknown> = {};
  for (const key of NIGHTSHIFT_AGENT_KEYS) {
    const node = jsonc.findNodeAtLocation(templateTree, ["agent", key]);
    if (node) {
      templateAgents[key] = jsonc.getNodeValue(node);
    }
  }

  // Apply edits to the existing content
  let result = existingContent;

  // Check if "agent" key exists
  const agentNode = jsonc.findNodeAtLocation(existingTree, ["agent"]);

  if (!agentNode) {
    // No "agent" block exists — add one with the Nightshift agents
    const agentBlock: Record<string, unknown> = {};
    for (const key of NIGHTSHIFT_AGENT_KEYS) {
      agentBlock[key] = templateAgents[key];
    }
    const edits = jsonc.modify(result, ["agent"], agentBlock, {
      formattingOptions: { tabSize: 2, insertSpaces: true, eol: "\n" },
    });
    result = jsonc.applyEdits(result, edits);
  } else {
    // "agent" block exists — update each Nightshift agent entry
    for (const key of NIGHTSHIFT_AGENT_KEYS) {
      const edits = jsonc.modify(result, ["agent", key], templateAgents[key], {
        formattingOptions: { tabSize: 2, insertSpaces: true, eol: "\n" },
      });
      result = jsonc.applyEdits(result, edits);
    }
  }

  writeFileSync(targetPath, result, "utf-8");
  return { action: "merged", path: targetPath };
}
