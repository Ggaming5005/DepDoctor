import { homedir } from "os";
import { join } from "path";

export const CACHE_DIR = join(homedir(), ".depdoctor", "cache");

export const CACHE_TTL = {
  npm: 60 * 60 * 1000, // 1 hour
  bundlephobia: 24 * 60 * 60 * 1000, // 24 hours
  github: 60 * 60 * 1000, // 1 hour
  downloads: 60 * 60 * 1000, // 1 hour
} as const;

export const DEFAULT_CONCURRENCY = 10;

export const STALE_THRESHOLD_DAYS = 730; // 2 years
export const OUTDATED_THRESHOLD_DAYS = 365; // 1 year

export const NPM_REGISTRY_URL = "https://registry.npmjs.org";
export const NPM_DOWNLOADS_URL = "https://api.npmjs.org/downloads/point/last-week";
export const BUNDLEPHOBIA_URL = "https://bundlephobia.com/api/size";

export const HTTP_TIMEOUT_MS = 10_000;
export const HTTP_MAX_RETRIES = 1;
