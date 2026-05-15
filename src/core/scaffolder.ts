import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  renameSync,
  statSync,
  chmodSync,
  unlinkSync,
} from "node:fs";
import { join, relative } from "node:path";
import { getTemplatePath } from "./templates.js";

export type WriteAction = "created" | "updated" | "skipped" | "removed" | "renamed";

export interface ScaffoldOptions {
  targetDir: string;
  onWrite?: (path: string, action: WriteAction) => void;
  onWarn?: (message: string) => void;
}

export interface ScaffoldResult {
  actions: Array<{ path: string; action: WriteAction }>;
}

const NIGHTSHIFT_MARKER_START = "<!-- nightshift:start -->";
const NIGHTSHIFT_MARKER_END = "<!-- nightshift:end -->";
const REQUIRED_BASH_ALLOW: ReadonlyArray<string> = [
  "Bash(qsv *)",
  "Bash(flock *)",
  "Bash(claude *)",
];

/**
 * Sentinel string present in every legacy 2.x `nightshift-dev.md` bundled
 * template. Used to detect an unmodified stale file vs. a user-customized one.
 */
const LEGACY_DEV_SENTINEL = "You are the Nightshift Dev subagent.";

/**
 * Create the required Claude Code directory structure.
 */
export function scaffoldDirectories(targetDir: string): void {
  const dirs: string[] = [
    join(targetDir, ".nightshift", "archive"),
    join(targetDir, ".claude", "agents"),
    join(targetDir, ".claude", "skills"),
  ];
  for (const dir of dirs) {
    mkdirSync(dir, { recursive: true });
  }
}

function writeTemplateFile(
  templateAbsolutePath: string,
  targetAbsolutePath: string,
  options: ScaffoldOptions,
  result: ScaffoldResult,
  mode?: number,
): void {
  const content = readFileSync(templateAbsolutePath, "utf-8");
  const action: WriteAction = existsSync(targetAbsolutePath) ? "updated" : "created";
  mkdirSync(join(targetAbsolutePath, ".."), { recursive: true });
  writeFileSync(targetAbsolutePath, content, "utf-8");
  if (mode !== undefined) {
    chmodSync(targetAbsolutePath, mode);
  }
  result.actions.push({ path: targetAbsolutePath, action });
  options.onWrite?.(targetAbsolutePath, action);
}

/**
 * Write the Claude Code subagent file (manager only — dev runs as a subprocess
 * in 3.x and has no subagent file).
 */
export function writeAgentFiles(options: ScaffoldOptions): ScaffoldResult {
  const result: ScaffoldResult = { actions: [] };
  const agentFiles = ["nightshift-manager.md"];
  const agentsDir = getTemplatePath("claude", "agents");
  const targetAgentDir = join(options.targetDir, ".claude", "agents");
  for (const file of agentFiles) {
    writeTemplateFile(join(agentsDir, file), join(targetAgentDir, file), options, result);
  }
  return result;
}

/**
 * Detect and clean up the legacy `.claude/agents/nightshift-dev.md` file from
 * a Nightshift 2.x install. If the file contents look like the bundled 2.x
 * template (matches our sentinel string), delete silently. Otherwise rename to
 * `<file>.bak.<ISO-timestamp>` and emit a warning.
 *
 * No-op when the file does not exist.
 */
