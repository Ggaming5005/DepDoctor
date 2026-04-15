import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parseLockfile, getInstalledVersion } from "../../src/providers/lock-parser.js";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("parseLockfile", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "depdoctor-lock-"));
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true });
    } catch {
      // ignore
    }
  });

  it("returns empty object when no lockfile exists", () => {
    const result = parseLockfile(tempDir);
    expect(result).toEqual({});
  });

  it("parses npm v2 lockfile format", () => {
    const lockContent = {
      lockfileVersion: 2,
      dependencies: {
        chalk: { version: "5.6.2" },
        commander: { version: "14.0.0" },
      },
    };

    writeFileSync(
      join(tempDir, "package-lock.json"),
      JSON.stringify(lockContent),
    );

    const result = parseLockfile(tempDir);
    expect(result["chalk"]).toEqual(["5.6.2"]);
    expect(result["commander"]).toEqual(["14.0.0"]);
  });

  it("parses npm v3 lockfile format (packages field)", () => {
    const lockContent = {
      lockfileVersion: 3,
      packages: {
        "": { name: "my-project", version: "1.0.0" },
        "node_modules/chalk": { version: "5.6.2" },
        "node_modules/@types/node": { version: "20.14.0" },
        "node_modules/foo/node_modules/bar": { version: "1.2.3" },
      },
    };

    writeFileSync(
      join(tempDir, "package-lock.json"),
      JSON.stringify(lockContent),
    );

    const result = parseLockfile(tempDir);
    expect(result["chalk"]).toEqual(["5.6.2"]);
    expect(result["@types/node"]).toEqual(["20.14.0"]);
    expect(result["bar"]).toEqual(["1.2.3"]);
  });

  it("handles nested v2 dependencies", () => {
    const lockContent = {
      lockfileVersion: 2,
      dependencies: {
        express: {
          version: "5.1.0",
          dependencies: {
            "body-parser": { version: "2.0.0" },
          },
        },
      },
    };

    writeFileSync(
      join(tempDir, "package-lock.json"),
      JSON.stringify(lockContent),
    );

    const result = parseLockfile(tempDir);
    expect(result["express"]).toEqual(["5.1.0"]);
    expect(result["body-parser"]).toEqual(["2.0.0"]);
  });

  it("collects multiple versions of the same package", () => {
    const lockContent = {
      lockfileVersion: 3,
      packages: {
        "node_modules/debug": { version: "4.3.4" },
        "node_modules/express/node_modules/debug": { version: "3.1.0" },
      },
    };

    writeFileSync(
      join(tempDir, "package-lock.json"),
      JSON.stringify(lockContent),
    );

    const result = parseLockfile(tempDir);
    expect(result["debug"]).toContain("4.3.4");
    expect(result["debug"]).toContain("3.1.0");
    expect(result["debug"]).toHaveLength(2);
  });

  it("handles malformed lockfile gracefully", () => {
    writeFileSync(join(tempDir, "package-lock.json"), "not json{{{");
    const result = parseLockfile(tempDir);
    expect(result).toEqual({});
  });
});

describe("getInstalledVersion", () => {
  it("returns the first version for a package", () => {
    const versions = { chalk: ["5.6.2", "4.1.2"] };
    expect(getInstalledVersion(versions, "chalk")).toBe("5.6.2");
  });

  it("returns null for unknown packages", () => {
    expect(getInstalledVersion({}, "unknown")).toBeNull();
  });
});
