import { chromium } from "playwright";
import { BASE_URL, fetchJson, getRoomState, readCurrentTestRun, SuiteReporter, waitForAtLeast, waitForServer, requireServerIsolation, clickTabAndWait } from "./_lib.mjs";

/**
 * P0.5 browser/state gate. This is intentionally a single focused journey so
 * it exercises the owner-facing recovery surfaces against persisted state:
 * success, duplicate submission, refresh/reopen, retryable failure, terminal
 * failure, and partial batch recovery.
 */

const reporter = new SuiteReporter("p05-browser");
const ACTIVE = new Set(["queued", "planning", "validating", "generating", "persisting"]);
const TERMINAL = new Set(["completed", "retryable_failed", "terminal_failed", "cancelled"]);

async function pollJob(roomId, jobId, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    const response = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/jobs/${jobId}`);
    last = response.body?.job ?? last;
    if (last && TERMINAL.has(last.status)) return last;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return last;
}

async function pollBatch(roomId, predicate, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    const response = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/render-batch`);
    last = response.body?.batch ?? last;
    if (last && predicate(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return last;
}

async function bootstrap(roomId) {
  const diagnosis = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/analyze`, { method: "POST" });
  reporter.assert(diagnosis.ok, "browser gate bootstrap: diagnosis succeeds", diagnosis.body);
  const concepts = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/generate-moodboards`, { method: "POST" });
  reporter.assert(concepts.ok && concepts.body?.mood_boards?.length === 3, "browser gate bootstrap: three concepts are available", concepts.body);
  const lock = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/select-moodboard`, {
    method: "POST",
    body: JSON.stringify({ mood_board_id: concepts.body.mood_boards[0].id })
  });
  reporter.assert(lock.ok, "browser gate bootstrap: a concept is approved", lock.body);
  const photos = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/photos`);
  return photos.body.photos.map((photo) => photo.id);
}

