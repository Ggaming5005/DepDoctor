import semver from "semver";

/**
 * Get the penalty for version currency.
 * Compares the installed (or requested) version against the latest.
 * Returns a negative number (penalty) or 0.
 */
export function getVersionPenalty(
  installedOrRequested: string | null,
  latest: string | null,
): number {
  if (!latest || !installedOrRequested) return 0;

  // Coerce the installed/requested version to a clean semver
  const installed = semver.coerce(installedOrRequested);
  const latestParsed = semver.parse(latest);

  if (!installed || !latestParsed) return 0;

  // If installed satisfies the latest, no penalty
  if (semver.gte(installed, latestParsed)) return 0;

  const diff = semver.diff(installed, latestParsed);

  switch (diff) {
    case "major":
    case "premajor":
      return -25;
    case "minor":
    case "preminor":
      return -10;
    case "patch":
    case "prepatch":
    case "prerelease":
      return -5;
    default:
      return 0;
  }
}

/**
 * Extract a clean version string from a range like "^5.6.2" → "5.6.2"
 */
export function coerceVersion(range: string): string | null {
  const v = semver.coerce(range);
  return v ? v.version : null;
}
