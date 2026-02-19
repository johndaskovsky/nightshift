import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import {
  scaffoldDirectories,
  writeAgentFiles,
  writeCommandFiles,
  writeGitignoreFile,
} from "../../core/scaffolder.js";
import { checkDependencies } from "../../core/dependencies.js";

interface InitOptions {
  force?: boolean;
  yes?: boolean;
}

export function createInitCommand(): Command {
  return new Command("init")
    .description("Initialize Nightshift in the current project")
    .option("-f, --force", "Overwrite all files without prompting")
    .option("-y, --yes", "Skip confirmation prompts")
    .action(async (options: InitOptions) => {
      const targetDir = process.cwd();
      const force = options.force ?? false;
      const actions: Array<{ path: string; action: string }> = [];
      const warnings: string[] = [];
      let hasError = false;

      console.log(chalk.bold("\nInitializing Nightshift...\n"));

      // Step 1: Scaffold directories
      const dirSpinner = ora("Creating directories...").start();
      try {
        scaffoldDirectories(targetDir);
        dirSpinner.succeed("Directories created");
      } catch (err) {
        dirSpinner.fail("Failed to create directories");
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }

      // Step 2: Write agent files
      const agentSpinner = ora("Writing agent files...").start();
      try {
        const result = writeAgentFiles({
          targetDir,
          force,
          onWrite: (path, action) => actions.push({ path, action }),
        });
        agentSpinner.succeed(`Agent files written (${result.actions.length} files)`);
      } catch (err) {
        agentSpinner.fail("Failed to write agent files");
        warnings.push(`Agent files: ${err instanceof Error ? err.message : String(err)}`);
        hasError = true;
      }

      // Step 3: Write command files
      const cmdSpinner = ora("Writing command files...").start();
      try {
        const result = writeCommandFiles({
          targetDir,
          force,
          onWrite: (path, action) => actions.push({ path, action }),
        });
        cmdSpinner.succeed(`Command files written (${result.actions.length} files)`);
      } catch (err) {
        cmdSpinner.fail("Failed to write command files");
        warnings.push(`Command files: ${err instanceof Error ? err.message : String(err)}`);
        hasError = true;
      }

      // Step 4: Write .gitignore file
      const gitignoreSpinner = ora("Writing .gitignore...").start();
      try {
        const result = writeGitignoreFile({
          targetDir,
          force,
          onWrite: (path, action) => actions.push({ path, action }),
        });
        gitignoreSpinner.succeed(`.gitignore written (${result.actions.length} file)`);
      } catch (err) {
        gitignoreSpinner.fail("Failed to write .gitignore");
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

      console.log(chalk.bold("\n--- Next Steps ---\n"));
      console.log("  1. Open your project in OpenCode");
      console.log("  2. Run " + chalk.cyan("/nightshift-create") + " to create your first shift");
      console.log("");

      if (hasError) {
        process.exit(1);
      }
    });
}
