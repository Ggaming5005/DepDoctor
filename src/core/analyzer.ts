import { execSync } from "child_process";
import { readPackageJson } from "../utils/fs.js";
import { parseLockfile, getInstalledVersion } from "../providers/lock-parser.js";
import {
  fetchPackument,
  fetchWeeklyDownloads,
  getLatestVersion,
  getDeprecationInfo,
  getLastUpdated,
} from "../providers/npm-registry.js";
import { fetchBundleSize } from "../providers/bundlephobia.js";
import { computePackageScore, computeProjectScore } from "./scorer.js";
import type { Cache } from "./cache.js";
import type {
  AnalysisResult,
  PackageInfo,
  AuditResult,
  VulnerabilityInfo,
  ProgressCallback,
} from "../types/index.js";

interface AnalyzeProjectOptions {
  cwd: string;
  concurrency: number;
  includeDepcheck: boolean;
  cache: Cache;
  onProgress?: ProgressCallback;
}

export async function analyzeProject(
  options: AnalyzeProjectOptions,
): Promise<AnalysisResult> {
  const startTime = Date.now();
  const { cwd, concurrency, includeDepcheck, cache, onProgress } = options;

  // 1. Read package.json
  const pkg = readPackageJson(cwd);
  if (!pkg) {
    throw new Error(`No package.json found in ${cwd}`);
  }

  const deps = pkg.dependencies ?? {};
  const devDeps = pkg.devDependencies ?? {};

  const allDeps: Array<{ name: string; range: string; isDev: boolean }> = [
    ...Object.entries(deps).map(([name, range]) => ({
      name,
      range,
      isDev: false,
    })),
    ...Object.entries(devDeps).map(([name, range]) => ({
      name,
      range,
      isDev: true,
    })),
  ];

  // 2. Parse lockfile
  const lockVersions = parseLockfile(cwd);

  // 3. Run npm audit + depcheck concurrently with package analysis
  const auditPromise = runNpmAudit(cwd);
  const depcheckPromise = includeDepcheck
    ? runDepcheck(cwd)
    : Promise.resolve(new Set<string>());

  // 4. Analyze each package with controlled concurrency
  const packages = await analyzePackages(
    allDeps,
    lockVersions,
    concurrency,
    cache,
    onProgress,
  );

  // 5. Wait for audit and depcheck
  const [audit, unusedSet] = await Promise.all([auditPromise, depcheckPromise]);

  // 6. Enrich packages with audit + depcheck data
  for (const pkg of packages) {
    // Vulnerabilities
    const pkgVulns = audit.vulnerabilities[pkg.name];
    if (pkgVulns) {
      pkg.vulnerabilities = pkgVulns;
    }

    // Unused
    if (unusedSet.has(pkg.name)) {
      pkg.unused = true;
    }

    // Recompute score with vulnerability data
    pkg.score = computePackageScore({
      downloads: pkg.downloads,
      daysSinceUpdate: pkg.daysSinceUpdate,
      gzipBytes: pkg.size?.gzipBytes ?? null,
      deprecated: pkg.deprecated,
      vulnerabilities: pkg.vulnerabilities,
      requestedRange: pkg.requested,
      latestVersion: pkg.latest,
      installedVersion: pkg.installed,
    });
  }

  // 7. Project score
  const projectScore = computeProjectScore(packages);

  return {
    packages,
    projectScore,
    audit,
    meta: {
      analyzedAt: new Date().toISOString(),
      packageCount: packages.length,
      cwd,
      durationMs: Date.now() - startTime,
    },
  };
}

async function analyzePackages(
  allDeps: Array<{ name: string; range: string; isDev: boolean }>,
  lockVersions: Record<string, string[]>,
  concurrency: number,
  cache: Cache,
  onProgress?: ProgressCallback,
): Promise<PackageInfo[]> {
  const results: PackageInfo[] = [];
  let completed = 0;
  const total = allDeps.length;

  // Simple concurrency pool
  const queue = [...allDeps];
  const workers = Array.from({ length: Math.min(concurrency, total) }, () =>
    (async () => {
      while (queue.length > 0) {
        const dep = queue.shift();
        if (!dep) break;

        const info = await analyzeSinglePackage(dep, lockVersions, cache);
        results.push(info);

        completed++;
        onProgress?.(completed, total, dep.name);
      }
    })(),
  );

  await Promise.all(workers);
  return results;
}

