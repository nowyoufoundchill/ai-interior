import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { BASE_URL, fetchJson, getRoomState, readCurrentTestRun, requireServerIsolation, SuiteReporter, waitForServer } from "./_lib.mjs";

const reporter = new SuiteReporter("p14-implementation-package");

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

function packageBody(artifact) {
  return artifact?.package && typeof artifact.package === "object" ? artifact.package : null;
}

function allClaims(plan) {
  return [
    ...(plan?.placement_guidance ?? []),
    ...(plan?.measurement_and_clearance_claims ?? []),
    ...(plan?.furnishing_schedule ?? []).flatMap((item) => [item.placement, ...(item.dimensions ?? [])])
  ];
}

async function main() {
  await waitForServer();
  const { serverAiMode } = await requireServerIsolation();
  if (serverAiMode !== "mock") throw new Error(`P1.4 implementation gate requires AI_MODE=mock (got ${serverAiMode}).`);
  const { roomId } = readCurrentTestRun();
  const seededPhotosResponse = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/photos`);
  const seededPhotos = seededPhotosResponse.body?.photos ?? [];
  const photoDeletions = await Promise.all(seededPhotos.map((photo) => fetchJson(`${BASE_URL}/api/rooms/${roomId}/photos`, {
    method: "DELETE",
    body: JSON.stringify({ photo_id: photo.id, storage_path: photo.storage_path })
  })));
  reporter.assert(seededPhotosResponse.ok && photoDeletions.length > 0 && photoDeletions.every((response) => response.ok), "precondition: tagged room can enter the no-photo state", photoDeletions.map((response) => response.status));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("response", (response) => { if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.request().method()} ${response.url()}`); });
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText;
    const expectedRscAbort = request.url().includes("_rsc=") && errorText === "net::ERR_ABORTED";
    const expectedCompletedJobPollAbort = request.method() === "GET" && request.url().includes(`/api/rooms/${roomId}/jobs/`) && errorText === "net::ERR_ABORTED";
    if (!expectedRscAbort && !expectedCompletedJobPollAbort) failedRequests.push(`NETWORK_FAIL ${request.method()} ${request.url()} (${errorText ?? "unknown"})`);
  });
  try {
    await page.goto(`${BASE_URL}/rooms/${roomId}`, { waitUntil: "networkidle" });
    reporter.assert(
      await page.getByTestId("empty-room-photo-state").isVisible() && await page.getByTestId("empty-room-photo-upload-input").count() === 1,
      "an existing room without photos offers an actionable upload control"
    );
    const photoUploadResponse = page.waitForResponse((response) => response.url().endsWith(`/api/rooms/${roomId}/photos`) && response.request().method() === "POST");
    await page.getByTestId("empty-room-photo-upload-input").setInputFiles(path.join(process.cwd(), "spike", "input-images", "IMG_1126.jpg"));
    const uploadedPhoto = await photoUploadResponse;
    await page.getByTestId("first-design-submit").waitFor({ state: "visible" });
    reporter.assert(uploadedPhoto.ok() && await page.getByTestId("current-design").getAttribute("data-render-id") === "source", "uploaded photo appears and unlocks Design my room");
    await page.getByTestId("first-design-submit").click();
    let state = await pollState(roomId, (value) => value.renders.some((render) => render.status === "candidate"));
    const firstCandidate = state.renders.find((render) => render.status === "candidate");
    reporter.assert(Boolean(firstCandidate), "precondition: one reviewed design is ready", state.renders);
    await page.reload({ waitUntil: "networkidle" });
    await page.getByTestId("accept-design-submit").click();
    state = await pollState(roomId, (value) => value.room.status === "approved" && value.renders.some((render) => render.id === firstCandidate?.id && render.status === "accepted"));
    reporter.assert(state.room.status === "approved", "keeping the design unlocks the room-plan action", state.room);
    await page.reload({ waitUntil: "networkidle" });

    let packageSubmissions = 0;
    const packageRequestListener = (request) => {
      if (request.method() === "POST" && request.url().endsWith(`/api/rooms/${roomId}/implementation-package`)) packageSubmissions += 1;
    };
    page.on("request", packageRequestListener);
    await page.getByTestId("implementation-package-submit").click();
    state = await pollState(roomId, (value) => value.implementation_packages?.some((artifact) => artifact.status === "current"));
    page.off("request", packageRequestListener);
    const firstPackage = state.implementation_packages?.find((artifact) => artifact.status === "current");
    const plan = packageBody(firstPackage);
    reporter.assert(packageSubmissions === 1 && Boolean(firstPackage), "one owner action creates one current implementation package", { packageSubmissions, packages: state.implementation_packages });
    reporter.assert(firstPackage?.accepted_render_id === firstCandidate?.id && firstPackage?.version === 1, "package version 1 binds only to the accepted design", firstPackage);
    reporter.assert(state.room.status === "implementation_ready", "room advances to implementation ready only after persistence", state.room);

    const itemIds = new Set((plan?.furnishing_schedule ?? []).map((item) => item.id));
    reporter.assert(
      (plan?.coverage?.length ?? 0) > 0 && plan.coverage.every((entry) => itemIds.has(entry.schedule_item_id)),
      "every named must-have and major visible furnishing is linked to a schedule entry",
      plan?.coverage
    );
    reporter.assert(
      (plan?.furnishing_schedule?.length ?? 0) >= 10 && plan.furnishing_schedule.every((item) => ["exact_match", "near_match", "design_reference", "custom", "illustrative", "non_purchasable"].includes(item.classification)),
      "the furnishing schedule covers all major items with an honest sourcing disposition",
      plan?.furnishing_schedule
    );
    const taskIds = new Set((plan?.field_verification_tasks ?? []).map((task) => task.id));
    const claims = allClaims(plan);
    reporter.assert(claims.length > 0 && claims.every((claim) => Boolean(claim?.provenance)), "every dimensional, placement, and clearance claim carries provenance", claims);
    reporter.assert(
      claims.filter((claim) => claim.provenance === "unknown").every((claim) => claim.field_task_id && taskIds.has(claim.field_task_id)),
      "every unknown fit or dimension creates a linked field-verification task",
      { claims, tasks: plan?.field_verification_tasks }
    );
    const calculatedLow = plan.furnishing_schedule.reduce((sum, item) => sum + item.budget_low * item.quantity, 0);
    const calculatedHigh = plan.furnishing_schedule.reduce((sum, item) => sum + item.budget_high * item.quantity, 0);
    reporter.assert(
      plan.budget.total_low === calculatedLow && plan.budget.total_high === calculatedHigh && plan.budget.variance_summary && plan.budget.assumptions.length,
      "total range, variance, and assumptions are visible and reconcile to the schedule",
      plan.budget
    );

    const links = plan.furnishing_schedule.flatMap((item) => [
      ...(item.product?.canonical_url ? [{ url: item.product.canonical_url, classification: item.classification, label: item.category }] : []),
      ...(item.alternatives ?? []).filter((alternative) => alternative.canonical_url).map((alternative) => ({ url: alternative.canonical_url, classification: alternative.classification, label: alternative.label }))
    ]).slice(0, 10);
    reporter.assert(links.length === 10 && links.every((link) => ["exact_match", "near_match", "design_reference"].includes(link.classification)), "ten sampled sourcing links carry a product classification", links);
    for (const [index, link] of links.entries()) {
      const response = await fetch(link.url, { redirect: "follow", headers: { "User-Agent": "AI Interior Atelier P1.4 link gate" } }).catch(() => null);
      reporter.assert(Boolean(response?.ok), `sampled product link ${index + 1} opens`, { ...link, status: response?.status ?? "network_error" });
    }

    const replayBefore = state.generation_jobs.length;
    const replay = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/implementation-package`, { method: "POST", body: JSON.stringify({ request_id: crypto.randomUUID() }) });
    state = await getRoomState(roomId);
    reporter.assert(replay.ok && replay.body?.created === false && state.generation_jobs.length === replayBefore, "re-requesting the current accepted design creates no duplicate job or package", replay.body);
    await page.reload({ waitUntil: "networkidle" });
    reporter.assert(await page.getByTestId("implementation-package").isVisible(), "the package survives refresh in the accepted room workspace");
    reporter.assert(await page.getByTestId("field-verification-list").isVisible() && await page.getByTestId("budget-summary").isVisible(), "the owner can identify what to measure and the total range without internal artifacts");
    const screenshotDirectory = path.join(process.cwd(), "test-runs", "screenshots");
    await mkdir(screenshotDirectory, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDirectory, "p14-implementation-package.png"), fullPage: true });

    await page.getByTestId("visual-revision-input").fill("Make the desk wall warmer in this design.");
    await page.getByTestId("visual-revision-submit").click();
    state = await pollState(roomId, (value) => value.renders.some((render) => render.status === "candidate"));
    const secondCandidate = state.renders.find((render) => render.status === "candidate");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByTestId("accept-design-submit").click();
    state = await pollState(roomId, (value) => value.renders.some((render) => render.id === secondCandidate?.id && render.status === "accepted"));
    reporter.assert(state.implementation_packages.find((artifact) => artifact.id === firstPackage?.id)?.status === "stale", "accepting a new design stales but does not delete the prior package", state.implementation_packages);
    await page.reload({ waitUntil: "networkidle" });
    await page.getByTestId("implementation-package-submit").click();
    state = await pollState(roomId, (value) => value.implementation_packages?.some((artifact) => artifact.version === 2 && artifact.status === "current"));
    reporter.assert(
      state.implementation_packages.length === 2 && state.implementation_packages.find((artifact) => artifact.version === 2)?.accepted_render_id === secondCandidate?.id,
      "the newer accepted design appends package version 2 while version 1 remains history",
      state.implementation_packages
    );
    await page.reload({ waitUntil: "networkidle" });
    reporter.assert(await page.getByTestId("implementation-package").getAttribute("data-package-version") === "2", "the refreshed workspace shows the package bound to the latest accepted design");
    reporter.assert(consoleErrors.length === 0, "browser journey has no console errors", consoleErrors);
    reporter.assert(failedRequests.length === 0, "browser journey has no failed application requests", failedRequests);
  } finally {
    await browser.close();
  }
  reporter.finish();
}

main().catch((error) => {
  console.error("[p14-implementation-package] FAILED:", error.message);
  reporter.assert(false, "suite completed without an unhandled error", error.message);
  reporter.finish();
});
