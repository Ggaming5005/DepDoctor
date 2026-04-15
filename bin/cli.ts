import { Command } from "commander";
import analyze from "../src/commands/analyze.js";
import migrate from "../src/commands/migrate.js";
import badge from "../src/commands/badge.js";
import serve from "../src/commands/serve.js";

const program = new Command();

program
  .name("depdoctor")
  .description("Analyze dependency health for npm projects")
  .version("1.0.0");

program
  .command("analyze")
  .description("Analyze dependency health of the current project")
  .option("--json", "Output results as JSON", false)
  .option("--depcheck", "Include unused dependency detection", false)
  .option("--concurrency <n>", "Number of parallel requests", parseInt, 10)
  .option("--no-cache", "Bypass cache and fetch fresh data")
  .action(async (opts) => {
    await analyze({
      json: opts.json ?? false,
      depcheck: opts.depcheck ?? false,
      concurrency: opts.concurrency ?? 10,
      noCache: !opts.cache,
    });
  });

program
  .command("migrate")
  .description("Find deprecated and stale packages with replacement suggestions")
  .option("--fix", "Automatically replace packages in package.json", false)
  .option("--github-token <token>", "GitHub token for API rate limits")
  .option("--no-cache", "Bypass cache and fetch fresh data")
  .action(async (opts) => {
    await migrate({
      fix: opts.fix ?? false,
      githubToken: opts.githubToken,
      noCache: !opts.cache,
    });
  });

program
  .command("badge")
  .description("Generate a dependency health badge")
  .option("--output <file>", "Append badge markdown to a file")
  .option("--ci <threshold>", "Exit with code 2 if score is below threshold", parseInt)
  .option("--no-cache", "Bypass cache and fetch fresh data")
  .action(async (opts) => {
    await badge({
      output: opts.output,
      ci: opts.ci,
      noCache: !opts.cache,
    });
  });

program
  .command("serve")
  .description("Start the depdoctor dashboard")
  .option("--port <n>", "Port to listen on", parseInt, 4200)
  .action(async (opts) => {
    await serve({
      port: opts.port ?? 4200,
    });
  });

program.parse();
