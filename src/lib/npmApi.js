import fetch from "node-fetch";
export async function fetchPackument(pkgName) {
  const url = `https://registry.npmjs.org/${encodeURIComponent(pkgName)}`;
  const res = await fetch(url, { headers: { 'accept': 'application/vnd.npm.install-v1+json' }});
  if (!res.ok) throw new Error(`Failed to fetch npm packument for ${pkgName}: ${res.status}`);
  return await res.json();
}
export async function fetchWeeklyDownloads(pkgName) {
  try {
    const url = `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(pkgName)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    return json.downloads ?? null;
  } catch (e) { return null; }
}