export function removeStaleAgentFiles(options: ScaffoldOptions): ScaffoldResult {
  const result: ScaffoldResult = { actions: [] };
  const staleDevPath = join(options.targetDir, ".claude", "agents", "nightshift-dev.md");
  if (!existsSync(staleDevPath)) return result;

  const content = readFileSync(staleDevPath, "utf-8");
  if (content.includes(LEGACY_DEV_SENTINEL)) {
    unlinkSync(staleDevPath);
    result.actions.push({ path: staleDevPath, action: "removed" });
    options.onWrite?.(staleDevPath, "removed");
    return result;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${staleDevPath}.bak.${timestamp}`;
  renameSync(staleDevPath, backupPath);
  result.actions.push({ path: backupPath, action: "renamed" });
  options.onWrite?.(backupPath, "renamed");
  options.onWarn?.(
    `Legacy customized .claude/agents/nightshift-dev.md detected; backed up to ${relative(options.targetDir, backupPath)}. Dev work in Nightshift 3.x runs as a top-level claude -p subprocess of the /nightshift-do-task skill — review the backup if you had custom prose worth migrating.`,
  );
  return result;
}

/**
 * Write Claude Code skill directories: each skill is a directory containing a
 * `SKILL.md` and optional `scripts/` directory of executables.
 */
export function writeClaudeSkillFiles(options: ScaffoldOptions): ScaffoldResult {
  const result: ScaffoldResult = { actions: [] };
  const skillsDir = getTemplatePath("claude", "skills");
  const targetSkillsDir = join(options.targetDir, ".claude", "skills");

  const skillNames = readdirSync(skillsDir).filter((name) => {
    const full = join(skillsDir, name);
    return statSync(full).isDirectory() && name.startsWith("nightshift-");
  });

  for (const skillName of skillNames) {
    const sourceDir = join(skillsDir, skillName);
    const destDir = join(targetSkillsDir, skillName);
    copySkillDir(sourceDir, destDir, options, result);
  }

  return result;
}

function copySkillDir(
  sourceDir: string,
  destDir: string,
  options: ScaffoldOptions,
  result: ScaffoldResult,
): void {
  mkdirSync(destDir, { recursive: true });
  const entries = readdirSync(sourceDir);
  for (const entry of entries) {
    const sourcePath = join(sourceDir, entry);
    const destPath = join(destDir, entry);
    const stat = statSync(sourcePath);
    if (stat.isDirectory()) {
      copySkillDir(sourcePath, destPath, options, result);
    } else if (stat.isFile()) {
      const isScript = entry.endsWith(".sh") || (stat.mode & 0o111) !== 0;
      writeTemplateFile(sourcePath, destPath, options, result, isScript ? 0o755 : undefined);
    }
  }
}

/**
 * Create or merge `.claude/settings.json` to ensure `permissions.allow` includes
 * the entries Nightshift's subagents need (`Bash(qsv *)`, `Bash(flock *)`).
 *
 * Aborts (throws) if an existing `settings.json` is malformed JSON.
 */
export function writeClaudeSettingsFile(options: ScaffoldOptions): ScaffoldResult {
  const result: ScaffoldResult = { actions: [] };
  const targetPath = join(options.targetDir, ".claude", "settings.json");
  mkdirSync(join(options.targetDir, ".claude"), { recursive: true });

  let parsed: Record<string, unknown> = {};
  let action: WriteAction = "created";

  if (existsSync(targetPath)) {
    action = "updated";
    const raw = readFileSync(targetPath, "utf-8");
    try {
      parsed = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("settings.json must contain a JSON object at the top level.");
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Refusing to overwrite malformed JSON at ${relative(options.targetDir, targetPath)}: ${detail}`,
      );
    }
  }

  const permissions =
    typeof parsed["permissions"] === "object" && parsed["permissions"] !== null
      ? (parsed["permissions"] as Record<string, unknown>)
      : {};
  const allow = Array.isArray(permissions["allow"]) ? [...(permissions["allow"] as unknown[])] : [];

  for (const entry of REQUIRED_BASH_ALLOW) {
    if (!allow.includes(entry)) allow.push(entry);
  }

  permissions["allow"] = allow;
  parsed["permissions"] = permissions;

  writeFileSync(targetPath, JSON.stringify(parsed, null, 2) + "\n", "utf-8");
  result.actions.push({ path: targetPath, action });
  options.onWrite?.(targetPath, action);
  return result;
}

/**
 * Create or update the project-level `CLAUDE.md` file. The Nightshift section
 * is delimited by start/end markers so the installer can replace just its own
 * section. When markers are absent on an existing file, the installer appends
 * a new section and warns the user.
 */
export function writeClaudeMdFile(options: ScaffoldOptions): ScaffoldResult {
  const result: ScaffoldResult = { actions: [] };
  const templatePath = getTemplatePath("claude", "CLAUDE.md");
  const targetPath = join(options.targetDir, "CLAUDE.md");
  const newSection = readFileSync(templatePath, "utf-8").trim();

  if (!existsSync(targetPath)) {
    writeFileSync(targetPath, newSection + "\n", "utf-8");
    result.actions.push({ path: targetPath, action: "created" });
    options.onWrite?.(targetPath, "created");
    return result;
  }

  const existing = readFileSync(targetPath, "utf-8");
  const startIdx = existing.indexOf(NIGHTSHIFT_MARKER_START);
  const endIdx = existing.indexOf(NIGHTSHIFT_MARKER_END);

  if (startIdx >= 0 && endIdx > startIdx) {
    const before = existing.slice(0, startIdx);
    const afterStart = endIdx + NIGHTSHIFT_MARKER_END.length;
    const after = existing.slice(afterStart);
    const replaced = before + newSection + after;
    writeFileSync(targetPath, replaced, "utf-8");
    result.actions.push({ path: targetPath, action: "updated" });
    options.onWrite?.(targetPath, "updated");
    return result;
  }

  const trimmed = existing.endsWith("\n") ? existing : existing + "\n";
  const appended = trimmed + "\n" + newSection + "\n";
  writeFileSync(targetPath, appended, "utf-8");
  result.actions.push({ path: targetPath, action: "updated" });
  options.onWrite?.(targetPath, "updated");
  options.onWarn?.(
    "CLAUDE.md exists but did not contain Nightshift markers; appended a new section. Remove any duplicate Nightshift content manually.",
  );
  return result;
}

/**
 * Write the .nightshift/.gitignore file.
 */
export function writeGitignoreFile(options: ScaffoldOptions): ScaffoldResult {
  const result: ScaffoldResult = { actions: [] };
  const content = "table.csv.bak\n**/logs/\n.batch-manifest.json\n";
  const targetPath = join(options.targetDir, ".nightshift", ".gitignore");
  mkdirSync(join(options.targetDir, ".nightshift"), { recursive: true });
  const action: WriteAction = existsSync(targetPath) ? "updated" : "created";

  writeFileSync(targetPath, content, "utf-8");
  result.actions.push({ path: targetPath, action });
  options.onWrite?.(targetPath, action);

  return result;
}
