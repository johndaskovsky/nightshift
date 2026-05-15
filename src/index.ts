export { createProgram, run } from "./cli/index.js";
export {
  scaffoldDirectories,
  removeStaleAgentFiles,
  writeAgentFiles,
  writeClaudeSkillFiles,
  writeClaudeSettingsFile,
  writeClaudeMdFile,
  writeGitignoreFile,
  type ScaffoldOptions,
  type ScaffoldResult,
  type WriteAction,
} from "./core/scaffolder.js";
export { getTemplatesDir, getTemplatePath } from "./core/templates.js";
