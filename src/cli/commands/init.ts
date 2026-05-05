import { Command } from "commander";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import chalk from "chalk";
import ora from "ora";
import {
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
  type WriteAction,
} from "../../core/scaffolder.js";
import { checkDependencies } from "../../core/dependencies.js";

export function createInitCommand(): Command {
  return new Command("init")
    .description("Initialize or update Nightshift in the current project")
    .option(
      "-t, --target <value>",
      "Install target: claude, opencode, or both (default: auto-detect)",
    )
    .action(async (options: { target?: string }) => {
      const targetDir = process.cwd();
      const actions: Array<{ path: string; action: WriteAction }> = [];
      const warnings: string[] = [];
      let hasError = false;

      let target: Target;
      try {
        target = resolveTarget(targetDir, options.target);
      } catch (err) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }

      const includesOpencode = targetIncludes(target, "opencode");
      const includesClaude = targetIncludes(target, "claude");

      const opencodeManagerPath = join(targetDir, ".opencode", "agents", "nightshift-manager.md");
      const claudeManagerPath = join(targetDir, ".claude", "agents", "nightshift-manager.md");
      const isOpencodeRerun = includesOpencode && existsSync(opencodeManagerPath);
      const isClaudeRerun = includesClaude && existsSync(claudeManagerPath);
      const isFirstRun =
        (includesOpencode && !isOpencodeRerun) || (includesClaude && !isClaudeRerun);

      const banner = isFirstRun
        ? "Initializing Nightshift..."
        : "Updating Nightshift files...";
      console.log(chalk.bold(`\n${banner}\n`));

      const targetLabel =
        options.target === undefined
          ? `${target} (auto-detected)`
          : target;
      console.log(`Target: ${chalk.cyan(targetLabel)}`);

      // Step 1: Scaffold directories
      const dirSpinner = ora(
        isFirstRun ? "Creating directories..." : "Ensuring directories...",
      ).start();
      try {
        scaffoldDirectories(targetDir, target);
        dirSpinner.succeed(isFirstRun ? "Directories created" : "Directories verified");
      } catch (err) {
        dirSpinner.fail(
          isFirstRun ? "Failed to create directories" : "Failed to verify directories",
        );
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }

      // Step 2: Write agent files (writes to either or both target trees)
      const agentSpinner = ora(
        isFirstRun ? "Writing agent files..." : "Updating agent files...",
      ).start();
      try {
        const result = writeAgentFiles({
          targetDir,
          target,
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

      // Step 3a: OpenCode command files
      if (includesOpencode) {
        const cmdSpinner = ora(
          isFirstRun ? "Writing OpenCode command files..." : "Updating OpenCode command files...",
        ).start();
        try {
          const result = writeOpenCodeCommandFiles({
            targetDir,
            onWrite: (path, action) => actions.push({ path, action }),
          });
          cmdSpinner.succeed(
            isFirstRun
              ? `OpenCode command files written (${result.actions.length} files)`
              : `OpenCode command files updated (${result.actions.length} files)`,
          );
        } catch (err) {
          cmdSpinner.fail(
            isFirstRun
              ? "Failed to write OpenCode command files"
              : "Failed to update OpenCode command files",
          );
          warnings.push(`OpenCode commands: ${err instanceof Error ? err.message : String(err)}`);
          hasError = true;
        }
      }

      // Step 3b: Claude skill files
      if (includesClaude) {
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

        // Step 3c: Claude settings.json
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

        // Step 3d: CLAUDE.md
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
      }

      // Step 3e: Plugin-conflict heuristic. If the user has the Nightshift
      // Claude Code Plugin enabled at the user-level, warn that this project-
      // local install will take precedence per Claude Code's plugin precedence
      // rules.
      if (includesClaude) {
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
      }

      // Step 4: .nightshift/.gitignore
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
        let step = 1;
        if (includesOpencode) {
          console.log(`  ${step++}. Open your project in OpenCode`);
        }
        if (includesClaude) {
          console.log(`  ${step++}. Open your project in Claude Code`);
          console.log(
            chalk.dim(
              `     (if Claude Code is already running, restart it so the new skill directories are discovered)`,
            ),
          );
        }
        const slashCmd = includesClaude ? "/nightshift-create" : "/nightshift-create";
        console.log(`  ${step}. Run ${chalk.cyan(slashCmd)} to create your first shift`);
        console.log("");
      } else {
        console.log(chalk.bold("\nUpdate complete.\n"));
      }

      if (hasError) {
        process.exit(1);
      }
    });
}
