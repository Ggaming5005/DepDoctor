import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { readPackageJson } from "../utils/fs.js";
import {
  fetchPackument,
  getLatestVersion,
  getDeprecationInfo,
  getRepoUrl,
} from "../providers/npm-registry.js";
import { getLastCommitDate } from "../providers/github.js";
import { getMigrationHints } from "../config/migration-hints.js";
import { STALE_THRESHOLD_DAYS } from "../config/defaults.js";
import type { Cache } from "./cache.js";
import type {
  MigrationSuggestion,
  MigrationChange,
  ProgressCallback,
} from "../types/index.js";

interface CheckMigrationsOptions {
  cwd: string;
  githubToken?: string;
  cache: Cache;
  onProgress?: ProgressCallback;
}

export async function checkMigrations(
  options: CheckMigrationsOptions,
): Promise<MigrationSuggestion[]> {
  const { cwd, githubToken, cache, onProgress } = options;

  const pkg = readPackageJson(cwd);
  if (!pkg) {
    throw new Error(`No package.json found in ${cwd}`);
  }

  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };

  const names = Object.keys(allDeps);
  const hints = getMigrationHints();
  const suggestions: MigrationSuggestion[] = [];

  let completed = 0;
  const total = names.length;

  for (const name of names) {
    onProgress?.(++completed, total, name);

    const packument = await fetchPackument(name, cache);
    if (!packument) continue;

    const latest = getLatestVersion(packument);
    const deprecation = getDeprecationInfo(packument);
    const repoUrl = getRepoUrl(packument);

    // Check staleness via GitHub
    let lastCommit: Date | null = null;
    let daysSinceUpdate: number | null = null;

    if (repoUrl && repoUrl.includes("github.com")) {
      lastCommit = await getLastCommitDate(repoUrl, cache, githubToken);
      if (lastCommit) {
        daysSinceUpdate = Math.floor(
          (Date.now() - lastCommit.getTime()) / (1000 * 60 * 60 * 24),
        );
      }
    }

    const isDeprecated = deprecation.deprecated;
    const isStale =
      daysSinceUpdate !== null && daysSinceUpdate > STALE_THRESHOLD_DAYS;

    if (!isDeprecated && !isStale) continue;

    const hint = hints[name];

    suggestions.push({
      name,
      latest,
      deprecated: isDeprecated,
      deprecatedMessage: deprecation.message,
      repoUrl,
      lastCommit: lastCommit?.toISOString() ?? null,
      daysSinceUpdate,
      risk: isDeprecated ? "deprecated" : isStale ? "stale" : null,
      alternatives: hint?.alternatives ?? [],
      reason: hint?.reason ?? deprecation.message ?? null,
    });
  }

  return suggestions;
}

export function applyMigrations(
  cwd: string,
  suggestions: MigrationSuggestion[],
): { modified: boolean; changes: MigrationChange[] } {
  const pkgPath = join(cwd, "package.json");
  const raw = readFileSync(pkgPath, "utf-8");
  const pkg = JSON.parse(raw) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  const changes: MigrationChange[] = [];

  for (const suggestion of suggestions) {
    if (suggestion.alternatives.length === 0) continue;

    const replacement = suggestion.alternatives[0]!;
    const oldVersion =
      pkg.dependencies?.[suggestion.name] ??
      pkg.devDependencies?.[suggestion.name];

    if (!oldVersion) continue;

    // Determine which section the package is in
    const inDeps = suggestion.name in (pkg.dependencies ?? {});
    const section = inDeps ? "dependencies" : "devDependencies";

    // Remove old package
    if (pkg[section]) {
      delete pkg[section][suggestion.name];
    }

    // Add replacement with latest version (or "latest" as fallback)
    const newVersion = suggestion.latest ? `^${suggestion.latest}` : "latest";
    if (pkg[section]) {
      pkg[section][replacement] = newVersion;
    }

    changes.push({
      package: suggestion.name,
      from: oldVersion,
      to: replacement,
      replacement,
    });
  }

  if (changes.length > 0) {
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
    return { modified: true, changes };
  }

  return { modified: false, changes: [] };
}
