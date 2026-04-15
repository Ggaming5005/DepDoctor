import chalk from "chalk";
import { checkMigrations, applyMigrations } from "../core/migrator.js";
import { createCache } from "../core/cache.js";
import { createSpinner, createProgressCallback } from "../ui/progress.js";
import { formatMigrationResults } from "../ui/formatter.js";
import type { MigrateOptions } from "../types/index.js";

export default async function migrate(options: MigrateOptions): Promise<void> {
  const cwd = process.cwd();
  const cache = createCache(options.noCache);
  const spinner = createSpinner("Checking for deprecated and stale packages...");
  spinner.start();

  try {
    const suggestions = await checkMigrations({
      cwd,
      githubToken: options.githubToken,
      cache,
      onProgress: createProgressCallback(spinner),
    });

    spinner.stop();

    console.log(formatMigrationResults(suggestions));

    if (options.fix && suggestions.length > 0) {
      console.log(chalk.bold("  Applying migrations...\n"));
      const result = applyMigrations(cwd, suggestions);

      if (result.modified) {
        for (const change of result.changes) {
          console.log(
            `  ${chalk.red(change.package)} → ${chalk.green(change.replacement)}`,
          );
        }
        console.log(
          `\n  ${chalk.green("✓")} package.json updated. Run ${chalk.cyan("npm install")} to apply changes.\n`,
        );
      } else {
        console.log(
          chalk.dim(
            "  No automatic replacements available for these packages.\n",
          ),
        );
      }
    }
  } catch (error) {
    spinner.fail(
      error instanceof Error ? error.message : "Migration check failed",
    );
    process.exit(1);
  }
}
