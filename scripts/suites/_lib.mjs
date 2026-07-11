import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { describeTestEnv } from "../test-env.mjs";

export const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

/**
 * P0.0 preflight for every mutation-capable suite. Aborts before the suite's
 * first write unless a supported mode applies AND the suite, the seeded
 * rows, and the RUNNING SERVER all point at the same Supabase project:
 *
 *  - ISOLATED: .env.test points at a dedicated test project.
 *  - PRODUCTION: owner-acknowledged in test-isolation.config.json (owner
 *    decision 2026-07-10 — no separate test project). Tagging + teardown +
 *    the residue check are the mandatory safety regime in this mode.
 *
 * The server check (GET /api/debug/env-fingerprint) is what prevents a
 * suite from driving a server that writes somewhere other than where the
 * seed lives. Fingerprints are SHA-256 prefixes of the project ref — no
 * credentials.
 */
export async function requireServerIsolation() {
  const env = describeTestEnv();
  if (env.mode === "blocked") {
    throw new Error(
      "FAIL CLOSED: no isolated test project and no owner-acknowledged production mode " +
        "(test-isolation.config.json). Mutation suites refuse to run — see docs/TEST_PROJECT_SETUP.md."
    );
  }

  const run = readCurrentTestRun();
  if (!run.supabaseProjectFingerprint) {
    throw new Error(
      "FAIL CLOSED: test-runs/current.json has no supabaseProjectFingerprint — reseed with " +
        "`npm run seed:test` (older seeds predate the P0.0 isolation contract)."
    );
  }
  if (run.supabaseProjectFingerprint !== env.activeFingerprint) {
    throw new Error(
      `FAIL CLOSED: seeded rows live in project ${run.supabaseProjectFingerprint} but the active ` +
        `test mode (${env.mode}) resolves to ${env.activeFingerprint}. Reseed with \`npm run seed:test\`.`
    );
  }

  const response = await fetch(`${BASE_URL}/api/debug/env-fingerprint`);
  if (!response.ok) {
    throw new Error(
      `FAIL CLOSED: could not verify the running server's Supabase project ` +
        `(GET /api/debug/env-fingerprint returned ${response.status}).`
    );
  }
  const server = await response.json();
  if (server.supabase_project_fingerprint !== env.activeFingerprint) {
    throw new Error(
      `FAIL CLOSED: the running server at ${BASE_URL} writes to project ` +
        `${server.supabase_project_fingerprint}, but the seed lives in ${env.activeFingerprint}. ` +
        `Start the server against the same project (npm run dev:test).`
    );
  }

  if (env.mode === "production") {
    console.warn(
      `[isolation] PRODUCTION mode (owner-acknowledged): suite, seed, and server all on production ` +
        `project ${env.activeFingerprint}. Teardown + check:residue are failing gates for this cycle.`
    );
  } else {
    console.log(`[isolation] verified: suite, seed, and server all on test project ${env.activeFingerprint}.`);
  }
  return { mode: env.mode, serverAiMode: server.ai_mode, activeFingerprint: env.activeFingerprint };
}

/**
 * Every suite assumes `npm run seed:test` has already produced
 * test-runs/current.json for this cycle (PRD v3 §12.4 cycle discipline: a
 * fresh seed precedes every suite run, never dirty state).
 */
export function readCurrentTestRun() {
  const statePath = path.join(process.cwd(), "test-runs", "current.json");
  if (!existsSync(statePath)) {
    throw new Error("No test-runs/current.json found. Run `npm run seed:test` before any suite.");
  }
  return JSON.parse(readFileSync(statePath, "utf-8"));
}

export async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) }
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, ok: response.ok, body };
}

export async function getRoomState(roomId) {
  const { ok, status, body } = await fetchJson(`${BASE_URL}/api/debug/room-state/${roomId}`);
  if (!ok) throw new Error(`debug/room-state failed (${status}): ${JSON.stringify(body)}`);
  return body;
}

