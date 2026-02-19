import { Command } from "commander";
import { existsSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import ora from "ora";
import {
  scaffoldDirectories,
  writeAgentFiles,
  writeCommandFiles,
  writeGitignoreFile,
} from "../../core/scaffolder.js";
import { checkDependencies } from "../../core/dependencies.js";

export function createInitCommand(): Command {
  return new Command("init")
    .description("Initialize or update Nightshift in the current project")
    .action(async () => {
      const targetDir = process.cwd();
      const actions: Array<{ path: string; action: string }> = [];
      const warnings: string[] = [];
      let hasError = false;

      // Detect first run vs re-run
      const isRerun = existsSync(join(targetDir, ".opencode", "agent", "nightshift-manager.md"));

      if (isRerun) {
        console.log(chalk.bold("\nUpdating Nightshift files...\n"));
      } else {
        console.log(chalk.bold("\nInitializing Nightshift...\n"));
      }

      // Step 1: Scaffold directories
      const dirSpinner = ora(isRerun ? "Ensuring directories..." : "Creating directories...").start();
      try {
        scaffoldDirectories(targetDir);
        dirSpinner.succeed(isRerun ? "Directories verified" : "Directories created");
      } catch (err) {
        dirSpinner.fail(isRerun ? "Failed to verify directories" : "Failed to create directories");
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }

      // Step 2: Write agent files
      const agentSpinner = ora(isRerun ? "Updating agent files..." : "Writing agent files...").start();
      try {
        const result = writeAgentFiles({
          targetDir,
          onWrite: (path, action) => actions.push({ path, action }),
        });
        agentSpinner.succeed(
          isRerun
            ? `Agent files updated (${result.actions.length} files)`
            : `Agent files written (${result.actions.length} files)`,
        );
      } catch (err) {
        agentSpinner.fail(isRerun ? "Failed to update agent files" : "Failed to write agent files");
        warnings.push(`Agent files: ${err instanceof Error ? err.message : String(err)}`);
        hasError = true;
      }

      // Step 3: Write command files
      const cmdSpinner = ora(isRerun ? "Updating command files..." : "Writing command files...").start();
      try {
        const result = writeCommandFiles({
          targetDir,
          onWrite: (path, action) => actions.push({ path, action }),
        });
        cmdSpinner.succeed(
          isRerun
            ? `Command files updated (${result.actions.length} files)`
            : `Command files written (${result.actions.length} files)`,
        );
      } catch (err) {
        cmdSpinner.fail(isRerun ? "Failed to update command files" : "Failed to write command files");
        warnings.push(`Command files: ${err instanceof Error ? err.message : String(err)}`);
        hasError = true;
      }

      // Step 4: Write .gitignore file
      const gitignoreSpinner = ora(isRerun ? "Updating .gitignore..." : "Writing .gitignore...").start();
      try {
        const result = writeGitignoreFile({
          targetDir,
          onWrite: (path, action) => actions.push({ path, action }),
        });
        gitignoreSpinner.succeed(
          isRerun
            ? `.gitignore updated (${result.actions.length} file)`
            : `.gitignore written (${result.actions.length} file)`,
        );
      } catch (err) {
        gitignoreSpinner.fail(isRerun ? "Failed to update .gitignore" : "Failed to write .gitignore");
        warnings.push(`.gitignore: ${err instanceof Error ? err.message : String(err)}`);
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

      console.log(chalk.bold("\n--- Dependencies ---\n"));

      const deps = checkDependencies();

      if (deps.qsv.available) {
        console.log(`  ${chalk.green("\u2713")} qsv`);
      } else {
        console.log(`  ${chalk.yellow("!")} qsv is not installed.`);
        console.log(`    Install: ${chalk.cyan("brew install qsv")} (https://github.com/dathere/qsv)`);
      }

      if (deps.flock.available) {
        console.log(`  ${chalk.green("\u2713")} flock`);
      } else {
        console.log(`  ${chalk.yellow("!")} flock is not installed.`);
        console.log(`    Install: ${chalk.cyan("brew install flock")} (https://github.com/discoteq/flock)`);
      }

      if (isRerun) {
        console.log(chalk.bold("\nUpdate complete.\n"));
      } else {
        console.log(chalk.bold("\n--- Next Steps ---\n"));
        console.log("  1. Open your project in OpenCode");
        console.log("  2. Run " + chalk.cyan("/nightshift-create") + " to create your first shift");
        console.log("");
      }

      if (hasError) {
        process.exit(1);
      }
    });
}
