#!/usr/bin/env node

/**
 * Build script for @johndaskovsky/nightshift
 * Compiles TypeScript source to JavaScript.
 */

import { execSync } from "node:child_process";
import { rmSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, "dist");

// Clean dist directory
if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true });
  console.log("Cleaned dist/");
}

// Compile TypeScript
console.log("Compiling TypeScript...");
try {
  execSync("npx tsc", { stdio: "inherit", cwd: __dirname });
  console.log("Build complete.");
} catch {
  console.error("Build failed.");
  process.exit(1);
}
