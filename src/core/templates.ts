import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Resolve the templates directory relative to the installed package location.
 * Works whether running from source (src/) or compiled (dist/).
 */
export function getTemplatesDir(): string {
  // When compiled: dist/core/templates.js -> ../../templates
  // When running from source: src/core/templates.ts -> ../../templates
  const candidates = [
    resolve(__dirname, "..", "..", "templates"),
    resolve(__dirname, "..", "templates"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Templates directory not found. Searched:\n${candidates.map((c) => `  - ${c}`).join("\n")}`
  );
}

/**
 * Get the path to a specific template file.
 */
export function getTemplatePath(...segments: string[]): string {
  return resolve(getTemplatesDir(), ...segments);
}
