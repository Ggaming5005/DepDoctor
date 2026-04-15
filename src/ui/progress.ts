import ora, { type Ora } from "ora";
import type { ProgressCallback } from "../types/index.js";

export function createSpinner(text: string): Ora {
  return ora({ text, spinner: "dots" });
}

export function createProgressCallback(spinner: Ora): ProgressCallback {
  return (current: number, total: number, packageName: string) => {
    spinner.text = `Analyzing ${packageName} (${current}/${total})`;
  };
}