/**
 * Minimal shared reporter so every suite prints the same pass/fail shape and
 * writes a machine-readable result the release report / cycle runner can
 * aggregate across suites without re-parsing console output.
 */
export class SuiteReporter {
  constructor(name) {
    this.name = name;
    this.checks = [];
    this.startedAt = Date.now();
  }

  assert(condition, description, detail) {
    const passed = Boolean(condition);
    this.checks.push({ description, passed, detail: passed ? undefined : detail });
    console.log(`${passed ? "PASS" : "FAIL"} - ${description}${passed ? "" : ` :: ${JSON.stringify(detail)}`}`);
    return passed;
  }

  get failed() {
    return this.checks.filter((check) => !check.passed);
  }

  finish() {
    const durationMs = Date.now() - this.startedAt;
    const result = {
      suite: this.name,
      ranAt: new Date().toISOString(),
      durationMs,
      total: this.checks.length,
      passed: this.checks.length - this.failed.length,
      failed: this.failed.length,
      checks: this.checks
    };

    const dir = path.join(process.cwd(), "test-runs", "suite-results");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, `${this.name}.json`), JSON.stringify(result, null, 2));

    console.log(
      `\n[${this.name}] ${result.passed}/${result.total} passed in ${durationMs}ms` +
        (result.failed ? ` — ${result.failed} FAILED` : "")
    );

    if (result.failed > 0) {
      process.exitCode = 1;
    }
    return result;
  }
}

/**
 * Playwright's `locator.count()` is a point-in-time DOM snapshot with no
 * auto-retry (unlike `expect(locator)` matchers from @playwright/test's
 * runner, which these standalone scripts don't use). After a click that
 * triggers `router.refresh()`, the RSC response can land (and
 * `waitForLoadState("networkidle")` can resolve) slightly before React
 * commits the new props to the DOM. Poll instead of snapshotting once.
 */
export async function waitForCount(locator, expectedCount, { timeoutMs = 8000, intervalMs = 150 } = {}) {
  const start = Date.now();
  let last = -1;
  while (Date.now() - start < timeoutMs) {
    last = await locator.count();
    if (last === expectedCount) return last;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return last;
}

export async function waitForAtLeast(locator, minCount, { timeoutMs = 8000, intervalMs = 150 } = {}) {
  const start = Date.now();
  let last = -1;
  while (Date.now() - start < timeoutMs) {
    last = await locator.count();
    if (last >= minCount) return last;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return last;
}

// A tab click swaps `activeTab` client state with no network request at
// all, so `waitForLoadState("networkidle")` is not a real synchronization
// point for it (there's nothing in flight to wait on) — screenshotting
// right after such a click can race React's re-render and capture the
// PREVIOUS panel's content under the NEWLY-active tab's highlight, or vice
// versa. Each tab has one element that only exists on its own panel; wait
// for that instead of trusting "networkidle".
const TAB_PANEL_MARKER = {
  "tab-photos-brief": "photo-upload-input",
  "tab-concepts": "concepts-generate-button",
  "tab-products": "products-generate-button",
  "tab-renders": "render-generate-button",
  "tab-chat": "chat-message-input"
};

export async function clickTabAndWait(page, tabTestId, { timeoutMs = 8000 } = {}) {
  await page.getByTestId(tabTestId).click();
  const marker = TAB_PANEL_MARKER[tabTestId];
  if (marker) {
    await page.getByTestId(marker).waitFor({ state: "visible", timeout: timeoutMs });
  }
  await page.waitForLoadState("networkidle");
  // The tab button's active-state background uses a CSS `transition`
  // (~150-300ms). Content/state is already correct by this point, but a
  // screenshot fired immediately can still catch the highlight mid-fade
  // between the previous and newly active tab. Let it settle.
  await page.waitForTimeout(300);
}

export async function waitForServer(url = BASE_URL, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return true;
    } catch {
      // server not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms.`);
}
