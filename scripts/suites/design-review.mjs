import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { loadTestEnv } from "../test-env.mjs";
import { BASE_URL, clickTabAndWait, getRoomState, readCurrentTestRun, waitForAtLeast, waitForServer, requireServerIsolation } from "./_lib.mjs";
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
  await requireServerIsolation();
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
        ["tab-photos-brief", "empty-room-read"],
        ["tab-concepts", "empty-concepts"],
        ["tab-products", "empty-products"],
        ["tab-renders", "empty-renders"],
        ["tab-chat", "empty-chat"]
      ]) {
        await clickTabAndWait(page, tabTestId);
        await capture(page, manifest, { width, tab: tabTestId, state });
      }
    }

    // --- Build the full journey, capture populated + locked states -----------
    await page.setViewportSize({ width: 1440, height: 900 });
    await buildFullJourney(page, roomId);

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      for (const [tabTestId, state] of [
        ["tab-photos-brief", "populated-room-read"],
        ["tab-concepts", "populated-locked-concepts"],
        ["tab-products", "populated-products"],
        ["tab-renders", "populated-before-after"],
        ["tab-chat", "populated-chat"]
      ]) {
        await clickTabAndWait(page, tabTestId);
        await capture(page, manifest, { width, tab: tabTestId, state });
      }
    }

    // --- Hover state on a concept card ----------------------------------------
    await page.setViewportSize({ width: 1440, height: 900 });
    await clickTabAndWait(page, "tab-concepts");
    const firstConceptCard = page.locator('[data-testid^="concept-card-"]').first();
    if (await firstConceptCard.count()) {
      await firstConceptCard.hover();
      await capture(page, manifest, { width: 1440, tab: "tab-concepts", state: "hover-concept-card" });
    }

    // --- Stale state: rerun diagnosis so the locked concept set goes stale ---
    await clickTabAndWait(page, "tab-photos-brief");
    await page.getByTestId("diagnosis-generate-button").click();
    await page.waitForResponse((res) => res.url().includes("/analyze") && res.request().method() === "POST");
    await page.waitForLoadState("networkidle");
    await clickTabAndWait(page, "tab-concepts");
    // "networkidle" after the diagnosis POST can resolve before React
    // commits the refreshed mood_boards data — wait for the actual "stale"
    // badge text (StatusBadge renders the raw status string) before
    // capturing, not just for the tab panel to exist.
    await waitForAtLeast(page.getByText("stale", { exact: false }), 1, { timeoutMs: 8000 });
    await capture(page, manifest, { width: 1440, tab: "tab-concepts", state: "stale-concepts-after-diagnosis-rerun" });

    // --- Dump the room state snapshot plus full diagnosis/concept text, so
    // the reviewer can judge specificity (PRD v3 §11: "references this
    // room's features and dimensions, no generic advice") directly from
    // structured text as well as from the populated-* screenshots. --------
    const state = await getRoomState(roomId);
    writeFileSync(path.join(SCREENSHOT_DIR, "state-snapshot.json"), JSON.stringify(state, null, 2));
    writeFileSync(path.join(SCREENSHOT_DIR, "full-content.json"), JSON.stringify(await dumpFullContent(roomId), null, 2));

    writeFileSync(path.join(SCREENSHOT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
    console.log(`[design-review] captured ${manifest.length} screenshots to ${SCREENSHOT_DIR}`);
    console.log("[design-review] Next: spawn a fresh-context reviewer agent to score manifest.json entries against PRD v3 §3/§11.");
  } finally {
    await browser.close();
  }
}

async function dumpFullContent(roomId) {
  loadTestEnv();
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: room } = await supabase.from("rooms").select("*").eq("id", roomId).single();
  const { data: diagnosis } = await supabase
    .from("room_analyses")
    .select("*")
    .eq("room_id", roomId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: concepts } = await supabase.from("mood_boards").select("*").eq("room_id", roomId).order("version", { ascending: true });

  return {
    room: { name: room.name, room_type: room.room_type, dimensions: room.dimensions, design_brief: room.design_brief },
    diagnosis: diagnosis?.analysis ?? null,
    concepts: (concepts ?? []).map((c) => ({ version: c.version, status: c.status, concept_name: c.concept_name, concept_data: c.concept_data }))
  };
}

async function capture(page, manifest, { width, tab, state }) {
  const filename = `${width}-${tab}-${state}.png`;
  const filePath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({
    path: filePath,
    fullPage: true,
    style: `
      nextjs-portal,
      [data-nextjs-dev-tools-button],
      [data-nextjs-toast],
      [data-nextjs-dialog-overlay],
      [aria-label*="Next.js"],
      [aria-label*="Next.js Dev"] {
        display: none !important;
        visibility: hidden !important;
      }
    `
  });
  manifest.push({ file: filename, width, tab, state });
}

main().catch((error) => {
  console.error("[design-review] FAILED:", error);
  process.exitCode = 1;
});
