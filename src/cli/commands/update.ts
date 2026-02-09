import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import {
  scaffoldDirectories,
  writeAgentFiles,
  writeCommandFiles,
} from "../../core/scaffolder.js";
import { mergeOpencodeConfig } from "../../core/config-merger.js";

interface UpdateOptions {
  yes?: boolean;
}

export function createUpdateCommand(): Command {
  return new Command("update")
    .description("Regenerate Nightshift framework files from the current CLI version")
    .option("-y, --yes", "Skip confirmation prompts")
    .action(async (_options: UpdateOptions) => {
      const targetDir = process.cwd();
      const actions: Array<{ path: string; action: string }> = [];
      const warnings: string[] = [];
      let hasError = false;

      console.log(chalk.bold("\nUpdating Nightshift files...\n"));

      // Ensure directories exist
      const dirSpinner = ora("Ensuring directories...").start();
      try {
        scaffoldDirectories(targetDir);
        dirSpinner.succeed("Directories verified");
      } catch (err) {
        dirSpinner.fail("Failed to verify directories");
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }

      // Overwrite agent files
      const agentSpinner = ora("Updating agent files...").start();
      try {
        const result = writeAgentFiles({
          targetDir,
          force: true,
          onWrite: (path, action) => actions.push({ path, action }),
        });
        agentSpinner.succeed(`Agent files updated (${result.actions.length} files)`);
      } catch (err) {
        agentSpinner.fail("Failed to update agent files");
        warnings.push(`Agent files: ${err instanceof Error ? err.message : String(err)}`);
        hasError = true;
      }

      // Overwrite command files
      const cmdSpinner = ora("Updating command files...").start();
      try {
        const result = writeCommandFiles({
          targetDir,
          force: true,
          onWrite: (path, action) => actions.push({ path, action }),
        });
        cmdSpinner.succeed(`Command files updated (${result.actions.length} files)`);
      } catch (err) {
        cmdSpinner.fail("Failed to update command files");
        warnings.push(`Command files: ${err instanceof Error ? err.message : String(err)}`);
        hasError = true;
      }

      // Re-merge opencode.jsonc
      const configSpinner = ora("Updating opencode.jsonc...").start();
      try {
        const result = mergeOpencodeConfig(targetDir);
        configSpinner.succeed(`opencode.jsonc ${result.action}`);
        actions.push({ path: result.path, action: result.action });
      } catch (err) {
        configSpinner.fail("Failed to update opencode.jsonc");
        warnings.push(`Config merge: ${err instanceof Error ? err.message : String(err)}`);
        hasError = true;
      }

      // Summary
      console.log(chalk.bold("\n--- Summary ---\n"));

      if (actions.length > 0) {
        for (const { path, action } of actions) {
          const relativePath = path.replace(targetDir + "/", "");
          const icon =
            action === "created" ? chalk.green("+") :
            action === "updated" ? chalk.yellow("~") :
            chalk.dim("-");
          console.log(`  ${icon} ${relativePath} (${action})`);
        }
      }

      if (warnings.length > 0) {
        console.log(chalk.yellow("\nWarnings:"));
        for (const w of warnings) {
          console.log(chalk.yellow(`  ! ${w}`));
        }
      }

      console.log(chalk.bold("\nUpdate complete.\n"));

      if (hasError) {
        process.exit(1);
      }
    });
}
