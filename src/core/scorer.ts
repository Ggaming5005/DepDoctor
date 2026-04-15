import { getVersionPenalty } from "../utils/semver.js";
import type { ScoreInput, PackageInfo, VulnerabilityInfo } from "../types/index.js";

/**
 * Compute a health score (0–100) for a single package.
 */
export function computePackageScore(input: ScoreInput): number {
  // Deprecated packages get a hard floor of 5
  if (input.deprecated) return 5;

  let score = 100;

  // Version currency (uses semver properly)
  const versionSource = input.installedVersion ?? input.requestedRange;
  score += getVersionPenalty(versionSource, input.latestVersion);

  // Download popularity
  if (input.downloads !== null) {
    if (input.downloads < 100) {
      score -= 15;
    } else if (input.downloads < 1_000) {
      score -= 10;
    } else if (input.downloads > 1_000_000) {
      score += 5;
    }
  }

  // Freshness (days since last update)
  if (input.daysSinceUpdate > 730) {
    score -= 20; // >2 years
  } else if (input.daysSinceUpdate > 365) {
    score -= 10; // >1 year
  }

  // Bundle size (gzip)
  if (input.gzipBytes !== null) {
    if (input.gzipBytes > 500_000) {
      score -= 10; // >500KB
    } else if (input.gzipBytes > 100_000) {
      score -= 5; // >100KB
    }
  }

  // Vulnerabilities (weighted by severity)
  score += getVulnerabilityPenalty(input.vulnerabilities);

  return Math.max(0, Math.min(100, score));
}

function getVulnerabilityPenalty(vulns: VulnerabilityInfo[]): number {
  let penalty = 0;
  for (const vuln of vulns) {
    switch (vuln.severity) {
      case "critical":
        penalty -= 30;
        break;
      case "high":
        penalty -= 25;
        break;
      case "moderate":
        penalty -= 15;
        break;
      case "low":
        penalty -= 5;
        break;
      case "info":
        penalty -= 2;
        break;
    }
  }
  return penalty;
}

/**
 * Compute the project-wide health score as a weighted average.
 * Weight = log10(downloads + 1) + 1 — higher-downloaded packages count more.
 */
export function computeProjectScore(packages: PackageInfo[]): number {
  if (packages.length === 0) return 100;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const pkg of packages) {
    const weight = Math.log10((pkg.downloads ?? 0) + 1) + 1;
    weightedSum += pkg.score * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0;
  return Math.round(weightedSum / totalWeight);
}
