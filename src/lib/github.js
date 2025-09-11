import fetch from "node-fetch";
export async function getGithubLastCommit(repoUrl, token = process.env.GITHUB_TOKEN) {
  try {
    if (!repoUrl) return null;
    const m = repoUrl.match(/github\.com[:/]+([^/]+)\/([^/.]+)(?:\.git)?/i);
    if (!m) return null;
    const owner = m[1], repo = m[2];
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`;
    const headers = { 'User-Agent': 'depdoctor' };
    if (token) headers['Authorization'] = `token ${token}`;
    const res = await fetch(apiUrl, { headers });
    if (!res.ok) return null;
    const json = await res.json();
    if (!Array.isArray(json) || json.length === 0) return null;
    return json[0].commit.committer.date;
  } catch (err) { return null; }
}
