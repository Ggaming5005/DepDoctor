import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    cli: "bin/cli.ts",
    index: "src/index.ts",
  },
  format: ["esm"],
  target: "node20",
  clean: true,
  splitting: false,
  sourcemap: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
});