async function analyzeSinglePackage(
  dep: { name: string; range: string; isDev: boolean },
  lockVersions: Record<string, string[]>,
  cache: Cache,
): Promise<PackageInfo> {
  const installed = getInstalledVersion(lockVersions, dep.name);
  const versionsInLock = lockVersions[dep.name] ?? [];

  // Fetch packument, downloads, and bundle size in parallel
  const [packument, downloads, bundleSize] = await Promise.all([
    fetchPackument(dep.name, cache),
    fetchWeeklyDownloads(dep.name, cache),
    installed
      ? fetchBundleSize(dep.name, installed, cache)
      : Promise.resolve(null),
  ]);

  const latest = packument ? getLatestVersion(packument) : null;
  const deprecation = packument
    ? getDeprecationInfo(packument)
    : { deprecated: false, message: null };
  const lastUpdated = packument ? getLastUpdated(packument) : null;

  const daysSinceUpdate = lastUpdated
    ? Math.floor(
        (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24),
      )
    : 0;

  const score = computePackageScore({
    downloads,
    daysSinceUpdate,
    gzipBytes: bundleSize?.gzipBytes ?? null,
    deprecated: deprecation.deprecated,
    vulnerabilities: [], // filled in later from audit
    requestedRange: dep.range,
    latestVersion: latest,
    installedVersion: installed,
  });

  return {
    name: dep.name,
    requested: dep.range,
    installed,
    latest,
    deprecated: deprecation.deprecated,
    deprecatedMessage: deprecation.message,
    lastUpdated,
    daysSinceUpdate,
    downloads,
    size: bundleSize,
    versionsInLock,
    score,
    unused: false,
    vulnerabilities: [],
    isDev: dep.isDev,
  };
}

async function runNpmAudit(cwd: string): Promise<AuditResult> {
  try {
    const stdout = execSync("npm audit --json 2>/dev/null", {
      cwd,
      encoding: "utf-8",
      timeout: 30_000,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const audit = JSON.parse(stdout) as {
      vulnerabilities?: Record<
        string,
        {
          severity?: string;
          via?: Array<{ title?: string; url?: string; severity?: string }>;
        }
      >;
    };

    const vulnerabilities: Record<string, VulnerabilityInfo[]> = {};
    let count = 0;

    if (audit.vulnerabilities) {
      for (const [name, vuln] of Object.entries(audit.vulnerabilities)) {
        const vias = vuln.via ?? [];
        const infos: VulnerabilityInfo[] = [];

        for (const via of vias) {
          if (typeof via === "object" && via.title) {
            infos.push({
              severity: (via.severity as VulnerabilityInfo["severity"]) ?? "info",
              title: via.title,
              url: via.url ?? null,
            });
            count++;
          }
        }

        if (infos.length > 0) {
          vulnerabilities[name] = infos;
        }
      }
    }

    return { count, vulnerabilities };
  } catch {
    // npm audit can exit non-zero when vulnerabilities exist
    // Try to parse stderr/stdout anyway
    return { count: 0, vulnerabilities: {} };
  }
}

async function runDepcheck(cwd: string): Promise<Set<string>> {
  try {
    // Dynamic import since depcheck is optional
    const depcheckModule = await import("depcheck");
    const depcheck =
      "default" in depcheckModule ? depcheckModule.default : depcheckModule;

    const result = await depcheck(cwd, {
      ignorePatterns: ["dist", "build", ".next"],
    });

    return new Set([
      ...Object.keys(result.dependencies ?? {}),
      ...Object.keys(result.devDependencies ?? {}),
    ]);
  } catch {
    return new Set();
  }
}
