import { readFileSync, existsSync } from "fs";
import { join } from "path";

interface NpmLockV2 {
  dependencies?: Record<
    string,
    { version?: string; dependencies?: Record<string, { version?: string }> }
  >;
}

interface NpmLockV3 {
  packages?: Record<string, { version?: string }>;
}

type NpmLockFile = NpmLockV2 & NpmLockV3 & { lockfileVersion?: number };

/**
 * Parse a lockfile and return a map of package name → installed versions.
 * Supports npm v2 (dependencies) and v3 (packages) lockfile formats.
 */
export function parseLockfile(cwd: string): Record<string, string[]> {
  const lockPath = join(cwd, "package-lock.json");

  if (!existsSync(lockPath)) return {};

  let lock: NpmLockFile;
  try {
    const raw = readFileSync(lockPath, "utf-8");
    lock = JSON.parse(raw) as NpmLockFile;
  } catch {
    return {};
  }

  const versions: Record<string, Set<string>> = {};

  const addVersion = (name: string, version: string) => {
    if (!versions[name]) {
      versions[name] = new Set();
    }
    versions[name].add(version);
  };

  // npm v3 format: packages field with "node_modules/..." keys
  if (lock.packages) {
    for (const [key, meta] of Object.entries(lock.packages)) {
      if (!key || !meta?.version) continue;

      // Keys look like "node_modules/chalk" or "node_modules/@types/node"
      // Nested: "node_modules/foo/node_modules/bar"
      const match = key.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)$/);
      if (match?.[1]) {
        addVersion(match[1], meta.version);
      }
    }
  }

  // npm v2 format: dependencies field (flat or nested)
  if (lock.dependencies) {
    const walkDeps = (
      deps: Record<
        string,
        { version?: string; dependencies?: Record<string, { version?: string }> }
      >,
    ) => {
      for (const [name, meta] of Object.entries(deps)) {
        if (meta?.version) {
          addVersion(name, meta.version);
        }
        if (meta?.dependencies) {
          walkDeps(meta.dependencies);
        }
      }
    };
    walkDeps(lock.dependencies);
  }

  // Convert Sets to arrays
  const result: Record<string, string[]> = {};
  for (const [name, vSet] of Object.entries(versions)) {
    result[name] = [...vSet];
  }
  return result;
}

/**
 * Get the primary installed version for a package from the lockfile.
 * Returns the first version found, or null.
 */
export function getInstalledVersion(
  lockVersions: Record<string, string[]>,
  name: string,
): string | null {
  return lockVersions[name]?.[0] ?? null;
}
