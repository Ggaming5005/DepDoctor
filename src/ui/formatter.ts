import chalk from "chalk";
import Table from "cli-table3";
import type { AnalysisResult, PackageInfo, MigrationSuggestion } from "../types/index.js";

// ---- Helpers ----

function scoreColor(score: number): (text: string) => string {
  if (score >= 75) return chalk.green;
  if (score >= 50) return chalk.yellow;
  return chalk.red;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ---- Analysis Output ----

export function formatAnalysisTable(result: AnalysisResult): string {
  const lines: string[] = [];

  // Header
  lines.push("");
  lines.push(chalk.bold("  Dependency Health Report"));
  lines.push(chalk.dim(`  ${result.meta.packageCount} packages analyzed in ${(result.meta.durationMs / 1000).toFixed(1)}s`));
  lines.push("");

  // Table
  const table = new Table({
    head: [
      chalk.bold("Package"),
      chalk.bold("Installed"),
      chalk.bold("Latest"),
      chalk.bold("Score"),
      chalk.bold("Vuln"),
      chalk.bold("Downloads"),
      chalk.bold("Size (gzip)"),
    ],
    style: {
      head: [],
      border: ["dim"],
    },
    colWidths: [28, 12, 12, 8, 6, 12, 13],
  });

  // Sort: worst scores first
  const sorted = [...result.packages].sort((a, b) => a.score - b.score);

  for (const pkg of sorted) {
    const nameStr = pkg.deprecated
      ? `${pkg.name} ${chalk.red("[DEP]")}`
      : pkg.unused
        ? `${pkg.name} ${chalk.gray("[UNUSED]")}`
        : pkg.name;

    const devTag = pkg.isDev ? chalk.dim(" dev") : "";

    table.push([
      nameStr + devTag,
      pkg.installed ?? chalk.dim("?"),
      pkg.latest ?? chalk.dim("?"),
      scoreColor(pkg.score)(String(pkg.score)),
      pkg.vulnerabilities.length > 0
        ? chalk.red(String(pkg.vulnerabilities.length))
        : chalk.green("0"),
      pkg.downloads !== null ? formatDownloads(pkg.downloads) : chalk.dim("?"),
      pkg.size ? formatBytes(pkg.size.gzipBytes) : chalk.dim("?"),
    ]);
  }

  lines.push(table.toString());

  // Summary
  lines.push("");
  lines.push(formatSummary(result));

  return lines.join("\n");
}

function formatSummary(result: AnalysisResult): string {
  const lines: string[] = [];
  const { packages, projectScore } = result;

  const color = scoreColor(projectScore);
  lines.push(chalk.bold(`  Project Score: ${color(String(projectScore))}/100`));
  lines.push("");

  const prodCount = packages.filter((p) => !p.isDev).length;
  const devCount = packages.filter((p) => p.isDev).length;
  lines.push(chalk.dim(`  ${packages.length} packages (${prodCount} prod, ${devCount} dev)`));

  // Issues
  const deprecated = packages.filter((p) => p.deprecated);
  const outdated = packages.filter(
    (p) => p.latest && p.installed && p.latest !== p.installed,
  );
  const unused = packages.filter((p) => p.unused);
  const vulnerable = packages.filter((p) => p.vulnerabilities.length > 0);

  if (deprecated.length > 0) {
    lines.push(
      chalk.red(`  ${deprecated.length} deprecated: ${deprecated.map((p) => p.name).join(", ")}`),
    );
  }
  if (vulnerable.length > 0) {
    lines.push(
      chalk.red(`  ${result.audit.count} vulnerabilities in ${vulnerable.length} packages`),
    );
  }
  if (outdated.length > 0) {
    lines.push(
      chalk.yellow(`  ${outdated.length} packages behind latest version`),
    );
  }
  if (unused.length > 0) {
    lines.push(
      chalk.gray(`  ${unused.length} potentially unused: ${unused.map((p) => p.name).join(", ")}`),
    );
  }

  if (deprecated.length === 0 && vulnerable.length === 0 && outdated.length === 0) {
    lines.push(chalk.green("  No issues found!"));
  }

  // Recommendations
  const recommendations = getRecommendations(packages);
  if (recommendations.length > 0) {
    lines.push("");
    lines.push(chalk.bold("  Recommendations:"));
    for (const rec of recommendations) {
      lines.push(`  ${chalk.dim("→")} ${rec}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

function getRecommendations(packages: PackageInfo[]): string[] {
  const recs: string[] = [];

  const deprecated = packages.filter((p) => p.deprecated);
  if (deprecated.length > 0) {
    recs.push(
      `Replace deprecated packages (run ${chalk.cyan("depdoctor migrate")} for suggestions)`,
    );
  }

  const lowScore = packages.filter((p) => p.score < 50 && !p.deprecated);
  for (const pkg of lowScore.slice(0, 3)) {
    recs.push(`Review ${chalk.yellow(pkg.name)} (score: ${pkg.score})`);
  }

  const multiVersion = packages.filter((p) => p.versionsInLock.length > 1);
  if (multiVersion.length > 0) {
    recs.push(
      `${multiVersion.length} packages have multiple versions in lockfile — consider deduplication`,
    );
  }

  return recs;
}

// ---- Migration Output ----

export function formatMigrationResults(
  suggestions: MigrationSuggestion[],
): string {
  if (suggestions.length === 0) {
    return chalk.green("\n  No deprecated or stale packages found!\n");
  }

  const lines: string[] = [];
  lines.push("");
  lines.push(chalk.bold(`  Migration Suggestions (${suggestions.length} packages)`));
  lines.push("");

  for (const s of suggestions) {
    const riskTag =
      s.risk === "deprecated"
        ? chalk.red(" [DEPRECATED]")
        : chalk.yellow(" [STALE]");

    lines.push(`  ${chalk.bold(s.name)}${riskTag}`);

    if (s.reason) {
      lines.push(`    ${chalk.dim(s.reason)}`);
    }

    if (s.daysSinceUpdate !== null) {
      lines.push(
        `    Last activity: ${chalk.dim(`${s.daysSinceUpdate} days ago`)}`,
      );
    }

    if (s.alternatives.length > 0) {
      lines.push(
        `    Alternatives: ${chalk.cyan(s.alternatives.join(", "))}`,
      );
    } else {
      lines.push(`    ${chalk.dim("No known alternatives (may be replaceable with built-in APIs)")}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

// ---- Badge Output ----

export function formatBadgeUrl(score: number): string {
  let color: string;
  if (score >= 80) color = "brightgreen";
  else if (score >= 60) color = "yellow";
  else if (score >= 40) color = "orange";
  else color = "red";

  return `https://img.shields.io/badge/depdoctor-${score}%2F100-${color}`;
}
