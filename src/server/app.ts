import express from "express";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import routes from "./routes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createApp(): express.Express {
  const app = express();

  app.use(express.json());

  // Serve dashboard static files
  // Try multiple paths for dev vs built
  const dashboardPaths = [
    join(__dirname, "..", "..", "dashboard"),
    join(__dirname, "..", "dashboard"),
    join(__dirname, "dashboard"),
  ];

  for (const p of dashboardPaths) {
    app.use(express.static(p));
  }

  // API routes
  app.use(routes);

  return app;
}
