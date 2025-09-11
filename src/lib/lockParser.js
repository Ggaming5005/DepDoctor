import fs from "fs";
import path from "path";
export function parseLockfileVersions(cwd = process.cwd()) {
  const lockPaths = [path.join(cwd,"package-lock.json"), path.join(cwd,"npm-shrinkwrap.json")];
  let lock; for (const p of lockPaths) { if (fs.existsSync(p)) { try { lock = JSON.parse(fs.readFileSync(p,"utf8")); break; } catch(e){} } }
  if (!lock) return {};
  const versions = {};
  if (lock.dependencies) {
    for (const [name, meta] of Object.entries(lock.dependencies)) {
      versions[name] = versions[name] || new Set();
      if (meta.version) versions[name].add(meta.version);
    }
  }
  const simple = {}; for (const [k,s] of Object.entries(versions)) simple[k]=Array.from(s);
  return simple;
}
