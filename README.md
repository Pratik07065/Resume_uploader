# Resume Bridge

> Securely uploads a local resume into browser application forms via TinyFish Browser + Playwright/CDP.
> Part of the **Pratik Job Agent** pipeline.

```
Pratik Job Agent / GPT Plugin
        ↓ HTTPS
Resume Bridge API          ← this service
        ↓
TinyFish Browser API
        ↓
TinyFish Browser session / CDP
        ↓
Playwright
        ↓
Naukri or supported ATS
        ↓
HTML file input
        ↓
PRATIK_PAWAR_RESUME.pdf
```

---

## Quick Start

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# → set TINYFISH_API_KEY

# 3. Place your resume
cp /path/to/PRATIK_PAWAR_RESUME.pdf ./resumes/

# 4. Run
npm run dev
```

The server starts on **http://localhost:3100** by default.

---

## API Endpoints

### `GET /api/health`

Health check.

```json
{ "status": "ok", "service": "resume-bridge", "timestamp": "..." }
```

### `GET /api/resume/status`

Resume metadata (never exposes the file).

```json
{
  "available": true,
  "filename": "PRATIK_PAWAR_RESUME.pdf",
  "type": "application/pdf",
  "sizeBytes": 123456
}
```

### `POST /api/application/test-upload`

Opens a URL, finds the file input, uploads the resume.
**Does NOT submit the form.**

```json
// Request
{ "url": "https://www.naukri.com/..." }

// Response
{
  "success": true,
  "uploaded": true,
  "filename": "PRATIK_PAWAR_RESUME.pdf",
  "submitted": false
}
```

### `POST /api/application/upload-resume`

Production endpoint. Detects Naukri Easy Apply vs external ATS.
Uploads resume. **Submission is disabled in v1.**

```json
// Request
{ "url": "https://www.naukri.com/..." }

// Response
{
  "success": true,
  "uploaded": true,
  "filename": "PRATIK_PAWAR_RESUME.pdf",
  "submitted": false,
  "supported": true
}
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3100` | Server port |
| `NODE_ENV` | `development` | `development` / `production` |
| `RESUME_PATH` | `./resumes/PRATIK_PAWAR_RESUME.pdf` | Path to the resume |
| `MAX_RESUME_SIZE_MB` | `10` | Max resume file size |
| `TINYFISH_API_KEY` | *(required)* | TinyFish API key |
| `TINYFISH_API_URL` | `https://api.tinyfish.io` | TinyFish API base URL |
| `TINYFISH_PROFILE_ID` | `prof_55b631fbbddc4692` | Browser profile ID |
| `CORS_ORIGIN` | `http://localhost:3100` | Allowed CORS origin |
| `ALLOWED_DOMAINS` | `www.naukri.com,naukri.com` | Comma-separated domain allowlist |
| `LOG_LEVEL` | `info` | Pino log level |

---

## Security

- **Helmet** — secure HTTP headers
- **CORS** — configurable origin
- **Zod** — request validation
- **Domain allowlist** — only permitted domains
- **SSRF protection** — blocks private IPs
- **Protocol enforcement** — HTTPS-only in production
- **No public file hosting** — resume never leaves localhost
- **No GET endpoint for the resume** — metadata only

---

## Running Tests

```bash
# Start the server first
npm run dev

# In another terminal
npm run test:upload

# Or with a specific URL
npx tsx tests/upload-test.ts "https://www.naukri.com/..."
```

---

## Project Structure

```
src/
  server.ts              — Express entry point
  config.ts              — Zod-validated configuration
  logger.ts              — Pino structured logger
  resume-manager.ts      — Resume validation & metadata
  tinyfish-browser.ts    — TinyFish API + Playwright/CDP
  application-runner.ts  — File input detection & upload
  routes/
    health.ts            — Health & resume status
    application.ts       — Upload endpoints

resumes/
  PRATIK_PAWAR_RESUME.pdf

tests/
  upload-test.ts         — Integration test
```

---

## Supported Platforms (v1)

| Platform | Status |
|---|---|
| Naukri Easy Apply | ✅ Supported |
| External ATS (Greenhouse, Lever, etc.) | 🔒 Detected, blocked in v1 |
| Generic HTML file inputs | ✅ Upload works |

---

## License

Private — UNLICENSED
