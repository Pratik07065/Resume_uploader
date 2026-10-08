// ──────────────────────────────────────────────────────────────
// server.ts — Express entry point for Resume Bridge
// ──────────────────────────────────────────────────────────────

import express from "express";
import helmet from "helmet";
import cors from "cors";
import { config } from "./config";
import { logger } from "./logger";
import { ResumeManager } from "./resume-manager";
import { createHealthRouter } from "./routes/health";
import { createApplicationRouter } from "./routes/application";

// Re-export for convenience (not strictly needed now, but keeps
// the public surface consistent if anything still imports from here).
export { logger };

// ── Bootstrap ────────────────────────────────────────────────

function main(): void {
  const app = express();

  // ── Security middleware ────────────────────────────────────

  app.use(helmet());

  app.use(
    cors({
      origin: config.corsOrigin,
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "Authorization"],
      maxAge: 600,
    })
  );

  // Request size limits
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));

  // ── Request logging ────────────────────────────────────────

  app.use((req, _res, next) => {
    logger.info(
      { component: "HTTP", method: req.method, url: req.url },
      "Incoming request"
    );
    next();
  });

  // ── Resume validation at startup ───────────────────────────

  const resumeManager = new ResumeManager();
  const validation = resumeManager.validateResume();

  if (validation.valid) {
    logger.info(
      { component: "STARTUP" },
      `Resume ready: ${resumeManager.getResumeMetadata().filename}`
    );
  } else {
    logger.warn(
      { component: "STARTUP", errors: validation.errors },
      "Resume validation failed — upload endpoints will return errors until a valid PDF is placed at the configured path"
    );
  }

  // ── Routes ─────────────────────────────────────────────────

  app.use(createHealthRouter(resumeManager));
  app.use(createApplicationRouter(resumeManager));

  // ── 404 catch-all ──────────────────────────────────────────

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // ── Global error handler ───────────────────────────────────

  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      logger.error(
        { component: "HTTP", error: err.message },
        "Unhandled error"
      );
      res.status(500).json({ error: "Internal server error" });
    }
  );

  // ── Start ──────────────────────────────────────────────────

  app.listen(config.port, () => {
    logger.info(
      { component: "STARTUP", port: config.port, env: config.nodeEnv },
      `Resume Bridge running on http://localhost:${config.port}`
    );
  });
}

main();
