import { Command } from "commander";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import chalk from "chalk";
import ora from "ora";
import {
  scaffoldDirectories,
  writeAgentFiles,
  writeClaudeSkillFiles,
  writeClaudeSettingsFile,
  writeClaudeMdFile,
  writeGitignoreFile,
  type WriteAction,
} from "../../core/scaffolder.js";
import { checkDependencies } from "../../core/dependencies.js";

export function createInitCommand(): Command {
  return new Command("init")
    .description("Initialize or update Nightshift in the current project")
    .action(async () => {
      const targetDir = process.cwd();
      const actions: Array<{ path: string; action: WriteAction }> = [];
      const warnings: string[] = [];
      let hasError = false;

      const claudeManagerPath = join(targetDir, ".claude", "agents", "nightshift-manager.md");
      const isFirstRun = !existsSync(claudeManagerPath);

      const banner = isFirstRun
        ? "Initializing Nightshift..."
        : "Updating Nightshift files...";
      console.log(chalk.bold(`\n${banner}\n`));

      // Step 1: Scaffold directories
      const dirSpinner = ora(
        isFirstRun ? "Creating directories..." : "Ensuring directories...",
      ).start();
      try {
        scaffoldDirectories(targetDir);
        dirSpinner.succeed(isFirstRun ? "Directories created" : "Directories verified");
      } catch (err) {
        dirSpinner.fail(
          isFirstRun ? "Failed to create directories" : "Failed to verify directories",
        );
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }

      // Step 2: Write agent files
      const agentSpinner = ora(
        isFirstRun ? "Writing agent files..." : "Updating agent files...",
      ).start();
      try {
        const result = writeAgentFiles({
          targetDir,
          onWrite: (path, action) => actions.push({ path, action }),
        });
        agentSpinner.succeed(
          isFirstRun
            ? `Agent files written (${result.actions.length} files)`
            : `Agent files updated (${result.actions.length} files)`,
        );
      } catch (err) {
        agentSpinner.fail(
          isFirstRun ? "Failed to write agent files" : "Failed to update agent files",
        );
        warnings.push(`Agent files: ${err instanceof Error ? err.message : String(err)}`);
        hasError = true;
      }

      // Step 3: Claude skill files
      const skillSpinner = ora(
        isFirstRun ? "Writing Claude skill files..." : "Updating Claude skill files...",
      ).start();
      try {
        const result = writeClaudeSkillFiles({
          targetDir,
          onWrite: (path, action) => actions.push({ path, action }),
        });
        skillSpinner.succeed(
          isFirstRun
            ? `Claude skill files written (${result.actions.length} files)`
            : `Claude skill files updated (${result.actions.length} files)`,
        );
      } catch (err) {
        skillSpinner.fail(
          isFirstRun
            ? "Failed to write Claude skill files"
            : "Failed to update Claude skill files",
        );
        warnings.push(`Claude skills: ${err instanceof Error ? err.message : String(err)}`);
        hasError = true;
      }

      // Step 4: Claude settings.json
      const settingsSpinner = ora(
        isFirstRun ? "Writing .claude/settings.json..." : "Merging .claude/settings.json...",
      ).start();
      try {
        writeClaudeSettingsFile({
          targetDir,
          onWrite: (path, action) => actions.push({ path, action }),
        });
        settingsSpinner.succeed(
          isFirstRun ? ".claude/settings.json written" : ".claude/settings.json merged",
        );
      } catch (err) {
        settingsSpinner.fail("Failed to write .claude/settings.json");
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }

      // Step 5: CLAUDE.md
      const claudeMdSpinner = ora(
        isFirstRun ? "Writing CLAUDE.md..." : "Updating CLAUDE.md...",
      ).start();
      try {
        writeClaudeMdFile({
          targetDir,
          onWrite: (path, action) => actions.push({ path, action }),
          onWarn: (msg) => warnings.push(msg),
        });
        claudeMdSpinner.succeed(isFirstRun ? "CLAUDE.md written" : "CLAUDE.md updated");
      } catch (err) {
        claudeMdSpinner.fail("Failed to write CLAUDE.md");
        warnings.push(`CLAUDE.md: ${err instanceof Error ? err.message : String(err)}`);
        hasError = true;
      }

      // Step 6: Plugin-conflict heuristic. If the user has the Nightshift
      // Claude Code Plugin enabled at the user-level, warn that this project-
      // local install will take precedence per Claude Code's plugin precedence
      // rules.
      const userSettingsPath = join(homedir(), ".claude", "settings.json");
      if (existsSync(userSettingsPath)) {
        try {
          const raw = readFileSync(userSettingsPath, "utf-8");
          if (/nightshift/i.test(raw) && /plugin/i.test(raw)) {
            warnings.push(
              "Detected a Nightshift reference in ~/.claude/settings.json. If you have the Nightshift Claude Code Plugin enabled, the project-scoped skills written here will override the plugin's. Choose one install pathway to avoid duplication.",
            );
          }
        } catch {
          // best-effort; ignore parse errors on user settings
        }
      }

      // Step 7: .nightshift/.gitignore
      const gitignoreSpinner = ora(
        isFirstRun ? "Writing .gitignore..." : "Updating .gitignore...",
      ).start();
      try {
        const result = writeGitignoreFile({
          targetDir,
          onWrite: (path, action) => actions.push({ path, action }),
        });
        gitignoreSpinner.succeed(
          isFirstRun
            ? `.gitignore written (${result.actions.length} file)`
            : `.gitignore updated (${result.actions.length} file)`,
        );
      } catch (err) {
        gitignoreSpinner.fail(
          isFirstRun ? "Failed to write .gitignore" : "Failed to update .gitignore",
        );
        warnings.push(`.gitignore: ${err instanceof Error ? err.message : String(err)}`);
        hasError = true;
      }

      // Summary
      console.log(chalk.bold("\n--- Summary ---\n"));

      if (actions.length > 0) {
        for (const { path, action } of actions) {
          const relativePath = path.replace(targetDir + "/", "");
          const icon =
            action === "created"
              ? chalk.green("+")
              : action === "updated"
                ? chalk.yellow("~")
                : chalk.dim("-");
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
        console.log(`  ${chalk.green("✓")} qsv`);
      } else {
        console.log(`  ${chalk.yellow("!")} qsv is not installed.`);
        console.log(`    Install: ${chalk.cyan("brew install qsv")} (https://github.com/dathere/qsv)`);
      }

      if (deps.flock.available) {
        console.log(`  ${chalk.green("✓")} flock`);
      } else {
        console.log(`  ${chalk.yellow("!")} flock is not installed.`);
        console.log(`    Install: ${chalk.cyan("brew install flock")} (https://github.com/discoteq/flock)`);
      }

      if (isFirstRun) {
        console.log(chalk.bold("\n--- Next Steps ---\n"));
        console.log(`  1. Open your project in Claude Code`);
        console.log(
          chalk.dim(
            `     (if Claude Code is already running, restart it so the new skill directories are discovered)`,
          ),
        );
        console.log(`  2. Run ${chalk.cyan("/nightshift-create")} to create your first shift`);
        console.log("");
      } else {
        console.log(chalk.bold("\nUpdate complete.\n"));
      }

      if (hasError) {
        process.exit(1);
      }
    });
}
