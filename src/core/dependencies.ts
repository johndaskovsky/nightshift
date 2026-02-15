import { execSync } from "node:child_process";

export interface DependencyStatus {
  available: boolean;
  version?: string;
}

export interface DependencyResult {
  qsv: DependencyStatus;
  flock: DependencyStatus;
}

const TIMEOUT_MS = 5000;

function checkCommand(command: string): DependencyStatus {
  try {
    const output = execSync(`${command} --version`, {
      timeout: TIMEOUT_MS,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf-8",
    });
    const version = output.trim().split("\n")[0];
    return { available: true, version };
  } catch {
    return { available: false };
  }
}

/**
 * Check whether qsv and flock are available on PATH.
 * Returns a structured result with availability and version for each.
 */
export function checkDependencies(): DependencyResult {
  return {
    qsv: checkCommand("qsv"),
    flock: checkCommand("flock"),
  };
}
