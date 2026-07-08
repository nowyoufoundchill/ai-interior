import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { BASE_URL, getRoomState, readCurrentTestRun, waitForServer } from "./_lib.mjs";
import { buildFullJourney } from "./_journey.mjs";

/**
 * PRD v3 §12.1 Suite 5 — Design brain & feel, capture phase. Screenshots
 * every screen and interaction state (hover, empty, stale, locked) at
 * 390/768/1440px, and dumps one full diagnosis + concept set as text for
 * specificity review.
 *
 * This script only captures — the actual scoring against the §3/§11 rubric
 * must be done by a fresh-context reviewer agent (never the agent that
 * wrote the code, per the PRD's two-agent pattern), which is a judgment
 * call a script cannot make. After running this, a fresh Agent/subagent
 * should read manifest.json, view every screenshot, score 1-10 per screen,
 * and the orchestrating session writes the result to
 * test-runs/suite-results/design-review.json in the same shape SuiteReporter
 * produces for the other suites.
 *
 * Known deviation: no draggable before/after slider exists (see
 * assets-responsive.mjs docstring), so no "mid-drag slider" state is
 * captured; the Before/After side-by-side state is captured instead.
 */

const WIDTHS = [390, 768, 1440];
const SCREENSHOT_DIR = path.join(process.cwd(), "test-runs", "screenshots", "design-review");

async function main() {
  await waitForServer();
  const { roomId } = readCurrentTestRun();
  mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const manifest = [];

  try {
    // --- Empty states, all widths --------------------------------------------
    await page.goto(`${BASE_URL}/rooms/${roomId}`, { waitUntil: "networkidle" });
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      for (const [tabTestId, state] of [
        ["tab-diagnosis", "empty-diagnosis"],
        ["tab-concepts", "empty-concepts"],
        ["tab-products", "empty-products"],
        ["tab-renders", "empty-renders"],
        ["tab-chat", "empty-chat"]
      ]) {
        await page.getByTestId(tabTestId).click();
        await page.waitForLoadState("networkidle");
        await capture(page, manifest, { width, tab: tabTestId, state });
      }
    }

    // --- Build the full journey, capture populated + locked states -----------
    await page.setViewportSize({ width: 1440, height: 900 });
    await buildFullJourney(page, roomId);

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      for (const [tabTestId, state] of [
        ["tab-diagnosis", "populated-diagnosis"],
        ["tab-concepts", "populated-locked-concepts"],
        ["tab-products", "populated-products"],
        ["tab-renders", "populated-before-after"],
        ["tab-chat", "populated-chat"]
      ]) {
        await page.getByTestId(tabTestId).click();
        await page.waitForLoadState("networkidle");
        await capture(page, manifest, { width, tab: tabTestId, state });
      }
    }

    // --- Hover state on a concept card ----------------------------------------
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByTestId("tab-concepts").click();
    await page.waitForLoadState("networkidle");
    const firstConceptCard = page.locator('[data-testid^="concept-card-"]').first();
    if (await firstConceptCard.count()) {
      await firstConceptCard.hover();
      await capture(page, manifest, { width: 1440, tab: "tab-concepts", state: "hover-concept-card" });
    }

    // --- Stale state: rerun diagnosis so the locked concept set goes stale ---
    await page.getByTestId("tab-diagnosis").click();
    await page.waitForLoadState("networkidle");
    await page.getByTestId("diagnosis-generate-button").click();
    await page.waitForResponse((res) => res.url().includes("/analyze") && res.request().method() === "POST");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("tab-concepts").click();
    await page.waitForLoadState("networkidle");
    await capture(page, manifest, { width: 1440, tab: "tab-concepts", state: "stale-concepts-after-diagnosis-rerun" });

    // --- Dump the room state snapshot for cross-reference; the actual
    // diagnosis/concept text specificity read happens from the populated-*
    // screenshots above, which render the full field content in the UI. ---
    const state = await getRoomState(roomId);
    writeFileSync(path.join(SCREENSHOT_DIR, "state-snapshot.json"), JSON.stringify(state, null, 2));

    writeFileSync(path.join(SCREENSHOT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
    console.log(`[design-review] captured ${manifest.length} screenshots to ${SCREENSHOT_DIR}`);
    console.log("[design-review] Next: spawn a fresh-context reviewer agent to score manifest.json entries against PRD v3 §3/§11.");
  } finally {
    await browser.close();
  }
}

async function capture(page, manifest, { width, tab, state }) {
  const filename = `${width}-${tab}-${state}.png`;
  const filePath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: filePath, fullPage: true });
  manifest.push({ file: filename, width, tab, state });
}

main().catch((error) => {
  console.error("[design-review] FAILED:", error);
  process.exitCode = 1;
});
