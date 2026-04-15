import { readFileSync, existsSync } from "fs";
import { join } from "path";

export function readJsonFile<T>(filePath: string): T | null {
  try {
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  repository?:
    | string
    | { type?: string; url?: string; directory?: string };
}

export function readPackageJson(cwd: string): PackageJson | null {
  return readJsonFile<PackageJson>(join(cwd, "package.json"));
}

export function packageJsonExists(cwd: string): boolean {
  return existsSync(join(cwd, "package.json"));
}
