// ──────────────────────────────────────────────────────────────
// routes/health.ts — Health & resume-status endpoints
// ──────────────────────────────────────────────────────────────

import { Router } from "express";
import { ResumeManager } from "../resume-manager";

export function createHealthRouter(
  resumeManager: ResumeManager
): Router {
  const router = Router();

  // ── GET /api/health ──────────────────────────────────────

  router.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "resume-bridge",
      timestamp: new Date().toISOString(),
    });
  });

  // ── GET /api/resume/status ───────────────────────────────
  // Returns metadata ONLY — never the file itself.

  router.get("/api/resume/status", (_req, res) => {
    const status = resumeManager.getStatus();
    res.json(status);
  });

  return router;
}
