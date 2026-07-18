import { chromium } from "playwright";
import {
  BASE_URL,
  getRoomState,
  readCurrentTestRun,
  requireServerIsolation,
  SuiteReporter,
  waitForServer
} from "./_lib.mjs";

const reporter = new SuiteReporter("p13-revisions");
const scenarios = [
  "Make the walls a warmer soft cream.",
  "Add closed storage below the window.",
  "Use less furniture and leave the access route open.",
  "Replace the desk chair with a softer olive chair.",
  "Add a textured rug while keeping the work zone clear."
];

async function pollState(roomId, predicate, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  let state = null;
  while (Date.now() < deadline) {
    state = await getRoomState(roomId);
    if (predicate(state)) return state;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return state;
}

function reviewFor(render) {
  return render?.critique?.finished_image_review ?? null;
}

async function main() {
  await waitForServer();
  const { serverAiMode } = await requireServerIsolation();
  if (serverAiMode !== "mock") throw new Error(`P1.3 revision scenarios require AI_MODE=mock (got ${serverAiMode}).`);
  const { roomId } = readCurrentTestRun();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.request().method()} ${response.url()}`);
  });
  page.on("requestfailed", (request) => {
    const isExpectedRscAbort = request.url().includes("_rsc=") && request.failure()?.errorText === "net::ERR_ABORTED";
    if (!isExpectedRscAbort) failedRequests.push(`NETWORK_FAIL ${request.method()} ${request.url()}`);
  });

  try {
    await page.goto(`${BASE_URL}/rooms/${roomId}`, { waitUntil: "networkidle" });
    const firstResponse = page.waitForResponse((response) => response.url().includes("/first-design") && response.request().method() === "POST");
    await page.getByTestId("first-design-submit").click();
    await firstResponse;
    let state = await pollState(roomId, (value) => value.renders.some((render) => render.status === "candidate"));
    const initialCandidate = state.renders.find((render) => render.status === "candidate");
    reporter.assert(Boolean(initialCandidate), "precondition: browser starts one reviewed first design", state.renders);
    await page.reload({ waitUntil: "networkidle" });
    reporter.assert(await page.getByTestId("current-design").getAttribute("data-render-id") === initialCandidate?.id, "first design survives reload");

    for (const [index, message] of scenarios.entries()) {
      state = await getRoomState(roomId);
      const before = {
        renderCount: state.renders.length,
        revisionCount: state.revisions.length,
        jobCount: state.generation_jobs.length,
        candidate: state.renders.find((render) => render.status === "candidate")
      };
      let submissions = 0;
      const requestListener = (request) => {
        if (request.method() === "POST" && request.url().endsWith(`/api/rooms/${roomId}/visual-revision`)) submissions += 1;
      };
      page.on("request", requestListener);
      await page.getByTestId("visual-revision-input").fill(message);
      const responsePromise = page.waitForResponse((response) => response.url().endsWith(`/api/rooms/${roomId}/visual-revision`) && response.request().method() === "POST");
      await page.getByTestId("visual-revision-submit").click();
      const response = await responsePromise;
      const responseBody = await response.json();
      const jobId = responseBody?.job?.id;
      state = await pollState(roomId, (value) => value.generation_jobs.some((job) => job.id === jobId && job.status === "completed"));
      page.off("request", requestListener);

      const newRenders = state.renders.slice(before.renderCount);
      const newRevisions = state.revisions.slice(before.revisionCount);
      const newJobs = state.generation_jobs.slice(before.jobCount);
      const current = state.renders.find((render) => render.status === "candidate");
      reporter.assert(response.ok() && submissions === 1, `scenario ${index + 1}: one browser submission starts the revision`, { status: response.status(), submissions });
      reporter.assert(
        newRenders.length === 1 && newRevisions.length === 1 && newJobs.length === 1,
        `scenario ${index + 1}: exactly one job, version, and revision are appended`,
        { newRenders, newRevisions, newJobs }
      );
      reporter.assert(
        current?.id === newRenders[0]?.id && current?.source_photo_id === before.candidate?.source_photo_id,
        `scenario ${index + 1}: new current version retains the original source-photo linkage`,
        { current, parent: before.candidate }
      );
      reporter.assert(
        reviewFor(current)?.critical_violations?.length === 0 && ["pass", "warning"].includes(reviewFor(current)?.verdict),
        `scenario ${index + 1}: finished review preserves unrelated architecture`,
        reviewFor(current)
      );
      reporter.assert(
        state.renders.find((render) => render.id === before.candidate?.id)?.status === "historical",
        `scenario ${index + 1}: prior version remains available as history`,
        state.renders
      );

      await page.reload({ waitUntil: "networkidle" });
      reporter.assert(
        await page.getByTestId("current-design").getAttribute("data-render-id") === current?.id &&
          (await page.getByText(`Latest change: ${message}`).count()) === 1,
        `scenario ${index + 1}: latest version and owner instruction survive refresh`
      );
    }

    reporter.assert(consoleErrors.length === 0, "browser journey has no console errors", consoleErrors);
    reporter.assert(failedRequests.length === 0, "browser journey has no failed network requests", failedRequests);
  } finally {
    await browser.close();
  }
  reporter.finish();
}

main().catch((error) => {
  console.error("[p13-revisions] FAILED:", error.message);
  reporter.assert(false, "suite completed without an unhandled error", error.message);
  reporter.finish();
});
