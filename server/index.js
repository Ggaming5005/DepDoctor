import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import fs from "fs";
import open from "open";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.use(express.static(path.join(__dirname,"public")));
app.use(express.json({ limit: '10mb' }));

function runCliInPath(projectPath, args=[], timeoutMs=120000) {
  return new Promise((resolve,reject)=>{
    const cwd = projectPath && projectPath.length ? path.resolve(projectPath) : process.cwd();
    const cliPath = path.resolve(process.cwd(),"bin","cli.js");
    if (!fs.existsSync(cliPath)) return reject(new Error("CLI not found in server folder"));
    const child = spawn(process.execPath, [cliPath, ...args], { cwd, windowsHide: true });
    let stdout="", stderr=""; let finished=false;
    const to = setTimeout(()=>{ if(!finished){ child.kill(); finished=true; reject(new Error("CLI execution timed out")); } }, timeoutMs);
    child.stdout.on("data", d => stdout += d.toString());
    child.stderr.on("data", d => stderr += d.toString());
    child.on("error", err => { clearTimeout(to); if(finished) return; finished=true; reject(err); });
    child.on("close", code => { clearTimeout(to); if(finished) return; finished=true; resolve({ code, stdout, stderr }); });
  });
}

app.post("/api/analyze", async (req,res)=>{
  try {
    const projectPath = req.body.path || "";
    const opts = req.body.options || {};
    const args = ["analyze","--json"];
    if (opts.depcheck) args.push("--depcheck");
    const result = await runCliInPath(projectPath, args);
    let json=null;
    try { json = JSON.parse(result.stdout); } catch(e) { json = { raw: result.stdout, stderr: result.stderr, code: result.code }; }
    res.json({ ok:true, result: json });
  } catch(e) { res.status(500).json({ ok:false, error: e.message }); }
});

app.post("/api/migrate", async (req,res)=>{
  try {
    const projectPath = req.body.path || "";
    const opts = req.body.options || {};
    const args = ["migrate"];
    if (opts.fix) args.push("--fix");
    if (opts.githubToken) args.push("--github-token", opts.githubToken);
    const result = await runCliInPath(projectPath, args);
    res.json({ ok:true, stdout: result.stdout, stderr: result.stderr, code: result.code });
  } catch(e) { res.status(500).json({ ok:false, error: e.message }); }
});

app.post("/api/badge", async (req,res)=>{
  try {
    const projectPath = req.body.path || "";
    const opts = req.body.options || {};
    const args = ["badge"];
    if (opts.output) args.push("--output", opts.output);
    if (opts.ci) args.push("--ci", String(opts.ci));
    const result = await runCliInPath(projectPath, args);
    res.json({ ok:true, stdout: result.stdout, stderr: result.stderr, code: result.code });
  } catch(e) { res.status(500).json({ ok:false, error: e.message }); }
});

app.get("/api/ping", (req,res)=>res.json({ ok:true, time: Date.now() }));

export default {
  start: async (port = 3000) => {
    app.listen(port, ()=> console.log(`depdoctor server running at http://localhost:${port}`));
    try { await open(`http://localhost:${port}`); } catch(e){}
  }
};
