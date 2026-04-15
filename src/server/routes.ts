import { Router, type Request, type Response } from "express";
import { analyzeProject } from "../core/analyzer.js";
import { checkMigrations, applyMigrations } from "../core/migrator.js";
import { formatBadgeUrl } from "../ui/formatter.js";
import { Cache } from "../core/cache.js";
import { AnalyzeRequestSchema, MigrateRequestSchema } from "../config/schema.js";
import path from "path";

const router = Router();
const serverCache = new Cache();

router.get("/api/ping", (_req: Request, res: Response) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

router.post("/api/analyze", async (req: Request, res: Response) => {
  try {
    const parsed = AnalyzeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: "Invalid request body" });
      return;
    }

    const cwd = parsed.data.path
      ? path.resolve(parsed.data.path)
      : process.cwd();

    const result = await analyzeProject({
      cwd,
      concurrency: parsed.data.options.concurrency ?? 10,
      includeDepcheck: parsed.data.options.depcheck ?? false,
      cache: serverCache,
    });

    res.json({ ok: true, result });
  } catch (error) {
    console.error("[POST /api/analyze]", error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Analysis failed",
    });
  }
});

router.post("/api/migrate", async (req: Request, res: Response) => {
  try {
    const parsed = MigrateRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: "Invalid request body" });
      return;
    }

    const cwd = parsed.data.path
      ? path.resolve(parsed.data.path)
      : process.cwd();

    const suggestions = await checkMigrations({
      cwd,
      githubToken: parsed.data.options.githubToken,
      cache: serverCache,
    });

    let changes: { package: string; from: string; to: string; replacement: string }[] = [];
    let modified = false;

    if (parsed.data.options.fix) {
      const result = applyMigrations(cwd, suggestions);
      modified = result.modified;
      changes = result.changes;
    }

    res.json({ ok: true, suggestions, modified, changes });
  } catch (error) {
    console.error("[POST /api/migrate]", error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Migration check failed",
    });
  }
});

router.post("/api/badge", async (req: Request, res: Response) => {
  try {
    const cwd = process.cwd();
    const result = await analyzeProject({
      cwd,
      concurrency: 10,
      includeDepcheck: false,
      cache: serverCache,
    });

    const url = formatBadgeUrl(result.projectScore);
    res.json({ ok: true, score: result.projectScore, url });
  } catch (error) {
    console.error("[POST /api/badge]", error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Badge generation failed",
    });
  }
});

export default router;
