import { z } from "zod";

export const AnalyzeOptionsSchema = z.object({
  json: z.boolean().default(false),
  depcheck: z.boolean().default(false),
  concurrency: z.number().int().positive().max(50).default(10),
  noCache: z.boolean().default(false),
});

export const MigrateOptionsSchema = z.object({
  fix: z.boolean().default(false),
  githubToken: z.string().optional(),
  noCache: z.boolean().default(false),
});

export const BadgeOptionsSchema = z.object({
  output: z.string().optional(),
  ci: z.number().int().min(0).max(100).optional(),
  noCache: z.boolean().default(false),
});

export const ServeOptionsSchema = z.object({
  port: z.number().int().positive().default(4200),
});

// Server request body schemas
export const AnalyzeRequestSchema = z.object({
  path: z.string().default(""),
  options: z
    .object({
      depcheck: z.boolean().optional(),
      concurrency: z.number().int().positive().max(50).optional(),
      noCache: z.boolean().optional(),
    })
    .default({}),
});

export const MigrateRequestSchema = z.object({
  path: z.string().default(""),
  options: z
    .object({
      fix: z.boolean().optional(),
      githubToken: z.string().optional(),
    })
    .default({}),
});
