import { fetchJson } from "../utils/http.js";
import { BUNDLEPHOBIA_URL, CACHE_TTL } from "../config/defaults.js";
import type { Cache } from "../core/cache.js";
import type { BundleSize } from "../types/index.js";

interface BundlephobiaResponse {
  size: number;
  gzip: number;
  dependencyCount?: number;
}

export async function fetchBundleSize(
  name: string,
  version: string,
  cache: Cache,
): Promise<BundleSize | null> {
  const cacheKey = `bundlephobia:${name}@${version}`;
  const cached = await cache.get<BundleSize>(cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchJson<BundlephobiaResponse>(
      `${BUNDLEPHOBIA_URL}?package=${encodeURIComponent(name)}@${encodeURIComponent(version)}`,
      { timeout: 15_000 }, // bundlephobia can be slow
    );

    const result: BundleSize = {
      sizeBytes: data.size,
      gzipBytes: data.gzip,
      dependencyCount: data.dependencyCount,
    };

    await cache.set(cacheKey, result, CACHE_TTL.bundlephobia);
    return result;
  } catch {
    // Bundlephobia is unreliable — graceful failure
    return null;
  }
}
