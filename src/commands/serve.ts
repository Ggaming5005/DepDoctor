import chalk from "chalk";
import open from "open";
import { createApp } from "../server/app.js";
import type { ServeOptions } from "../types/index.js";

export default async function serve(options: ServeOptions): Promise<void> {
  const app = createApp();
  const { port } = options;

  app.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`\n  ${chalk.bold("depdoctor dashboard")} running at ${chalk.cyan(url)}\n`);
    console.log(chalk.dim("  Press Ctrl+C to stop\n"));
    open(url).catch(() => {
      // Browser open failed, not critical
    });
  });
}
