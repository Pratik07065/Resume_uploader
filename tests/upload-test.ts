// ──────────────────────────────────────────────────────────────
// tests/upload-test.ts — Manual integration test
// ──────────────────────────────────────────────────────────────
//
// Usage:
//   npx tsx tests/upload-test.ts [optional-url]
//
// Exercises:
//   1. Health check
//   2. Resume status
//   3. Test upload against a target URL
// ──────────────────────────────────────────────────────────────

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3100";
const TARGET_URL =
  process.argv[2] ?? "https://www.naukri.com/";

interface JsonResponse {
  [key: string]: unknown;
}

async function request(
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>
): Promise<{ status: number; data: JsonResponse }> {
  const url = `${BASE_URL}${path}`;
  console.log(`\n→ ${method} ${url}`);

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = (await res.json()) as JsonResponse;
  console.log(`  Status: ${res.status}`);
  console.log(`  Response:`, JSON.stringify(data, null, 2));

  return { status: res.status, data };
}

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   Resume Bridge — Integration Test       ║");
  console.log("╚══════════════════════════════════════════╝");

  // 1. Health
  console.log("\n── Health Check ──────────────────────────");
  const health = await request("GET", "/api/health");

  if (health.data.status !== "ok") {
    console.error("✗ Health check failed");
    process.exit(1);
  }
  console.log("✓ Service is healthy");

  // 2. Resume status
  console.log("\n── Resume Status ─────────────────────────");
  const resume = await request("GET", "/api/resume/status");

  if (!resume.data.available) {
    console.error(
      "✗ Resume not available. Place the PDF at the configured RESUME_PATH."
    );
    process.exit(1);
  }
  console.log(
    `✓ Resume available: ${resume.data.filename} (${resume.data.sizeBytes} bytes)`
  );

  // 3. Test upload
  console.log("\n── Test Upload ───────────────────────────");
  console.log(`  Target: ${TARGET_URL}`);

  const upload = await request("POST", "/api/application/test-upload", {
    url: TARGET_URL,
  });

  if (upload.data.success) {
    console.log(`✓ Upload succeeded: ${upload.data.filename}`);
    console.log(`  Submitted: ${upload.data.submitted}`);
  } else {
    console.log(`✗ Upload failed: ${upload.data.reason}`);
  }

  console.log("\n── Done ──────────────────────────────────\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
