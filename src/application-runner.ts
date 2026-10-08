// ──────────────────────────────────────────────────────────────
// application-runner.ts — Detects file inputs & uploads resume
// ──────────────────────────────────────────────────────────────

import type { Page, Locator } from "playwright";
import { logger } from "./logger";

// ── Types ────────────────────────────────────────────────────

export interface UploadResult {
  uploaded: boolean;
  filename?: string;
  reason?: string;
  selector?: string;
}

export interface ApplicationState {
  url: string;
  title: string;
  isNaukri: boolean;
  isExternalAts: boolean;
  hasFileInput: boolean;
  inputCount: number;
}

// ── Selectors (ordered by specificity) ───────────────────────

const FILE_INPUT_SELECTORS = [
  'input[type="file"][accept*="pdf"]',
  'input[type="file"][name*="resume" i]',
  'input[type="file"][name*="cv" i]',
  'input[type="file"][id*="resume" i]',
  'input[type="file"][id*="cv" i]',
  'input[type="file"][aria-label*="resume" i]',
  'input[type="file"][aria-label*="cv" i]',
  'input[type="file"][data-testid*="resume" i]',
  'input[type="file"][data-testid*="cv" i]',
  'input[type="file"][accept*=".pdf"]',
  'input[type="file"]',
];

// ── ApplicationRunner ────────────────────────────────────────

export class ApplicationRunner {
  // ── Public API ───────────────────────────────────────────

  /**
   * Upload a resume file to the first compatible file input on the page.
   * Uses Playwright's setInputFiles — works even on hidden inputs.
   */
  async uploadResume(
    page: Page,
    resumePath: string
  ): Promise<UploadResult> {
    const input = await this.findResumeInput(page);

    if (!input.locator) {
      logger.warn(
        { component: "RESUME" },
        "No compatible resume upload field found"
      );
      return {
        uploaded: false,
        reason:
          input.reason ?? "No compatible resume upload field found",
      };
    }

    logger.info(
      { component: "RESUME", selector: input.selector },
      "Upload field detected"
    );

    try {
      // setInputFiles works on both visible and hidden file inputs
      await input.locator.setInputFiles(resumePath);

      // Wait for the page to react
      await page.waitForTimeout(2_000);

      // Verify upload
      const verified = await this.verifyResumeUpload(page);

      logger.info(
        { component: "RESUME", verified },
        "Upload completed"
      );

      // Extract filename from the resume path
      const filename = resumePath.split(/[\\/]/).pop() ?? "";

      return {
        uploaded: true,
        filename,
        selector: input.selector ?? undefined,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(
        { component: "RESUME", error: message },
        "Upload failed"
      );
      return {
        uploaded: false,
        reason: `Upload failed: ${message}`,
      };
    }
  }

  /**
   * Check the page for evidence that the upload succeeded.
   * Looks for filename display, success badges, or changed input state.
   */
  async verifyResumeUpload(page: Page): Promise<boolean> {
    // Strategy 1: filename text visible on page
    const filenameVisible = await page
      .locator('text="PRATIK_PAWAR_RESUME.pdf"')
      .isVisible()
      .catch(() => false);
    if (filenameVisible) return true;

    // Strategy 2: partial filename text
    const partialMatch = await page
      .locator('text="PRATIK_PAWAR_RESUME"')
      .isVisible()
      .catch(() => false);
    if (partialMatch) return true;

    // Strategy 3: generic upload confirmation patterns
    const confirmSelectors = [
      '[class*="upload-success"]',
      '[class*="file-name"]',
      '[class*="uploaded"]',
      '[data-upload-status="success"]',
      '.file-preview',
      '.upload-preview',
    ];

    for (const sel of confirmSelectors) {
      const visible = await page
        .locator(sel)
        .first()
        .isVisible()
        .catch(() => false);
      if (visible) return true;
    }

    // Strategy 4: check if a file input now has files
    const hasFiles = await page.evaluate(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>(
        'input[type="file"]'
      );
      for (const input of inputs) {
        if (input.files && input.files.length > 0) return true;
      }
      return false;
    });

    return hasFiles;
  }

  /**
   * Find the best file input on the page for a resume upload.
   */
  async findResumeInput(
    page: Page
  ): Promise<{
    locator: Locator | null;
    selector: string | null;
    reason?: string;
  }> {
    for (const selector of FILE_INPUT_SELECTORS) {
      try {
        const locator = page.locator(selector).first();
        const count = await page.locator(selector).count();

        if (count > 0) {
          return { locator, selector };
        }
      } catch {
        // Selector not found, try next
      }
    }

    // Fallback: look for hidden inputs that might be triggered by JS
    const hiddenInput = await page.evaluate(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>(
        'input[type="file"]'
      );
      return inputs.length;
    });

    if (hiddenInput > 0) {
      return {
        locator: page.locator('input[type="file"]').first(),
        selector: 'input[type="file"] (hidden)',
      };
    }

    return {
      locator: null,
      selector: null,
      reason: "No compatible resume upload field found",
    };
  }

  /**
   * Inspect the current page and return structured state.
   */
  async getApplicationState(page: Page): Promise<ApplicationState> {
    const url = page.url();
    const title = await page.title();

    const isNaukri = /naukri\.com/i.test(url);
    const isExternalAts = this.detectExternalAts(url);

    const inputCount = await page
      .locator('input[type="file"]')
      .count();

    return {
      url,
      title,
      isNaukri,
      isExternalAts,
      hasFileInput: inputCount > 0,
      inputCount,
    };
  }

  // ── Internals ────────────────────────────────────────────

  /** Detect if the URL has left Naukri and redirected to an external ATS. */
  private detectExternalAts(url: string): boolean {
    const externalPatterns = [
      /smartrecruiters\.com/i,
      /greenhouse\.io/i,
      /lever\.co/i,
      /myworkdayjobs\.com/i,
      /icims\.com/i,
      /taleo/i,
      /successfactors/i,
      /brassring/i,
      /jobvite/i,
    ];

    return externalPatterns.some((p) => p.test(url));
  }
}
