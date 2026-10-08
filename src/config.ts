// ──────────────────────────────────────────────────────────────
// config.ts — Validated application configuration
// ──────────────────────────────────────────────────────────────

import { z } from "zod";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

// ── Schema ───────────────────────────────────────────────────

const configSchema = z.object({
  // Server
  port: z.coerce.number().int().min(1).max(65535).default(3100),
  nodeEnv: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Resume
  resumePath: z.string().min(1).default("./resumes/PRATIK_PAWAR_RESUME.pdf"),
  maxResumeSizeMb: z.coerce.number().positive().default(10),

  // TinyFish Browser API
  tinyfishApiKey: z.string().default(""),
  tinyfishApiUrl: z
    .string()
    .url()
    .default("https://api.tinyfish.io"),
  tinyfishProfileId: z
    .string()
    .min(1)
    .default("prof_55b631fbbddc4692"),

  // Security
  corsOrigin: z.string().default("http://localhost:3100"),
  allowedDomains: z
    .string()
    .default("www.naukri.com,naukri.com")
    .transform((v) => v.split(",").map((d) => d.trim().toLowerCase())),

  // Logging
  logLevel: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
});

export type AppConfig = z.infer<typeof configSchema>;

// ── Parse & Validate ─────────────────────────────────────────

function loadConfig(): AppConfig {
  const raw = {
    port: process.env.PORT,
    nodeEnv: process.env.NODE_ENV,
    resumePath: process.env.RESUME_PATH,
    maxResumeSizeMb: process.env.MAX_RESUME_SIZE_MB,
    tinyfishApiKey: process.env.TINYFISH_API_KEY,
    tinyfishApiUrl: process.env.TINYFISH_API_URL,
    tinyfishProfileId: process.env.TINYFISH_PROFILE_ID,
    corsOrigin: process.env.CORS_ORIGIN,
    allowedDomains: process.env.ALLOWED_DOMAINS,
    logLevel: process.env.LOG_LEVEL,
  };

  const result = configSchema.safeParse(raw);

  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Configuration validation failed:\n${errors}`);
  }

  // Resolve resume path relative to project root
  const cfg = result.data;
  cfg.resumePath = path.resolve(cfg.resumePath);

  return cfg;
}

export const config = loadConfig();
