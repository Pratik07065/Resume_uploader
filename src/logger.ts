// ──────────────────────────────────────────────────────────────
// logger.ts — Structured logging with pino
// ──────────────────────────────────────────────────────────────
//
// Isolated from server.ts so every module can import the logger
// without circular-dependency issues.
// ──────────────────────────────────────────────────────────────

import pino from "pino";

// At import time, dotenv has already been loaded by config.ts,
// so these env vars are available.
const level = process.env.LOG_LEVEL ?? "info";
const isDev = (process.env.NODE_ENV ?? "development") === "development";

export const logger = pino({
  level,
  transport: isDev
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined,
});
