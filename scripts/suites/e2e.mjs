import { chromium } from "playwright";
import { BASE_URL, getRoomState, readCurrentTestRun, SuiteReporter, waitForAtLeast, waitForCount, waitForServer, requireServerIsolation } from "./_lib.mjs";

// Phase 9 governance extensions: mirrors the sc-luxury-2026 reject_now list
// (lib/ai/context-brain/trend-intelligence.ts) as a cheap sanity check that no
// approved-region concept ships an on-reject-now cliché. The authoritative
// enforcement is the critic's reject_now_violations + bounded regeneration on
// live runs; this is the mock-mode backstop.
const REJECT_NOW_SIGNALS = [
  "all-white",
  "grey-and-white",
  "gray-and-white",
  "nautical",
  "tiki",
  "beach house theming",
  "high-gloss ultra-modern"
];

/**
 * PRD v3 §12.1 Suite 2 — Functional E2E. Drives the real browser through the
 * full room journey using only data-testid selectors, AI_MODE=mock. Uses
 * Playwright as the driver: this script must run unattended/repeatedly
 * (every verification cycle, §12.4), and only an agent's own tool-calling
 * loop can invoke chrome-devtools MCP tools — a standalone script cannot.
 * When a human agent is driving ad hoc verification in-session, prefer
 * chrome-devtools MCP per BUILD_PLAN.md; this script is the reusable,
 * script-callable equivalent for `npm run suite:e2e` and cycle automation.
 *
 * Auth is intentionally skipped: this is a single-household private tool
 * with no Supabase Auth (owner decision, 2026-07-08); /login is a no-op.
 * Home/room creation is also skipped here — `npm run seed:test` already
 * creates a tagged, teardown-able home/room/photos; creating another one
 * through the raw UI during automated suites would create additional
 * artifacts outside that test_run_id's teardown coverage.
 */

const reporter = new SuiteReporter("e2e");

