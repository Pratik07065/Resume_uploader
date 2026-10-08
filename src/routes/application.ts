// ──────────────────────────────────────────────────────────────
// routes/application.ts — Upload & test-upload endpoints
// ──────────────────────────────────────────────────────────────

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { config } from "../config";
import { ResumeManager } from "../resume-manager";
import { TinyFishBrowser } from "../tinyfish-browser";
import { ApplicationRunner } from "../application-runner";
import { logger } from "../logger";

// ── Request schemas ──────────────────────────────────────────

const uploadRequestSchema = z.object({
  url: z.string().url("A valid URL is required"),
});

// ── Helpers ──────────────────────────────────────────────────

/** Validate a URL against the domain allowlist + localhost. */
function isDomainAllowed(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();

    // Allow localhost in development
    if (
      config.nodeEnv === "development" &&
      (host === "localhost" || host === "127.0.0.1")
    ) {
      return true;
    }

    return config.allowedDomains.includes(host);
  } catch {
    return false;
  }
}

/** Reject private/internal IPs (SSRF protection). */
function isSsrfSafe(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();

    // Block private IPs (except localhost in dev, handled above)
    const blocked = [
      /^10\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^192\.168\./,
      /^0\./,
      /^169\.254\./,
      /^fc00:/i,
      /^fe80:/i,
      /^::1$/,
      /^127\./,
    ];

    // In development, allow localhost
    if (
      config.nodeEnv === "development" &&
      (host === "localhost" || /^127\./.test(host))
    ) {
      return true;
    }

    return !blocked.some((p) => p.test(host));
  } catch {
    return false;
  }
}

// Only HTTPS allowed in production
function isProtocolAllowed(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (config.nodeEnv === "development") {
      return ["http:", "https:"].includes(parsed.protocol);
    }
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// ── Router factory ───────────────────────────────────────────

export function createApplicationRouter(
  resumeManager: ResumeManager
): Router {
  const router = Router();

  // ── POST /api/application/test-upload ────────────────────
  // Opens the URL, finds the upload input, uploads resume,
  // does NOT submit the form.

  router.post(
    "/api/application/test-upload",
    async (req: Request, res: Response): Promise<void> => {
      // 1. Validate body
      const parsed = uploadRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          uploaded: false,
          submitted: false,
          reason: parsed.error.issues
            .map((i) => i.message)
            .join("; "),
        });
        return;
      }

      const { url } = parsed.data;

      // 2. Security checks
      if (!isProtocolAllowed(url)) {
        res.status(400).json({
          success: false,
          uploaded: false,
          submitted: false,
          reason: "Only HTTPS URLs are allowed in production",
        });
        return;
      }

      if (!isDomainAllowed(url)) {
        res.status(403).json({
          success: false,
          uploaded: false,
          submitted: false,
          reason: "Domain is not in the allowlist",
        });
        return;
      }

      if (!isSsrfSafe(url)) {
        res.status(403).json({
          success: false,
          uploaded: false,
          submitted: false,
          reason: "URL targets a private or internal address",
        });
        return;
      }

      // 3. Validate resume
      const validation = resumeManager.validateResume();
      if (!validation.valid) {
        res.status(500).json({
          success: false,
          uploaded: false,
          submitted: false,
          reason: `Resume invalid: ${validation.errors.join("; ")}`,
        });
        return;
      }

      const browser = new TinyFishBrowser();
      const runner = new ApplicationRunner();

      try {
        // 4. Connect
        const page = await browser.connect();

        // 5. Navigate
        await browser.navigateTo(page, url);

        logger.info({ component: "APPLICATION" }, "Page opened");

        // 6. Inspect
        const appState = await runner.getApplicationState(page);

        // 7. Upload
        const result = await runner.uploadResume(
          page,
          resumeManager.getResumePath()
        );

        logger.info(
          { component: "APPLICATION" },
          "Submission disabled for test"
        );

        // 8. Return — never submitted
        res.json({
          success: result.uploaded,
          uploaded: result.uploaded,
          filename: result.filename ?? null,
          submitted: false,
          applicationState: appState,
          ...(result.reason ? { reason: result.reason } : {}),
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : String(err);
        logger.error(
          { component: "APPLICATION", error: message },
          "Test upload failed"
        );
        res.status(500).json({
          success: false,
          uploaded: false,
          submitted: false,
          reason: message,
        });
      } finally {
        await browser.disconnect();
      }
    }
  );

  // ── POST /api/application/upload-resume ──────────────────
  // Production endpoint: detects ATS, uploads resume,
  // submission is DISABLED in v1.

  router.post(
    "/api/application/upload-resume",
    async (req: Request, res: Response): Promise<void> => {
      // 1. Validate body
      const parsed = uploadRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          uploaded: false,
          submitted: false,
          reason: parsed.error.issues
            .map((i) => i.message)
            .join("; "),
        });
        return;
      }

      const { url } = parsed.data;

      // 2. Security checks
      if (!isProtocolAllowed(url)) {
        res.status(400).json({
          success: false,
          uploaded: false,
          submitted: false,
          reason: "Only HTTPS URLs are allowed in production",
        });
        return;
      }

      if (!isDomainAllowed(url)) {
        res.status(403).json({
          success: false,
          uploaded: false,
          submitted: false,
          reason: "Domain is not in the allowlist",
        });
        return;
      }

      if (!isSsrfSafe(url)) {
        res.status(403).json({
          success: false,
          uploaded: false,
          submitted: false,
          reason: "URL targets a private or internal address",
        });
        return;
      }

      // 3. Validate resume
      const validation = resumeManager.validateResume();
      if (!validation.valid) {
        res.status(500).json({
          success: false,
          uploaded: false,
          submitted: false,
          reason: `Resume invalid: ${validation.errors.join("; ")}`,
        });
        return;
      }

      const browser = new TinyFishBrowser();
      const runner = new ApplicationRunner();

      try {
        // 4. Connect
        const page = await browser.connect();

        // 5. Navigate
        await browser.navigateTo(page, url);

        logger.info({ component: "APPLICATION" }, "Page opened");

        // 6. Inspect
        const appState = await runner.getApplicationState(page);

        // 7. Naukri-specific logic
        if (appState.isNaukri && appState.isExternalAts) {
          res.json({
            success: false,
            uploaded: false,
            submitted: false,
            supported: false,
            reason: "External ATS application",
            applicationState: appState,
          });
          return;
        }

        if (
          appState.isExternalAts &&
          !appState.isNaukri
        ) {
          res.json({
            success: false,
            uploaded: false,
            submitted: false,
            supported: false,
            reason:
              "External ATS detected. Only Naukri Easy Apply is supported in v1.",
            applicationState: appState,
          });
          return;
        }

        // 8. Upload
        const result = await runner.uploadResume(
          page,
          resumeManager.getResumePath()
        );

        // 9. Submission is DISABLED in v1
        res.json({
          success: result.uploaded,
          uploaded: result.uploaded,
          filename: result.filename ?? null,
          submitted: false,
          supported: true,
          applicationState: appState,
          ...(result.reason ? { reason: result.reason } : {}),
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : String(err);
        logger.error(
          { component: "APPLICATION", error: message },
          "Upload-resume failed"
        );
        res.status(500).json({
          success: false,
          uploaded: false,
          submitted: false,
          reason: message,
        });
      } finally {
        await browser.disconnect();
      }
    }
  );

  return router;
}
