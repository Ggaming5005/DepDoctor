// ---- Package Analysis Types ----

export interface BundleSize {
  sizeBytes: number;
  gzipBytes: number;
  dependencyCount?: number;
}

export interface VulnerabilityInfo {
  severity: "info" | "low" | "moderate" | "high" | "critical";
  title: string;
  url: string | null;
}

export interface PackageInfo {
  name: string;
  requested: string;
  installed: string | null;
  latest: string | null;
  deprecated: boolean;
  deprecatedMessage: string | null;
  lastUpdated: string | null;
  daysSinceUpdate: number;
  downloads: number | null;
  size: BundleSize | null;
  versionsInLock: string[];
  score: number;
  unused: boolean;
  vulnerabilities: VulnerabilityInfo[];
  isDev: boolean;
}

export interface AuditResult {
  count: number;
  vulnerabilities: Record<string, VulnerabilityInfo[]>;
}

export interface AnalysisMeta {
  analyzedAt: string;
  packageCount: number;
  cwd: string;
  durationMs: number;
}

export interface AnalysisResult {
  packages: PackageInfo[];
  projectScore: number;
  audit: AuditResult;
  meta: AnalysisMeta;
}

// ---- Migration Types ----

export interface MigrationHint {
  alternatives: string[];
  reason: string;
}

export interface MigrationSuggestion {
  name: string;
  latest: string | null;
  deprecated: boolean;
  deprecatedMessage: string | null;
  repoUrl: string | null;
  lastCommit: string | null;
  daysSinceUpdate: number | null;
  risk: "deprecated" | "stale" | null;
  alternatives: string[];
  reason: string | null;
}

export interface MigrationChange {
  package: string;
  from: string;
  to: string;
  replacement: string;
}

export interface MigrationResult {
  suggestions: MigrationSuggestion[];
  modified: boolean;
  changes: MigrationChange[];
}

// ---- Options Types ----

export interface AnalyzeOptions {
  json: boolean;
  depcheck: boolean;
  concurrency: number;
  noCache: boolean;
}

export interface MigrateOptions {
  fix: boolean;
  githubToken?: string;
  noCache: boolean;
}

export interface BadgeOptions {
  output?: string;
  ci?: number;
  noCache: boolean;
}

export interface ServeOptions {
  port: number;
}

// ---- Cache Types ----

export interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  ttl: number;
}

// ---- Scoring Types ----

export interface ScoreInput {
  downloads: number | null;
  daysSinceUpdate: number;
  gzipBytes: number | null;
  deprecated: boolean;
  vulnerabilities: VulnerabilityInfo[];
  requestedRange: string;
  latestVersion: string | null;
  installedVersion: string | null;
}

// ---- NPM API Types ----

export interface NpmPackument {
  name: string;
  "dist-tags": Record<string, string>;
  versions: Record<string, unknown>;
  time?: Record<string, string>;
  deprecated?: string;
  repository?: {
    type?: string;
    url?: string;
  };
}

export interface NpmDownloads {
  downloads: number;
  start: string;
  end: string;
  package: string;
}

// ---- Progress Callback ----

export type ProgressCallback = (
  current: number,
  total: number,
  packageName: string,
) => void;
