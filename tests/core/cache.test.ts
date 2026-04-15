import { describe, it, expect, beforeEach } from "vitest";
import { Cache } from "../../src/core/cache.js";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("Cache", () => {
  let cache: Cache;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "depdoctor-test-"));
    cache = new Cache({ enabled: true, cacheDir: tempDir });
  });

  it("returns null for a cache miss", async () => {
    const result = await cache.get("nonexistent");
    expect(result).toBeNull();
  });

  it("stores and retrieves data", async () => {
    await cache.set("test-key", { foo: "bar" }, 60_000);
    const result = await cache.get<{ foo: string }>("test-key");
    expect(result).toEqual({ foo: "bar" });
  });

  it("returns null for expired entries", async () => {
    await cache.set("expired", "data", 1); // 1ms TTL
    await new Promise((r) => setTimeout(r, 10)); // wait for expiry
    const result = await cache.get("expired");
    expect(result).toBeNull();
  });

  it("invalidates specific keys", async () => {
    await cache.set("to-delete", "value", 60_000);
    await cache.invalidate("to-delete");
    const result = await cache.get("to-delete");
    expect(result).toBeNull();
  });

  it("clears all cached data", async () => {
    await cache.set("a", 1, 60_000);
    await cache.set("b", 2, 60_000);
    await cache.clear();
    expect(await cache.get("a")).toBeNull();
    expect(await cache.get("b")).toBeNull();
  });

  it("does nothing when disabled", async () => {
    const disabledCache = new Cache({ enabled: false });
    await disabledCache.set("key", "value", 60_000);
    const result = await disabledCache.get("key");
    expect(result).toBeNull();
  });

  // Cleanup
  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true });
    } catch {
      // ignore
    }
  });
});
