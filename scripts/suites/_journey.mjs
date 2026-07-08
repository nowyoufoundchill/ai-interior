import { BASE_URL } from "./_lib.mjs";

/**
 * Shared minimal state-builder used by Suite 4 (assets/responsive) and
 * Suite 5 (design review), both of which need a room with real diagnosis /
 * concepts / a locked concept / products / a render to screenshot and check
 * — but, unlike Suite 2, don't need to assert each step along the way.
 * Kept separate from Suite 2's own richer, assertion-laden walk so a
 * behavioral regression only needs fixing in one place.
 */
export async function buildFullJourney(page, roomId) {
  await page.goto(`${BASE_URL}/rooms/${roomId}`, { waitUntil: "networkidle" });

  await page.getByTestId("tab-diagnosis").click();
  await page.getByTestId("diagnosis-generate-button").click();
  await page.waitForResponse((res) => res.url().includes("/analyze") && res.request().method() === "POST");
  await page.waitForLoadState("networkidle");

  await page.getByTestId("tab-concepts").click();
  await page.getByTestId("concepts-generate-button").click();
  await page.waitForResponse((res) => res.url().includes("/generate-moodboards") && res.request().method() === "POST");
  await page.waitForLoadState("networkidle");

  const firstCard = page.locator('[data-testid^="concept-card-"]').first();
  const testId = await firstCard.getAttribute("data-testid");
  const key = testId.slice("concept-card-".length);
  await firstCard.getByTestId(`concept-lock-button-${key}`).click();
  await page.waitForResponse((res) => res.url().includes("/select-moodboard") && res.request().method() === "POST");
  await page.waitForLoadState("networkidle");

  await page.getByTestId("tab-products").click();
  await page.getByTestId("products-generate-button").click();
  await page.waitForResponse((res) => res.url().includes("/source-products") && res.request().method() === "POST");
  await page.waitForLoadState("networkidle");

  await page.getByTestId("tab-renders").click();
  await page.getByTestId("render-instructions-input").fill("Warm the space, add texture.");
  await page.getByTestId("render-generate-button").click();
  await page.waitForResponse((res) => res.url().includes("/generate-render") && res.request().method() === "POST");
  await page.waitForLoadState("networkidle");

  return { lockedConceptKey: key };
}
