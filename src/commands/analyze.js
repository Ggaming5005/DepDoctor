import fs from "fs";
import path from "path";
import ora from "ora";
import chalk from "chalk";
import { fetchPackument, fetchWeeklyDownloads } from "../lib/npmApi.js";
import { fetchBundleSize } from "../lib/bundlephobia.js";
import { parseLockfileVersions } from "../lib/lockParser.js";
import { computePackageScore } from "../lib/scoring.js";
import depcheck from "depcheck";
import { execSync } from "child_process";

async function runNpmAudit(cwd) {
  try {
    const out = execSync("npm audit --json", {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
    }).toString();
    const json = JSON.parse(out);
    const vulnCount = json.metadata
      ? Object.values(json.vulnerabilities || {}).reduce((a, b) => a + b, 0)
      : 0;
    return { raw: json, count: vulnCount };
  } catch (e) {
    return { raw: null, count: 0 };
  }
}

export default async function analyze(opts = {}) {
  const spinner = ora("Analyzing dependencies...").start();
  try {
    const cwd = process.cwd();
    const pkgPath = path.join(cwd, "package.json");
    if (!fs.existsSync(pkgPath)) {
      spinner.fail("No package.json found.");
      process.exit(1);
    }
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const lockVersions = parseLockfileVersions(cwd);
    const results = [];
    for (const [name, range] of Object.entries(deps)) {
      spinner.text = `Fetching ${name}...`;
      let pack = null,
        downloads = null,
        bundle = null;
      try {
        pack = await fetchPackument(name);
      } catch (e) {
        pack = null;
      }
      try {
        downloads = await fetchWeeklyDownloads(name);
      } catch (e) {}
      try {
        const latest = pack?.["dist-tags"]?.latest ?? "";
        bundle = await fetchBundleSize(name, latest);
      } catch (e) {
        bundle = null;
      }
      const versionsInLock = lockVersions[name] ?? [];
      const deprecatedMessage = pack?.deprecated ?? null;
      const timeObj = pack?.time ?? {};
      const latestTime = timeObj?.[pack?.["dist-tags"]?.latest] ?? null;
      const lastUpdated = latestTime ? new Date(latestTime) : null;
      const daysSinceUpdate = lastUpdated
        ? Math.floor(
            (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24)
          )
        : 9999;
      const gzipBytes = bundle?.gzipBytes ?? null;
      const score = computePackageScore({
        downloads: downloads ?? 0,
        daysSinceUpdate,
        gzipBytes,
        deprecated: !!deprecatedMessage,
        vulnerabilityCount: 0,
        requested: range,
        latest: pack?.["dist-tags"]?.latest ?? null,
      });
      results.push({
        name,
        requested: range,
        latest: pack?.["dist-tags"]?.latest ?? null,
        deprecated: !!deprecatedMessage,
        deprecatedMessage,
        lastUpdated: lastUpdated ? lastUpdated.toISOString() : null,
        daysSinceUpdate,
        downloads,
        size: bundle
          ? { sizeBytes: bundle.sizeBytes, gzipBytes: bundle.gzipBytes }
          : null,
        versionsInLock,
        score,
      });
    }
    let unused = [];
    if (opts.depcheck) {
      spinner.text = "Running depcheck...";
      try {
        const dc = await depcheck(process.cwd(), { skipMissing: true });
        unused = (dc.dependencies || []).concat(dc.devDependencies || []);
      } catch (e) {
        unused = [];
      }
    }
    spinner.text = "Running npm audit (best-effort)...";
    const audit = await runNpmAudit(cwd);
    spinner.succeed("Analysis complete.");
    for (const r of results) r.unused = unused.includes(r.name);
    if (audit.raw && audit.raw.advisories) {
      for (const r of results) {
        r.vulnerabilities = Object.values(audit.raw.advisories || {}).filter(
          (a) => a.module_name === r.name
        );
        r.vulnerabilityCount = r.vulnerabilities.length;
      }
    } else {
      for (const r of results) r.vulnerabilityCount = 0;
    }
    const projectScore = (
      await import("../lib/scoring.js")
    ).computeProjectScore(results);
    if (opts.json) {
      console.log(
        JSON.stringify(
          { packages: results, projectScore, audit: { count: audit.count } },
          null,
          2
        )
      );
    } else {
      console.log(chalk.bold("\nDependency Health Report\n"));
      for (const r of results) {
        console.log(
          `${chalk.green(r.name)} ${
            r.deprecated ? chalk.red("[deprecated]") : ""
          }`
        );
        console.log(
          `  Requested: ${r.requested}  Latest: ${r.latest}  Score: ${r.score}`
        );
        if (r.size)
          console.log(
            `  Size: ${Math.round((r.size.gzipBytes || 0) / 1024)} KB (gzip)`
          );
        if (r.versionsInLock && r.versionsInLock.length > 1)
          console.log(
            chalk.yellow(
              `  Multiple versions in lockfile: ${r.versionsInLock.join(", ")}`
            )
          );
        if (r.unused) console.log(chalk.gray("  UNUSED (depcheck)"));
        if (r.deprecated && r.deprecatedMessage)
          console.log(chalk.red(`  Deprecation: ${r.deprecatedMessage}`));
        if (r.vulnerabilityCount)
          console.log(chalk.red(`  Vulnerabilities: ${r.vulnerabilityCount}`));
        console.log("");
      }
      console.log(chalk.bold(`Project score: ${projectScore}/100\n`));
    }
  } catch (err) {
    spinner.fail("Analysis failed.");
    console.error(err);
    process.exit(1);
  }
}
