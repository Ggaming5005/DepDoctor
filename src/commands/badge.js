import fs from "fs";
import path from "path";
import analyze from "./analyze.js";
function shieldUrlForScore(score) { let color="green"; if(score<70) color="yellow"; if(score<50) color="orange"; if(score<30) color="red"; const label=encodeURIComponent("Dependency Health"); const msg=encodeURIComponent(`${score}%`); return `https://img.shields.io/badge/${label}-${msg}-${color}.svg`; }
export default async function badge(opts={}) {
  const fakeOpts={json:true, depcheck:false};
  const origLog = console.log;
  try {
    const logs=[]; console.log = (...args)=>logs.push(args.join(" "));
    await analyze(fakeOpts);
    const out = logs.join("\n");
    let captured;
    try { captured = JSON.parse(out); } catch(e) { captured = { projectScore:50 }; }
    const score = captured?.projectScore ?? 50;
    const url = shieldUrlForScore(score);
    if (opts.output) { const file = path.resolve(process.cwd(), opts.output); const md=`![Dependency Health](${url})\n`; fs.appendFileSync(file, `\n${md}`); console.log(`Badge written to ${file}`); }
    else console.log(url);
    if (opts.ci) { const threshold = parseInt(opts.ci,10)||70; if (score < threshold) { console.error(`Project score ${score} below threshold ${threshold}`); process.exit(2); } }
  } finally { console.log = origLog; }
}
