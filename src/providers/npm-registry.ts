import { fetchJson, HttpError } from "../utils/http.js";
import { NPM_REGISTRY_URL, NPM_DOWNLOADS_URL, CACHE_TTL } from "../config/defaults.js";
import type { Cache } from "../core/cache.js";
import type { NpmPackument, NpmDownloads } from "../types/index.js";

export async function fetchPackument(
  name: string,
  cache: Cache,
): Promise<NpmPackument | null> {
  const cacheKey = `npm:packument:${name}`;
  const cached = await cache.get<NpmPackument>(cacheKey);
  if (cached) return cached;

  try {
    const encoded = encodeURIComponent(name);
    const data = await fetchJson<NpmPackument>(
      `${NPM_REGISTRY_URL}/${encoded}`,
      { headers: { Accept: "application/json" } },
    );

    await cache.set(cacheKey, data, CACHE_TTL.npm);
    return data;
  } catch (error) {
    if (error instanceof HttpError && error.statusCode === 404) {
      return null;
    }
    return null;
  }
}

export async function fetchWeeklyDownloads(
  name: string,
  cache: Cache,
): Promise<number | null> {
  const cacheKey = `npm:downloads:${name}`;
  const cached = await cache.get<number>(cacheKey);
  if (cached !== null) return cached;

  try {
    const encoded = encodeURIComponent(name);
    const data = await fetchJson<NpmDownloads>(
      `${NPM_DOWNLOADS_URL}/${encoded}`,
    );

    const downloads = data.downloads;
    await cache.set(cacheKey, downloads, CACHE_TTL.downloads);
    return downloads;
  } catch {
    return null;
  }
}

/**
 * Extract the latest version from a packument's dist-tags.
 */
export function getLatestVersion(packument: NpmPackument): string | null {
  return packument["dist-tags"]?.["latest"] ?? null;
}

/**
 * Check if a package is deprecated by examining the latest version's metadata.
 */
export function getDeprecationInfo(packument: NpmPackument): {
  deprecated: boolean;
  message: string | null;
} {
  const latest = getLatestVersion(packument);
  if (!latest) return { deprecated: false, message: null };

  const versionMeta = packument.versions?.[latest] as
    | { deprecated?: string }
    | undefined;

  if (versionMeta?.deprecated) {
    return { deprecated: true, message: versionMeta.deprecated };
  }

  return { deprecated: false, message: null };
}

/**
 * Get the last publish date for a package.
 */
export function getLastUpdated(packument: NpmPackument): string | null {
  if (!packument.time) return null;

  const latest = getLatestVersion(packument);
  if (latest && packument.time[latest]) {
    return packument.time[latest] ?? null;
  }

  // Fallback to "modified"
  return packument.time["modified"] ?? null;
}

/**
 * Extract repository URL from packument.
 */
export function getRepoUrl(packument: NpmPackument): string | null {
  const repo = packument.repository;
  if (!repo) return null;

  const url = typeof repo === "string" ? repo : repo.url;
  if (!url) return null;

  // Normalize git+https:// or git:// URLs to https://
  return url
    .replace(/^git\+/, "")
    .replace(/^git:\/\//, "https://")
    .replace(/\.git$/, "");
}
