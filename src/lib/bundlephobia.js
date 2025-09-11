import fetch from "node-fetch";
export async function fetchBundleSize(pkgName, version = "") {
  try {
    const pkgArg = version ? `${pkgName}@${version}` : pkgName;
    const url = `https://bundlephobia.com/api/size?package=${encodeURIComponent(pkgArg)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    return { sizeBytes: json.size ?? null, gzipBytes: json.gzip ?? null, dependencyCount: json.dependencyCount ?? null };
  } catch (err) { return null; }
}
