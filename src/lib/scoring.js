export function computePackageScore({
  downloads = 0,
  daysSinceUpdate = 3650,
  gzipBytes = null,
  deprecated = false,
  vulnerabilityCount = 0,
  requested = "",
  latest = "",
}) {
  if (deprecated) return 5;
  let score = 100;
  // Version currency: if requested === latest, no penalty, else -20
  if (requested && latest && requested !== latest) score -= 20;
  // Downloads: if very low (<1000), -10, if high (>1M), +5
  if (downloads < 1000) score -= 10;
  else if (downloads > 1000000) score += 5;
  // Freshness: if daysSinceUpdate > 365, -10, > 1000, -20
  if (daysSinceUpdate > 1000) score -= 20;
  else if (daysSinceUpdate > 365) score -= 10;
  // Size: if gzipBytes > 100KB, -5, > 500KB, -10
  if (gzipBytes != null) {
    const kb = gzipBytes / 1024;
    if (kb > 500) score -= 10;
    else if (kb > 100) score -= 5;
  }
  // Vulnerabilities: -20 per vuln
  score -= vulnerabilityCount * 20;
  score = Math.max(0, Math.min(100, score));
  return score;
}
export function computeProjectScore(packages) {
  if (!packages || packages.length === 0) return 100;
  let totalWeight = 0,
    weightedSum = 0;
  for (const p of packages) {
    const weight = Math.max(1, Math.log10(p.downloads || 1) + 1);
    const pkgScore = p.score ?? 50;
    weightedSum += pkgScore * weight;
    totalWeight += weight;
  }
  return Math.round(weightedSum / totalWeight);
}
