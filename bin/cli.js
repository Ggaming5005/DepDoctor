#!/usr/bin/env node
import { Command } from "commander";
import analyze from "../src/commands/analyze.js";
import migrate from "../src/commands/migrate.js";
import badge from "../src/commands/badge.js";
import server from "../server/index.js";

const program = new Command();

program.name("depdoctor").description("depdoctor — dependency health toolkit").version("0.2.1");

program
  .command("analyze")
  .option("--json", "print JSON output")
  .option("--depcheck", "run depcheck to detect unused deps (slower)")
  .description("Analyze dependency bloat & health")
  .action(async (opts) => { await analyze(opts); });

program
  .command("migrate")
  .option("--fix", "attempt automatic replacements in package.json")
  .option("--github-token <token>", "GitHub token or set GITHUB_TOKEN env var")
  .description("Suggest migrations for deprecated or unhealthy deps")
  .action(async (opts) => { await migrate(opts); });

program
  .command("badge")
  .option("--output <file>", "write badge markdown into file (e.g., README.md)")
  .option("--ci <threshold>", "fail with non-zero if score < threshold", (v) => parseInt(v,10))
  .description("Generate a dependency health badge")
  .action(async (opts) => { await badge(opts); });

program
  .command("serve")
  .option("--port <n>", "port to run dashboard", (v) => parseInt(v,10))
  .description("Start the dashboard server (default port 3000)")
  .action(async (opts) => {
    const port = opts.port || process.env.PORT || 3000;
    try {
      await server.start(port);
    } catch (e) {
      console.error("Failed to start server:", e);
      process.exit(1);
    }
  });

program.parse(process.argv);