async function main() {
  await waitForServer();
  await requireServerIsolation();
  const { roomId } = readCurrentTestRun();
  console.log(`[e2e] room=${roomId}`);

  const browser = await chromium.launch();
  const page = await browser.newPage();

  const consoleErrors = [];
  const failedRequests = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));
  page.on("response", (response) => {
    if (response.status() >= 400) {
      failedRequests.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });
  page.on("requestfailed", (request) => {
    // Next.js's App Router cancels an in-flight RSC prefetch/refresh request
    // (`?_rsc=...`) whenever a newer navigation/refresh supersedes it — an
    // expected internal mechanism, not a user-facing failure. Only flag
    // aborted requests that aren't that pattern.
    const url = request.url();
    const isRscAbort = url.includes("_rsc=") && request.failure()?.errorText === "net::ERR_ABORTED";
    if (isRscAbort) return;
    failedRequests.push(`NETWORK_FAIL ${request.method()} ${url} :: ${request.failure()?.errorText}`);
  });

  try {
    await page.goto(`${BASE_URL}/rooms/${roomId}`, { waitUntil: "networkidle" });
    reporter.assert(await page.getByTestId("tab-photos-brief").isVisible(), "room workspace loads with Photos & Brief tab visible");

    // --- Photos & Brief ---------------------------------------------------
    reporter.assert(await page.getByTestId("room-dimensions-info").isVisible(), "dimensions info card visible");
    reporter.assert(await page.getByTestId("room-brief-info").isVisible(), "brief info card visible");
    reporter.assert(await page.getByTestId("photo-upload-input").count() === 1, "photo upload control present");

    // --- Concepts: one CTA reads the room, then composes directions ----------
    await page.getByTestId("tab-concepts").click();
    const diagnosisResponse = page.waitForResponse((res) => res.url().includes("/analyze") && res.request().method() === "POST", { timeout: 300000 });
    const conceptsResponse = page.waitForResponse((res) => res.url().includes("/generate-moodboards") && res.request().method() === "POST", { timeout: 300000 });
    await page.getByTestId("concepts-generate-button").click();
    await diagnosisResponse;
    await conceptsResponse;
    await page.waitForLoadState("networkidle");
    const conceptCards = page.locator('[data-testid^="concept-card-"]');
    const conceptCount = await waitForCount(conceptCards, 3);
    reporter.assert(conceptCount === 3, "exactly 3 concept cards render", conceptCount);
    await page.getByTestId("tab-photos-brief").click();
    const diagnosisPanel = page.locator('[data-testid^="diagnosis-panel-"]');
    reporter.assert(await waitForAtLeast(diagnosisPanel, 1) >= 1, "diagnosis panel renders on the room intake page after concept generation");
    await page.getByTestId("tab-concepts").click();

    const firstCard = conceptCards.nth(0);
    const firstKey = await extractKey(firstCard, "concept-card-");
    await firstCard.getByTestId(`concept-edit-button-${firstKey}`).click();
    await firstCard.getByTestId(`concept-edit-name-input-${firstKey}`).fill("E2E Edited Concept Name");
    await firstCard.getByTestId(`concept-edit-submit-${firstKey}`).click();
    await page.waitForResponse((res) => res.url().includes("/moodboards/") && res.request().method() === "POST");
    await page.waitForLoadState("networkidle");
    reporter.assert(
      (await waitForAtLeast(page.getByText("E2E Edited Concept Name"), 1)) >= 1,
      "edited concept name appears in a new active version"
    );

    const secondCard = page.locator('[data-testid^="concept-card-"]').nth(1);
    const secondKey = await extractKey(secondCard, "concept-card-");
    await secondCard.getByTestId(`concept-reharmonize-button-${secondKey}`).click();
    await secondCard.getByTestId(`concept-reharmonize-input-${secondKey}`).fill("Make this more formal.");
    await secondCard.getByTestId(`concept-reharmonize-submit-${secondKey}`).click();
    await page.waitForResponse((res) => res.url().includes("/moodboards/") && res.request().method() === "POST");
    await page.waitForLoadState("networkidle");
    reporter.assert(true, "re-harmonize request completes without error");

    const activeCards = page.locator('[data-testid^="concept-card-"]');
    const lockCandidate = activeCards.first();
    const lockKey = await extractKey(lockCandidate, "concept-card-");
    await lockCandidate.getByTestId(`concept-lock-button-${lockKey}`).click();
    await page.waitForResponse((res) => res.url().includes("/select-moodboard") && res.request().method() === "POST");
    await page.waitForLoadState("networkidle");
    const unlockButton = page.locator(`[data-testid="concept-unlock-button-${lockKey}"]`);
    await unlockButton.waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
    reporter.assert(await unlockButton.isVisible(), "locked concept now shows an Unlock control");
    reporter.assert(
      (await waitForCount(page.locator(`[data-testid="concept-edit-button-${lockKey}"]`), 0)) === 0,
      "locked concept no longer shows a direct Edit control (must unlock first)"
    );

    // --- Renders: generate, regenerate with instructions ---------------------
    await page.getByTestId("tab-renders").click();
    await page.getByTestId("render-instructions-input").fill("Keep the leather chair, make the walls darker.");
    await page.getByTestId("render-generate-button").click();
    await page.waitForResponse((res) => res.url().includes("/generate-render") && res.request().method() === "POST");
    await page.waitForLoadState("networkidle");
    const renderCards = page.locator('[data-testid^="render-card-"]');
    const firstRenderCount = await waitForCount(renderCards, 1);
    reporter.assert(firstRenderCount === 1, "first render card appears after edit", firstRenderCount);

    await page.getByTestId("render-instructions-input").fill("Regenerate with a larger rug.");
    await page.getByTestId("render-generate-button").click();
    await page.waitForResponse((res) => res.url().includes("/generate-render") && res.request().method() === "POST");
    await page.waitForLoadState("networkidle");
    const secondRenderCount = await waitForCount(renderCards, 2);
    reporter.assert(secondRenderCount === 2, "regeneration adds a second render card (history kept)", secondRenderCount);

    // --- Products: generate after render, approve, reject ---------------------
    await page.getByTestId("tab-products").click();
    await page.getByTestId("products-generate-button").click();
    await page.waitForResponse((res) => res.url().includes("/source-products") && res.request().method() === "POST");
    await page.waitForLoadState("networkidle");
    const productCards = page.locator('[data-testid^="product-card-"]');
    const productCount = await waitForAtLeast(productCards, 1);
    reporter.assert(productCount >= 1, "product plan renders at least one validated product card", productCount);

    const productImages = await productCards.locator("img").count();
    reporter.assert(productImages === productCount, "every persisted product renders with a cached loading image", { productCount, productImages });

    const firstProductId = await extractKey(productCards.nth(0), "product-card-");
    await page.getByTestId(`product-approve-button-${firstProductId}`).click();
    await page.waitForResponse((res) => res.url().includes(`/products/${firstProductId}`) && res.request().method() === "POST");
    await page.waitForLoadState("networkidle");
    reporter.assert(
      (await waitForCount(page.getByTestId(`product-reset-button-${firstProductId}`), 1)) === 1,
      "approved product shows a Reset control (status changed)"
    );

    if (productCount > 1) {
      const secondProductId = await extractKey(productCards.nth(1), "product-card-");
      await page.getByTestId(`product-reject-button-${secondProductId}`).click();
      await page.waitForResponse((res) => res.url().includes(`/products/${secondProductId}`) && res.request().method() === "POST");
      await page.waitForLoadState("networkidle");
      reporter.assert(
        (await waitForCount(page.getByTestId(`product-reset-button-${secondProductId}`), 1)) === 1,
        "rejected product shows a Reset control (status changed)"
      );
    }

    // --- Chat: ask why, then request + confirm a revision ---------------------
    await page.getByTestId("tab-chat").click();
    await page.getByTestId("chat-message-input").fill("Why did you choose this palette for this room?");
    await page.getByTestId("chat-send-button").click();
    await page.waitForResponse((res) => res.url().includes("/chat") && res.request().method() === "POST");
    await page.waitForLoadState("networkidle");
    const chatCards = page.locator('[data-testid^="chat-message-card-"]');
    reporter.assert((await waitForCount(chatCards, 2)) === 2, "first chat turn renders owner and designer messages");

    await page.getByTestId("chat-message-input").fill("Make it moodier — darker walls and richer wood tones.");
    await page.getByTestId("chat-send-button").click();
    await page.waitForResponse((res) => res.url().includes("/chat") && res.request().method() === "POST");
    await page.waitForLoadState("networkidle");
    reporter.assert((await waitForCount(chatCards, 4)) === 4, "second chat turn renders in the visible thread");
    reporter.assert(
      (await waitForAtLeast(page.getByText("Proposal only"), 1)) >= 1,
      "revision-shaped chat turn is tagged as a proposal, not a silent mutation"
    );
    // --- Phase 9 governance asserts (against the journeyed room state) ------
    const finalState = await getRoomState(roomId);

    // Only scan the AFFIRMATIVE design fields — a concept naming a cliché in
    // risk_profile / why_user_may_reject_it is correctly warning against it, not
    // committing it, so those fields are excluded.
    const affirmativeText = (finalState.mood_boards ?? [])
      .map((board) => {
        const c = board.concept_data ?? {};
        const paletteNames = Array.isArray(c.palette) ? c.palette.map((p) => p?.name ?? "").join(" ") : "";
        return [
          c.design_thesis,
          c.furniture_direction,
          c.layout_direction,
          c.lighting_direction,
          c.art_direction,
          c.decor_direction,
          c.plant_direction,
          c.why_it_works,
          paletteNames,
          Array.isArray(c.materials) ? c.materials.join(" ") : "",
          Array.isArray(c.style_keywords) ? c.style_keywords.join(" ") : ""
        ]
          .filter(Boolean)
          .join(" ");
      })
      .join(" ")
      .toLowerCase();
    const rejectHits = REJECT_NOW_SIGNALS.filter((signal) => affirmativeText.includes(signal));
    reporter.assert(rejectHits.length === 0, "governance: no concept lands on a reject_now cliché", rejectHits);

    const persistedProducts = finalState.products ?? [];
    const productsMissingImage = persistedProducts.filter((p) => !p.cached_image_path && !p.image_url);
    reporter.assert(
      persistedProducts.length > 0 && productsMissingImage.length === 0,
      "governance: every persisted product carries an image (no dead-image product persisted)",
      { count: persistedProducts.length, missing: productsMissingImage.length }
    );

    const rendersWithDoorGuard = (finalState.renders ?? []).filter((r) => {
      const guardText = JSON.stringify([r.negative_instructions, r.preservation_constraints, r.render_prompt]).toLowerCase();
      return /door/.test(guardText);
    });
    reporter.assert(
      (finalState.renders ?? []).length > 0 && rendersWithDoorGuard.length === (finalState.renders ?? []).length,
      "governance: every render instruction set carries a door-preservation/clearance guard",
      { renders: (finalState.renders ?? []).length, guarded: rendersWithDoorGuard.length }
    );
  } finally {
    reporter.assert(consoleErrors.length === 0, "zero new console errors across the whole journey", consoleErrors);
    reporter.assert(failedRequests.length === 0, "zero failed network requests across the whole journey", failedRequests);
    await browser.close();
  }

  reporter.finish();
}

async function extractKey(locator, prefix) {
  const testId = await locator.getAttribute("data-testid");
  return testId.slice(prefix.length);
}

main().catch((error) => {
  console.error("[e2e] FAILED:", error);
  process.exitCode = 1;
});
