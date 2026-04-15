import { writeFileSync, readFileSync, existsSync } from "fs";
import chalk from "chalk";
import { analyzeProject } from "../core/analyzer.js";
import { createCache } from "../core/cache.js";
import { createSpinner, createProgressCallback } from "../ui/progress.js";
import { formatBadgeUrl } from "../ui/formatter.js";
import type { BadgeOptions } from "../types/index.js";

export default async function badge(options: BadgeOptions): Promise<void> {
  const cwd = process.cwd();
  const cache = createCache(options.noCache);
  const spinner = createSpinner("Generating badge...");
  spinner.start();

  try {
    const result = await analyzeProject({
      cwd,
      concurrency: 10,
      includeDepcheck: false,
      cache,
      onProgress: createProgressCallback(spinner),
    });

    spinner.stop();

    const score = result.projectScore;
    const url = formatBadgeUrl(score);

    console.log(`\n  ${chalk.bold("Badge URL:")} ${chalk.cyan(url)}`);

    const markdown = `![depdoctor score](${url})`;
    console.log(`  ${chalk.bold("Markdown:")} ${markdown}\n`);

    // Write to file if --output specified
    if (options.output) {
      if (existsSync(options.output)) {
        const content = readFileSync(options.output, "utf-8");
        writeFileSync(options.output, content + "\n" + markdown + "\n", "utf-8");
      } else {
        writeFileSync(options.output, markdown + "\n", "utf-8");
      }
      console.log(
        `  ${chalk.green("✓")} Badge appended to ${chalk.cyan(options.output)}\n`,
      );
    }

    // CI threshold check
    if (options.ci !== undefined && score < options.ci) {
      console.log(
        chalk.red(
          `  ✗ Score ${score} is below CI threshold ${options.ci}\n`,
        ),
      );
      process.exit(2);
    }
  } catch (error) {
    spinner.fail(error instanceof Error ? error.message : "Badge generation failed");
    process.exit(1);
  }
}
