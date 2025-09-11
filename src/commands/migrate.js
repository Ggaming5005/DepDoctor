import chalk from "chalk";
import { fetchPackument } from "../lib/npmApi.js";
import { getGithubLastCommit } from "../lib/github.js";
import fs from "fs";
import path from "path";
import ora from "ora";
const replacementHints = { "moment":["dayjs","luxon","date-fns"], "lodash":["lodash-es","ramda","native"], "left-pad":["native"], "request":["node-fetch","axios"], "underscore":["lodash","native"] };
export default async function migrate(opts={}) {
  const spinner = ora("Checking packages...").start();
  try {
    const pkgPath = path.join(process.cwd(),"package.json");
    if (!fs.existsSync(pkgPath)) { spinner.fail("No package.json"); process.exit(1); }
    const pkg = JSON.parse(fs.readFileSync(pkgPath,"utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const suggestions = [];
    for (const name of Object.keys(deps)) {
      spinner.text = `Checking ${name}`;
      let pack=null;
      try { pack = await fetchPackument(name); } catch(e){ pack=null; }
      const deprecated = !!(pack && pack.deprecated);
      const latest = pack?.['dist-tags']?.latest ?? null;
      const repoUrl = pack?.repository?.url ?? pack?.repository ?? null;
      let lastCommit = null;
      if (repoUrl) lastCommit = await getGithubLastCommit(String(repoUrl), opts.githubToken || process.env.GITHUB_TOKEN);
      const daysSinceUpdate = lastCommit ? Math.floor((Date.now()-new Date(lastCommit).getTime())/(1000*60*60*24)) : null;
      const hint = replacementHints[name] ?? null;
      const risk = deprecated ? "deprecated" : (daysSinceUpdate && daysSinceUpdate>365*2 ? "stale" : null);
      if (deprecated || risk) suggestions.push({ name, latest, deprecated, deprecatedMessage: pack?.deprecated ?? null, repoUrl, lastCommit, daysSinceUpdate, risk, hint });
    }
    spinner.succeed("Done");
    if (suggestions.length===0) { console.log("No problematic packages found."); return; }
    console.log("\nMigration Suggestions:\n");
    for (const s of suggestions) {
      console.log(`${s.name} — ${s.risk ?? ""}`);
      if (s.deprecated && s.deprecatedMessage) console.log(`  Deprecated: ${s.deprecatedMessage}`);
      if (s.daysSinceUpdate) console.log(`  Last commit: ${s.lastCommit} (${s.daysSinceUpdate} days ago)`);
      if (s.hint) console.log(`  Suggested alternatives: ${s.hint.join(", ")}`);
      console.log("");
    }
    if (opts.fix) {
      let modified=false;
      for (const s of suggestions) {
        const alt = s.hint?.[0];
        if (alt) {
          if (pkg.dependencies && pkg.dependencies[s.name]) { delete pkg.dependencies[s.name]; pkg.dependencies[alt]="latest"; modified=true; }
          else if (pkg.devDependencies && pkg.devDependencies[s.name]) { delete pkg.devDependencies[s.name]; pkg.devDependencies[alt]="latest"; modified=true; }
        }
      }
      if (modified) { fs.writeFileSync(pkgPath, JSON.stringify(pkg,null,2),"utf8"); console.log("package.json updated (run npm install to apply)."); }
      else console.log("No automatic replacements available.");
    }
  } catch (err) { spinner.fail("Migration failed."); console.error(err); process.exit(1); }
}
