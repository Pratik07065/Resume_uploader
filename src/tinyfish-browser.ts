// ──────────────────────────────────────────────────────────────
// tinyfish-browser.ts — TinyFish Browser API + Playwright/CDP
// ──────────────────────────────────────────────────────────────

import { chromium, type Browser, type Page } from "playwright";
import { config } from "./config";
import { logger } from "./logger";

// ── Types ────────────────────────────────────────────────────

export interface BrowserSession {
  sessionId: string;
  cdpUrl: string;
}

export interface TinyfishSessionResponse {
  id: string;
  cdp_url: string;
  status: string;
  profile_id?: string;
}

// ── TinyFishBrowser ──────────────────────────────────────────

export class TinyFishBrowser {
  private browser: Browser | null = null;
  private session: BrowserSession | null = null;
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly profileId: string;

  constructor() {
    this.apiUrl = config.tinyfishApiUrl;
    this.apiKey = config.tinyfishApiKey;
    this.profileId = config.tinyfishProfileId;
  }

  // ── Public API ───────────────────────────────────────────

  /**
   * Create or connect to a TinyFish Browser session and
   * return a Playwright Page connected over CDP.
   */
  async connect(): Promise<Page> {
    if (!this.apiKey) {
      throw new Error(
        "TINYFISH_API_KEY is not set. Add it to your .env file."
      );
    }

    // 1. Create / retrieve session
    this.session = await this.createSession();

    logger.info(
      { component: "BROWSER", sessionId: this.session.sessionId },
      "TinyFish session created"
    );

    // 2. Connect Playwright via CDP
    this.browser = await chromium.connectOverCDP(this.session.cdpUrl, {
      timeout: 30_000,
    });

    logger.info({ component: "BROWSER" }, "Connected through CDP");

    // 3. Get active page or open new one
    const contexts = this.browser.contexts();
    let page: Page;

    if (contexts.length > 0 && contexts[0].pages().length > 0) {
      page = contexts[0].pages()[0];
    } else {
      const ctx =
        contexts.length > 0
          ? contexts[0]
          : await this.browser.newContext();
      page = await ctx.newPage();
    }

    return page;
  }

  /** Navigate to a URL and wait for the page to stabilise. */
  async navigateTo(page: Page, url: string): Promise<void> {
    logger.info(
      { component: "BROWSER", url },
      "Navigating to target URL"
    );

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    // Extra settle time for SPAs
    await page.waitForTimeout(2_000);

    logger.info({ component: "BROWSER" }, "Page loaded");
  }

  /** Disconnect Playwright (does NOT terminate the TinyFish session). */
  async disconnect(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // Browser may already be disconnected
      }
      this.browser = null;
    }
    logger.info({ component: "BROWSER" }, "Playwright disconnected");
  }

  /** Get the current session info (safe — no secrets). */
  getSessionInfo(): { sessionId: string } | null {
    return this.session
      ? { sessionId: this.session.sessionId }
      : null;
  }

  // ── Internals ────────────────────────────────────────────

  /** Create a browser session via the TinyFish REST API. */
  private async createSession(): Promise<BrowserSession> {
    const url = `${this.apiUrl}/v1/sessions`;

    const body = {
      profile_id: this.profileId,
    };

    logger.debug(
      { component: "BROWSER", profileId: this.profileId },
      "Requesting TinyFish session"
    );

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `TinyFish API error (${response.status}): ${text}`
      );
    }

    const data = (await response.json()) as TinyfishSessionResponse;

    if (!data.cdp_url) {
      throw new Error(
        "TinyFish session response missing cdp_url. Cannot connect via CDP."
      );
    }

    return {
      sessionId: data.id,
      cdpUrl: data.cdp_url,
    };
  }
}
