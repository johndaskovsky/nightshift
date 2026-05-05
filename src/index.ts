export { createProgram, run } from "./cli/index.js";
export {
  resolveTarget,
  targetIncludes,
  scaffoldDirectories,
  writeAgentFiles,
  writeOpenCodeCommandFiles,
  writeClaudeSkillFiles,
  writeClaudeSettingsFile,
  writeClaudeMdFile,
  writeGitignoreFile,
  type Target,
  type ScaffoldOptions,
  type ScaffoldResult,
  type WriteAction,
} from "./core/scaffolder.js";
export { getTemplatesDir, getTemplatePath } from "./core/templates.js";