async function main() {
  await waitForServer();
  const { serverAiMode } = await requireServerIsolation();
  if (serverAiMode !== "mock") throw new Error(`p05-browser requires AI_MODE=mock (got ${serverAiMode}).`);

  const { roomId } = readCurrentTestRun();
  const [photoId, failedPhotoId] = await bootstrap(roomId);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("response", (response) => { if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.request().method()} ${response.url()}`); });
  page.on("requestfailed", (request) => {
    const isRscAbort = request.url().includes("_rsc=") && request.failure()?.errorText === "net::ERR_ABORTED";
    const isNavigationImageAbort = request.url().includes("/storage/v1/object/public/room-photos/") && request.failure()?.errorText === "net::ERR_ABORTED";
    if (!isRscAbort && !isNavigationImageAbort) failedRequests.push(`NETWORK_FAIL ${request.method()} ${request.url()} :: ${request.failure()?.errorText}`);
  });

  try {
    await page.goto(`${BASE_URL}/rooms/${roomId}`, { waitUntil: "networkidle" });
    await clickTabAndWait(page, "tab-renders");

    // Success through the visible owner action, followed by a real reopen.
    await page.getByTestId("render-instructions-input").fill("Browser gate success path.");
    await page.getByTestId("render-generate-button").click();
    reporter.assert((await waitForAtLeast(page.locator('[data-testid^="render-card-"]'), 1, { timeoutMs: 60000 })) >= 1, "success: a render appears through the browser workflow");
    reporter.assert((await page.getByTestId("room-workflow-notice").count()) >= 1, "success: completion is announced in an inline live notice");

    await page.reload({ waitUntil: "networkidle" });
    await clickTabAndWait(page, "tab-renders");
    reporter.assert((await page.locator('[data-testid^="render-card-"]').count()) >= 1, "refresh/reopen: completed render remains visible without repeating input");

    // Two browser requests for the same logical action must converge on one job.
    const duplicate = await page.evaluate(async ({ roomId: id, sourcePhotoId }) => {
      const body = JSON.stringify({ job_type: "render", payload: { source_photo_id: sourcePhotoId, instructions: "Browser duplicate click." } });
      const read = async (response) => ({ status: response.status, body: await response.json() });
      return Promise.all([
        fetch(`/api/rooms/${id}/jobs`, { method: "POST", headers: { "Content-Type": "application/json" }, body }).then(read),
        fetch(`/api/rooms/${id}/jobs`, { method: "POST", headers: { "Content-Type": "application/json" }, body }).then(read)
      ]);
    }, { roomId, sourcePhotoId: photoId });
    reporter.assert(duplicate[0].body?.job?.id === duplicate[1].body?.job?.id, "duplicate click: both browser submissions resolve to one job");
    reporter.assert([duplicate[0].body?.created, duplicate[1].body?.created].filter(Boolean).length === 1, "duplicate click: only one browser submission creates work");
    await pollJob(roomId, duplicate[0].body.job.id);

    // Retryable failure: persisted notice survives the reopen and its Try again
    // control completes the same logical job without losing the saved request.
    const retryableStart = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/jobs`, {
      method: "POST",
      body: JSON.stringify({ job_type: "render", payload: { source_photo_id: photoId, instructions: "Keep this instruction after a retry.", test_force_failure: "browser_retryable_failure" } })
    });
    const retryableJob = await pollJob(roomId, retryableStart.body.job.id);
    reporter.assert(retryableJob?.status === "retryable_failed", "retryable failure: durable job settles as recoverable");
    await page.reload({ waitUntil: "networkidle" });
    const persistedNotice = page.getByTestId("persisted-job-notice");
    reporter.assert(await persistedNotice.getAttribute("data-job-status") === "retryable_failed", "retryable failure: reopen shows the saved recovery notice");
    await persistedNotice.getByRole("button", { name: "Try again" }).click();
    await page.waitForTimeout(1000);
    reporter.assert((await waitForAtLeast(page.locator('[data-testid^="render-card-"]'), 2, { timeoutMs: 60000 })) >= 2, "retryable failure: Try again completes and adds the recovered render");

    // Terminal failure: an invalid source is owner-visible but offers no unsafe
    // retry loop.
    const terminalStart = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/jobs`, {
      method: "POST",
      body: JSON.stringify({ job_type: "render", payload: { source_photo_id: "00000000-0000-0000-0000-0000000000ff" } })
    });
    const terminalJob = await pollJob(roomId, terminalStart.body.job.id);
    reporter.assert(terminalJob?.status === "terminal_failed", "terminal failure: invalid source settles terminal");
    await page.reload({ waitUntil: "networkidle" });
    const terminalNotice = page.getByTestId("persisted-job-notice");
    reporter.assert(await terminalNotice.getAttribute("data-job-status") === "terminal_failed", "terminal failure: reopen explains the saved terminal state");
    reporter.assert(await terminalNotice.getByRole("button", { name: "Try again" }).count() === 0, "terminal failure: reopen does not offer an unbounded retry");

    // Partial batch: persisted child state renders the failed perspective as
    // the only retry target, then recovery leaves the successful siblings intact.
    const batchStart = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/render-batch`, {
      method: "POST",
      body: JSON.stringify({ test_force_failure_photo_ids: [failedPhotoId] })
    });
    reporter.assert(batchStart.status === 202, "partial batch: browser-started batch is accepted");
    const partial = await pollBatch(roomId, (batch) => !ACTIVE.has(batch.job.status) && batch.failed === 1);
    reporter.assert(partial?.completed === 3 && partial?.failed === 1, "partial batch: persisted reopen state is three complete and one failed");
    await page.reload({ waitUntil: "networkidle" });
    await clickTabAndWait(page, "tab-renders");
    const progress = page.getByTestId("batch-progress");
    reporter.assert(await progress.getAttribute("data-completed") === "3", "partial batch: room UI restores three completed perspectives");
    reporter.assert(await page.getByTestId("batch-retry-failed").isVisible(), "partial batch: room UI prioritizes retrying failed perspectives");
    reporter.assert(await page.getByTestId(`batch-photo-${failedPhotoId}`).getAttribute("data-status") === "retryable_failed", "partial batch: only the failed perspective is marked recoverable");
    await page.getByTestId("batch-retry-failed").click();
    await page.waitForFunction(
      () => document.querySelector('[data-testid="batch-progress"]')?.getAttribute("data-completed") === "4",
      undefined,
      { timeout: 60000 }
    );
    reporter.assert(await page.getByTestId("batch-progress").getAttribute("data-completed") === "4", "partial batch: retry completes the failed perspective");

    reporter.assert(consoleErrors.length === 0, "browser gate: zero new console errors", consoleErrors);
    reporter.assert(failedRequests.length === 0, "browser gate: zero unexpected failed requests", failedRequests);
  } finally {
    await browser.close();
  }

  reporter.finish();
}

main().catch((error) => {
  console.error("[p05-browser] FAILED:", error);
  process.exitCode = 1;
});
