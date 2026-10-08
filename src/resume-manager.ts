// ──────────────────────────────────────────────────────────────
// resume-manager.ts — Validates & guards the local resume file
// ──────────────────────────────────────────────────────────────

import fs from "fs";
import path from "path";
import { config } from "./config";
import { logger } from "./logger";

// ── Types ────────────────────────────────────────────────────

export interface ResumeMetadata {
  filename: string;
  absolutePath: string;
  mimeType: "application/pdf";
  sizeBytes: number;
  lastModified: Date;
}

export interface ResumeStatus {
  available: boolean;
  filename: string;
  type: "application/pdf";
  sizeBytes: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  metadata?: ResumeMetadata;
}

// ── Constants ────────────────────────────────────────────────

const ALLOWED_EXTENSIONS = [".pdf"];
const ALLOWED_MIME = "application/pdf" as const;

// ── ResumeManager ────────────────────────────────────────────

export class ResumeManager {
  private readonly resumePath: string;
  private readonly maxSizeBytes: number;
  private cachedMetadata: ResumeMetadata | null = null;

  constructor() {
    this.resumePath = config.resumePath;
    this.maxSizeBytes = config.maxResumeSizeMb * 1024 * 1024;
  }

  // ── Public API ───────────────────────────────────────────

  /** Absolute path to the resume file (for Playwright setInputFiles). */
  getResumePath(): string {
    return this.resumePath;
  }

  /** Metadata about the resume file. Throws if invalid. */
  getResumeMetadata(): ResumeMetadata {
    if (this.cachedMetadata) return this.cachedMetadata;

    const result = this.validateResume();
    if (!result.valid || !result.metadata) {
      throw new Error(
        `Resume validation failed: ${result.errors.join("; ")}`
      );
    }
    this.cachedMetadata = result.metadata;
    return this.cachedMetadata;
  }

  /** Validate the resume against all rules. */
  validateResume(): ValidationResult {
    const errors: string[] = [];

    // 1. File existence
    if (!fs.existsSync(this.resumePath)) {
      errors.push(`Resume file not found: ${this.resumePath}`);
      return { valid: false, errors };
    }

    // 2. Extension check
    const ext = path.extname(this.resumePath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      errors.push(
        `Invalid file extension "${ext}". Only PDF files are accepted.`
      );
    }

    // 3. File stats
    let stat: fs.Stats;
    try {
      stat = fs.statSync(this.resumePath);
    } catch (err) {
      errors.push(`Cannot read file stats: ${(err as Error).message}`);
      return { valid: false, errors };
    }

    if (!stat.isFile()) {
      errors.push("Resume path does not point to a regular file.");
      return { valid: false, errors };
    }

    // 4. Size check
    if (stat.size === 0) {
      errors.push("Resume file is empty (0 bytes).");
    }
    if (stat.size > this.maxSizeBytes) {
      errors.push(
        `Resume size (${(stat.size / 1024 / 1024).toFixed(2)} MB) exceeds maximum (${config.maxResumeSizeMb} MB).`
      );
    }

    // 5. PDF magic-byte verification
    try {
      const fd = fs.openSync(this.resumePath, "r");
      const buf = Buffer.alloc(5);
      fs.readSync(fd, buf, 0, 5, 0);
      fs.closeSync(fd);

      if (buf.toString("ascii") !== "%PDF-") {
        errors.push(
          "File does not begin with PDF magic bytes (%PDF-). Not a valid PDF."
        );
      }
    } catch (err) {
      errors.push(
        `Cannot read file header: ${(err as Error).message}`
      );
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    const metadata: ResumeMetadata = {
      filename: path.basename(this.resumePath),
      absolutePath: this.resumePath,
      mimeType: ALLOWED_MIME,
      sizeBytes: stat.size,
      lastModified: stat.mtime,
    };

    this.cachedMetadata = metadata;

    // Log safely — NO file contents, NO path logged in production
    logger.info(
      { component: "RESUME", sizeBytes: stat.size },
      "Resume validated"
    );

    return { valid: true, errors: [], metadata };
  }

  /** Status response for the API (never returns the file itself). */
  getStatus(): ResumeStatus {
    try {
      const meta = this.getResumeMetadata();
      return {
        available: true,
        filename: meta.filename,
        type: meta.mimeType,
        sizeBytes: meta.sizeBytes,
      };
    } catch {
      return {
        available: false,
        filename: path.basename(this.resumePath),
        type: ALLOWED_MIME,
        sizeBytes: 0,
      };
    }
  }

  /** Invalidate cached metadata (useful after file replacement). */
  clearCache(): void {
    this.cachedMetadata = null;
  }
}
