import { Command } from "commander";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInitCommand } from "./commands/init.js";
import { createUpdateCommand } from "./commands/update.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getVersion(): string {
  try {
    // Resolve package.json relative to compiled output (dist/cli/) or source (src/cli/)
    const candidates = [
      resolve(__dirname, "..", "..", "package.json"),
      resolve(__dirname, "..", "package.json"),
    ];
    for (const candidate of candidates) {
      try {
        const pkg = JSON.parse(readFileSync(candidate, "utf-8"));
        return pkg.version ?? "0.0.0";
      } catch {
        continue;
      }
    }
    return "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export function createProgram(): Command {
  const program = new Command();

  program
    .name("nightshift")
    .description("CLI installer for the Nightshift AI agent orchestration framework")
    .version(getVersion());

  program.addCommand(createInitCommand());
  program.addCommand(createUpdateCommand());

  return program;
}

export async function run(): Promise<void> {
  const program = createProgram();
  await program.parseAsync(process.argv);
}
