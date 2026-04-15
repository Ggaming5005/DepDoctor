import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { MigrationHint } from "../types/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

let hints: Record<string, MigrationHint> | null = null;

export function getMigrationHints(): Record<string, MigrationHint> {
  if (hints) return hints;

  // Try multiple paths: development (root/data/) and built (dist/data/)
  const paths = [
    join(__dirname, "..", "..", "data", "migration-hints.json"),
    join(__dirname, "..", "data", "migration-hints.json"),
    join(__dirname, "data", "migration-hints.json"),
  ];

  for (const p of paths) {
    try {
      const raw = readFileSync(p, "utf-8");
      hints = JSON.parse(raw) as Record<string, MigrationHint>;
      return hints;
    } catch {
      // try next path
    }
  }

  // Fallback: return empty if file not found
  hints = {};
  return hints;
}
