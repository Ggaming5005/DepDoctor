import { analyzeProject } from "../core/analyzer.js";
import { createCache } from "../core/cache.js";
import { createSpinner, createProgressCallback } from "../ui/progress.js";
import { formatAnalysisTable } from "../ui/formatter.js";
import type { AnalyzeOptions } from "../types/index.js";

export default async function analyze(options: AnalyzeOptions): Promise<void> {
  const cwd = process.cwd();
  const cache = createCache(options.noCache);

  const spinner = createSpinner("Analyzing dependencies...");

  if (!options.json) {
    spinner.start();
  }

  try {
    const result = await analyzeProject({
      cwd,
      concurrency: options.concurrency,
      includeDepcheck: options.depcheck,
      cache,
      onProgress: options.json ? undefined : createProgressCallback(spinner),
    });

    if (!options.json) {
      spinner.stop();
    }

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatAnalysisTable(result));
    }
  } catch (error) {
    spinner.fail(
      error instanceof Error ? error.message : "Analysis failed",
    );
    process.exit(1);
  }
}
