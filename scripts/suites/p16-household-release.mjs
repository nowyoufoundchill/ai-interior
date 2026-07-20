import path from "node:path";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { loadTestEnv } from "../test-env.mjs";
import { BASE_URL, getRoomState, readCurrentTestRun, requireServerIsolation, SuiteReporter, waitForServer } from "./_lib.mjs";

const reporter = new SuiteReporter("p16-household-release");
const WIDTHS = [390, 768, 1440];

async function pollState(roomId, predicate, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  let state = null;
  while (Date.now() < deadline) {
    state = await getRoomState(roomId);
    if (predicate(state)) return state;
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  return state;
}

function operation(job) {
  return job?.request_payload && typeof job.request_payload === "object" ? job.request_payload.operation : null;
}

async function noHorizontalOverflow(page, width, label) {
  const dimensions = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  reporter.assert(dimensions.scrollWidth <= dimensions.clientWidth + 1, `${label} has no horizontal overflow at ${width}px`, dimensions);
}

async function main() {
  loadTestEnv();
  await waitForServer();
  const { serverAiMode } = await requireServerIsolation();
  if (serverAiMode !== "mock") throw new Error(`P1.6 automated household gate requires AI_MODE=mock (got ${serverAiMode}).`);
  const { homeId, testRunId } = readCurrentTestRun();
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const consoleErrors = [];
  const networkErrors = [];
  let firstDesignPosts = 0;
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/first-design")) firstDesignPosts += 1;
  });
  page.on("response", (response) => {
    if (response.status() >= 400) networkErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
  });
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText;
    const expectedNavigationAbort = request.url().includes("_rsc=") && errorText === "net::ERR_ABORTED";
    const expectedCompletedPollAbort = request.method() === "GET" && request.url().includes("/jobs/") && errorText === "net::ERR_ABORTED";
    const expectedResponsiveImageAbort = request.method() === "GET" && request.url().includes("/_next/image?") && errorText === "net::ERR_ABORTED";
    if (!expectedNavigationAbort && !expectedCompletedPollAbort && !expectedResponsiveImageAbort) networkErrors.push(`NETWORK_FAIL ${request.method()} ${request.url()} (${errorText ?? "unknown"})`);
  });

  let roomId;
  try {
    await page.goto(`${BASE_URL}/homes/${homeId}/rooms/new`, { waitUntil: "networkidle" });
    await noHorizontalOverflow(page, 390, "intake");
    reporter.assert(await page.getByRole("heading", { level: 1, name: /Design this room/i }).count() === 1, "intake exposes one clear page heading");
    reporter.assert(
      await page.getByLabel("Your room photo").count() === 1 && await page.getByLabel("What should this room do better?").count() === 1,
      "intake fields have programmatic labels"
    );

    const photoInput = page.getByTestId("autopilot-photo-input");
    await photoInput.focus();
    const focusStyle = await photoInput.evaluate((element) => {
      const style = getComputedStyle(element);
      return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
    });
    reporter.assert(focusStyle.outlineStyle !== "none" && focusStyle.outlineWidth !== "0px", "keyboard focus is visibly indicated", focusStyle);

    const intakeStarted = Date.now();
    await photoInput.setInputFiles(path.join(process.cwd(), "spike", "input-images", "IMG_1126.jpg"));
    await page.getByTestId("autopilot-outcome-input").fill("Create a calm reading room with closed storage and a clear path to the window.");
    await page.getByTestId("autopilot-room-name-input").fill("P1.6 phone room");
    await page.getByTestId("autopilot-intake-submit").click();
    await page.waitForURL(/\/rooms\/[0-9a-f-]+$/i, { timeout: 90000 });
    roomId = new URL(page.url()).pathname.split("/").pop();
    const activeIntakeMs = Date.now() - intakeStarted;
    reporter.assert(activeIntakeMs <= 120000, "mock phone intake after photo selection completes within two minutes", { activeIntakeMs });
    reporter.assert(firstDesignPosts === 1, "intake submits exactly one first-design operation", { firstDesignPosts });

    let state = await pollState(roomId, (value) => value.generation_jobs.some((job) => operation(job) === "first_design" && job.status === "completed"));
    const firstCandidate = state?.renders.find((render) => render.status === "candidate");
    reporter.assert(Boolean(firstCandidate), "first design persists as a reviewed candidate", state?.renders);
    await page.reload({ waitUntil: "networkidle" });
    reporter.assert(await page.getByTestId("current-design").getAttribute("data-render-id") === firstCandidate?.id, "first design survives reopen");

    const primaryAction = page.getByTestId("accept-design-submit");
    const actionBox = await primaryAction.boundingBox();
    reporter.assert(Boolean(actionBox && actionBox.y + actionBox.height <= 844), "phone first-result primary action is visible without scrolling", actionBox);
    reporter.assert(await page.locator('[role="status"][aria-live="polite"]').count() >= 1, "durable work state is exposed through a polite live region");
    await noHorizontalOverflow(page, 390, "first result");

    await page.getByTestId("visual-revision-input").fill("Make the walls warmer while keeping the window and clear access unchanged.");
    await page.getByTestId("visual-revision-submit").click();
    state = await pollState(roomId, (value) => value.generation_jobs.some((job) => operation(job) === "visual_revision" && job.status === "completed"));
    const revisedCandidate = state?.renders.find((render) => render.status === "candidate");
    reporter.assert(Boolean(revisedCandidate && revisedCandidate.id !== firstCandidate?.id), "one owner revision appends one new current candidate", state?.renders);
    await page.reload({ waitUntil: "networkidle" });
    await page.getByTestId("accept-design-submit").click();
    state = await pollState(roomId, (value) => value.renders.some((render) => render.id === revisedCandidate?.id && render.status === "accepted"));
    reporter.assert(state?.room.status === "approved", "accepted design persists as the room decision", state?.room);

    await page.reload({ waitUntil: "networkidle" });
    await page.getByTestId("implementation-package-submit").click();
    state = await pollState(roomId, (value) => value.generation_jobs.some((job) => operation(job) === "implementation_package" && job.status === "completed"));
    await page.reload({ waitUntil: "networkidle" });
    reporter.assert(
      await page.getByTestId("implementation-package").count() === 1 &&
        await page.getByTestId("field-verification-list").count() === 1 &&
        await page.getByTestId("budget-summary").count() === 1,
      "accepted design exposes one persisted implementation package with measurement and budget guidance"
    );

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await noHorizontalOverflow(page, width, "completed homeowner journey");
      const imageBox = await page.getByTestId("current-design").locator("img").boundingBox();
      reporter.assert(Boolean(imageBox && imageBox.width > 0 && imageBox.height > 0), `accepted design remains visible at ${width}px`, imageBox);
      await mkdir(path.join(process.cwd(), "test-runs", "screenshots"), { recursive: true });
      await page.screenshot({ path: path.join(process.cwd(), "test-runs", "screenshots", `p16-household-${width}.png`), fullPage: true });
    }

    const firstDesignJobs = state.generation_jobs.filter((job) => operation(job) === "first_design");
    const revisionJobs = state.generation_jobs.filter((job) => operation(job) === "visual_revision");
    const packageJobs = state.generation_jobs.filter((job) => operation(job) === "implementation_package");
    reporter.assert(firstDesignJobs.length === 1 && revisionJobs.length === 1 && packageJobs.length === 1, "journey creates no duplicate durable operations", {
      firstDesignJobs: firstDesignJobs.length,
      revisionJobs: revisionJobs.length,
      packageJobs: packageJobs.length
    });
    reporter.assert(state.renders.length === 2, "one first design and one revision create exactly two append-only versions", state.renders);

    const { count: untaggedRows } = await supabase.from("generation_jobs").select("*", { count: "exact", head: true }).eq("room_id", roomId).is("test_run_id", null);
    const { data: createdRoom } = await supabase.from("rooms").select("test_run_id").eq("id", roomId).single();
    reporter.assert(createdRoom?.test_run_id === testRunId && (untaggedRows ?? 0) === 0, "browser-created release evidence remains teardown-safe", { roomTag: createdRoom?.test_run_id, untaggedRows });
    reporter.assert(consoleErrors.length === 0, "homeowner journey has no browser console errors", consoleErrors);
    reporter.assert(networkErrors.length === 0, "homeowner journey has no application network errors", networkErrors);
  } finally {
    await browser.close();
  }
  reporter.finish();
}

main().catch((error) => {
  console.error("[p16-household-release] FAILED:", error.message);
  reporter.assert(false, "suite completed without an unhandled error", error.message);
  reporter.finish();
});
