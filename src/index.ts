// Public API — importable by the server and external consumers
export { analyzeProject } from "./core/analyzer.js";
export { checkMigrations, applyMigrations } from "./core/migrator.js";
export { computePackageScore, computeProjectScore } from "./core/scorer.js";
export { Cache } from "./core/cache.js";
export type {
  AnalysisResult,
  PackageInfo,
  MigrationSuggestion,
  MigrationResult,
  AnalyzeOptions,
  MigrateOptions,
  BadgeOptions,
  ServeOptions,
} from "./types/index.js";
