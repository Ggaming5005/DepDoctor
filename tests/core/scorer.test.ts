import { describe, it, expect } from "vitest";
import { computePackageScore, computeProjectScore } from "../../src/core/scorer.js";
import type { ScoreInput, PackageInfo } from "../../src/types/index.js";

function makeInput(overrides: Partial<ScoreInput> = {}): ScoreInput {
  return {
    downloads: 100_000,
    daysSinceUpdate: 30,
    gzipBytes: 10_000,
    deprecated: false,
    vulnerabilities: [],
    requestedRange: "^5.0.0",
    latestVersion: "5.0.0",
    installedVersion: "5.0.0",
    ...overrides,
  };
}

describe("computePackageScore", () => {
  it("returns 100 for a perfectly healthy package", () => {
    const score = computePackageScore(makeInput());
    expect(score).toBeGreaterThanOrEqual(95); // might get +5 for high downloads
  });

  it("returns 5 for deprecated packages", () => {
    const score = computePackageScore(makeInput({ deprecated: true }));
    expect(score).toBe(5);
  });

  it("penalizes packages behind by a major version", () => {
    const score = computePackageScore(
      makeInput({ installedVersion: "4.0.0", latestVersion: "5.0.0" }),
    );
    expect(score).toBeLessThanOrEqual(80);
  });

  it("penalizes packages behind by a minor version less than major", () => {
    const scoreMajor = computePackageScore(
      makeInput({ installedVersion: "4.0.0", latestVersion: "5.0.0" }),
    );
    const scoreMinor = computePackageScore(
      makeInput({ installedVersion: "5.0.0", latestVersion: "5.1.0" }),
    );
    expect(scoreMinor).toBeGreaterThan(scoreMajor);
  });

  it("penalizes low download counts", () => {
    const score = computePackageScore(makeInput({ downloads: 50 }));
    expect(score).toBeLessThan(computePackageScore(makeInput({ downloads: 100_000 })));
  });

  it("gives bonus for very popular packages", () => {
    const score = computePackageScore(makeInput({ downloads: 5_000_000 }));
    expect(score).toBeGreaterThanOrEqual(100); // 100 + 5 bonus, clamped to 100
  });

  it("penalizes stale packages (>2 years)", () => {
    const score = computePackageScore(makeInput({ daysSinceUpdate: 800 }));
    expect(score).toBeLessThan(computePackageScore(makeInput({ daysSinceUpdate: 30 })));
  });

  it("penalizes large bundle size", () => {
    const score = computePackageScore(makeInput({ gzipBytes: 600_000 }));
    expect(score).toBeLessThan(computePackageScore(makeInput({ gzipBytes: 5_000 })));
  });

  it("penalizes vulnerabilities weighted by severity", () => {
    const scoreCritical = computePackageScore(
      makeInput({
        vulnerabilities: [{ severity: "critical", title: "RCE", url: null }],
      }),
    );
    const scoreLow = computePackageScore(
      makeInput({
        vulnerabilities: [{ severity: "low", title: "Info leak", url: null }],
      }),
    );
    expect(scoreCritical).toBeLessThan(scoreLow);
  });

  it("clamps score to 0-100", () => {
    // Many vulnerabilities should not go below 0
    const score = computePackageScore(
      makeInput({
        vulnerabilities: [
          { severity: "critical", title: "a", url: null },
          { severity: "critical", title: "b", url: null },
          { severity: "critical", title: "c", url: null },
          { severity: "critical", title: "d", url: null },
        ],
      }),
    );
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("handles null values gracefully", () => {
    const score = computePackageScore(
      makeInput({
        downloads: null,
        gzipBytes: null,
        latestVersion: null,
        installedVersion: null,
      }),
    );
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("computeProjectScore", () => {
  it("returns 100 for empty package list", () => {
    expect(computeProjectScore([])).toBe(100);
  });

  it("returns weighted average based on downloads", () => {
    const packages = [
      { score: 90, downloads: 1_000_000 } as PackageInfo,
      { score: 30, downloads: 100 } as PackageInfo,
    ];
    const projectScore = computeProjectScore(packages);
    // The high-download package should dominate
    expect(projectScore).toBeGreaterThan(60);
  });

  it("handles packages with null downloads", () => {
    const packages = [
      { score: 80, downloads: null } as PackageInfo,
      { score: 60, downloads: null } as PackageInfo,
    ];
    const projectScore = computeProjectScore(packages);
    expect(projectScore).toBeGreaterThanOrEqual(0);
    expect(projectScore).toBeLessThanOrEqual(100);
  });
});
