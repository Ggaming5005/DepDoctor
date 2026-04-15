import { fetchJson } from "../utils/http.js";
import { CACHE_TTL } from "../config/defaults.js";
import type { Cache } from "../core/cache.js";

interface GitHubCommit {
  commit: {
    committer: {
      date: string;
    };
  };
}

/**
 * Extract owner/repo from a GitHub URL.
 * Handles: https://github.com/owner/repo, git+https://github.com/owner/repo.git, etc.
 */
function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(
    /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/,
  );
  if (!match?.[1] || !match[2]) return null;
  return { owner: match[1], repo: match[2] };
}

export async function getLastCommitDate(
  repoUrl: string,
  cache: Cache,
  token?: string,
): Promise<Date | null> {
  const parsed = parseGithubUrl(repoUrl);
  if (!parsed) return null;

  const cacheKey = `github:${parsed.owner}/${parsed.repo}`;
  const cached = await cache.get<string>(cacheKey);
  if (cached) return new Date(cached);

  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "depdoctor",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const commits = await fetchJson<GitHubCommit[]>(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/commits?per_page=1`,
      { headers },
    );

    const dateStr = commits[0]?.commit?.committer?.date;
    if (!dateStr) return null;

    await cache.set(cacheKey, dateStr, CACHE_TTL.github);
    return new Date(dateStr);
  } catch {
    return null;
  }
}
