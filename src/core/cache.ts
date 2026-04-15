import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import { CACHE_DIR } from "../config/defaults.js";
import type { CacheEntry } from "../types/index.js";

export class Cache {
  private memory = new Map<string, CacheEntry<unknown>>();
  private cacheDir: string;
  private enabled: boolean;

  constructor(options?: { enabled?: boolean; cacheDir?: string }) {
    this.enabled = options?.enabled ?? true;
    this.cacheDir = options?.cacheDir ?? CACHE_DIR;

    if (this.enabled) {
      try {
        mkdirSync(this.cacheDir, { recursive: true });
      } catch {
        // If we can't create cache dir, disable file caching silently
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled) return null;

    // Check in-memory first
    const memEntry = this.memory.get(key) as CacheEntry<T> | undefined;
    if (memEntry && !this.isExpired(memEntry)) {
      return memEntry.data;
    }

    // Check file cache
    try {
      const filePath = this.keyToPath(key);
      if (existsSync(filePath)) {
        const raw = readFileSync(filePath, "utf-8");
        const entry = JSON.parse(raw) as CacheEntry<T>;
        if (!this.isExpired(entry)) {
          // Warm the in-memory cache
          this.memory.set(key, entry as CacheEntry<unknown>);
          return entry.data;
        }
      }
    } catch {
      // File read failed, treat as cache miss
    }

    return null;
  }

  async set<T>(key: string, data: T, ttlMs: number): Promise<void> {
    if (!this.enabled) return;

    const entry: CacheEntry<T> = {
      data,
      cachedAt: Date.now(),
      ttl: ttlMs,
    };

    // Always set in-memory
    this.memory.set(key, entry as CacheEntry<unknown>);

    // Write to file (best effort)
    try {
      const filePath = this.keyToPath(key);
      const tmpPath = filePath + ".tmp";
      writeFileSync(tmpPath, JSON.stringify(entry), "utf-8");
      // Atomic rename
      const { renameSync } = await import("fs");
      renameSync(tmpPath, filePath);
    } catch {
      // File write failed, in-memory cache still works
    }
  }

  async invalidate(key: string): Promise<void> {
    this.memory.delete(key);
    try {
      const filePath = this.keyToPath(key);
      if (existsSync(filePath)) {
        rmSync(filePath);
      }
    } catch {
      // Ignore
    }
  }

  async clear(): Promise<void> {
    this.memory.clear();
    try {
      if (existsSync(this.cacheDir)) {
        rmSync(this.cacheDir, { recursive: true });
        mkdirSync(this.cacheDir, { recursive: true });
      }
    } catch {
      // Ignore
    }
  }

  private isExpired(entry: CacheEntry<unknown>): boolean {
    return Date.now() - entry.cachedAt > entry.ttl;
  }

  private keyToPath(key: string): string {
    const hash = createHash("sha256").update(key).digest("hex").slice(0, 16);
    const safeName = key.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
    return join(this.cacheDir, `${safeName}_${hash}.json`);
  }
}

export function createCache(noCache = false): Cache {
  return new Cache({ enabled: !noCache });
}
