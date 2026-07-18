import { readFileSync } from "node:fs";
import path from "node:path";
import {
  BASE_URL,
  fetchJson,
  getRoomState,
  readCurrentTestRun,
  requireServerIsolation,
  SuiteReporter,
  waitForServer
} from "./_lib.mjs";

const corpus = JSON.parse(
  readFileSync(path.join(process.cwd(), "lib/ai/fixtures/p1-3-finished-image-corpus.json"), "utf8")
);
const reporter = new SuiteReporter("p13-finished-image");

function fixtureHeaders(fixture) {
  return fixture ? { headers: { "x-test-failure-fixture": fixture } } : {};
}

async function pollJob(roomId, jobId, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    const response = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/jobs/${jobId}`);
    last = response.body?.job ?? last;
    if (last && ["completed", "retryable_failed", "terminal_failed", "cancelled"].includes(last.status)) return last;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return last;
}

function finishedReview(render) {
  return render?.critique?.finished_image_review ?? null;
}

async function main() {
  await waitForServer();
  const { serverAiMode } = await requireServerIsolation();
  if (serverAiMode !== "mock") throw new Error(`P1.3 seeded corpus requires AI_MODE=mock (got ${serverAiMode}).`);
  const { roomId, photoIds } = readCurrentTestRun();
  console.log(`[p13-finished-image] corpus=${corpus.version} room=${roomId}`);

  for (const seededCase of corpus.critical_cases) {
    const response = await fetchJson(`${BASE_URL}/api/debug/fixture-check?roomId=${roomId}&boundary=finished-image`, {
      ...fixtureHeaders(seededCase.fixture)
    });
    const review = response.body?.review;
    const violationText = Array.isArray(review?.critical_violations) ? review.critical_violations.join(" ").toLowerCase() : "";
    reporter.assert(
      response.ok && review?.verdict === "failure" && review.critical_violations.length > 0,
      `${seededCase.id}: reviewer catches the seeded critical failure`,
      response.body
    );
    reporter.assert(
      violationText.includes(seededCase.expected_signal.toLowerCase()),
      `${seededCase.id}: verdict identifies the expected failure signal`,
      { expected: seededCase.expected_signal, violations: review?.critical_violations }
    );
  }

  for (const control of corpus.known_good_controls) {
    const response = await fetchJson(`${BASE_URL}/api/debug/fixture-check?roomId=${roomId}&boundary=finished-image`);
    const review = response.body?.review;
    reporter.assert(
      response.ok && review?.verdict !== "failure" && review?.critical_violations?.length === 0,
      `${control.id}: known-good control has no critical false positive`,
      response.body
    );
  }

  const firstStart = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/first-design`, {
    method: "POST",
    body: JSON.stringify({ source_photo_id: photoIds[0] })
  });
  const firstJob = firstStart.body?.job?.id ? await pollJob(roomId, firstStart.body.job.id) : null;
  reporter.assert(firstStart.ok && firstJob?.status === "completed", "precondition: one reviewed first design completes", firstJob);
  let state = await getRoomState(roomId);
  const originalCandidate = state.renders.find((render) => render.status === "candidate");
  reporter.assert(Boolean(originalCandidate), "precondition: a current candidate exists", state.renders);

  const terminalBefore = { renders: state.renders.length, revisions: state.revisions.length };
  const terminalStart = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/visual-revision`, {
    method: "POST",
    body: JSON.stringify({ message: "Make the walls warmer in this design.", request_id: crypto.randomUUID() }),
    ...fixtureHeaders("finished_image_critical")
  });
  const terminalJob = terminalStart.body?.job?.id ? await pollJob(roomId, terminalStart.body.job.id) : null;
  state = await getRoomState(roomId);
  const terminalAttempts = state.renders.slice(terminalBefore.renders);
  reporter.assert(
    terminalJob?.status === "terminal_failed" && terminalJob.error_code === "visual_revision_repair_failed",
    "terminal critical revision stops after its one permitted repair",
    terminalJob
  );
  reporter.assert(
    terminalAttempts.length === 2 && terminalAttempts.every((render) => render.status === "review_failed"),
    "terminal critical revision persists exactly two failed attempts and no third edit",
    terminalAttempts
  );
  reporter.assert(
    state.revisions.length === terminalBefore.revisions && state.renders.find((render) => render.id === originalCandidate?.id)?.status === "candidate",
    "terminal critical attempts create no revision and do not replace the current candidate",
    { revisions: state.revisions, renders: state.renders }
  );

  const repairBefore = { renders: state.renders.length, revisions: state.revisions.length };
  const repairStart = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/visual-revision`, {
    method: "POST",
    body: JSON.stringify({ message: "Add more closed storage to this design.", request_id: crypto.randomUUID() }),
    ...fixtureHeaders("finished_image_repairable")
  });
  const repairJob = repairStart.body?.job?.id ? await pollJob(roomId, repairStart.body.job.id) : null;
  state = await getRoomState(roomId);
  const repairAttempts = state.renders.slice(repairBefore.renders);
  reporter.assert(repairJob?.status === "completed", "repairable critical revision completes after one repair", repairJob);
  reporter.assert(
    repairAttempts.length === 2 && repairAttempts[0]?.status === "review_failed" && repairAttempts[1]?.status === "candidate",
    "repairable revision uses exactly two edits and persists both reviews",
    repairAttempts
  );
  reporter.assert(
    repairJob?.result_refs?.attempt_render_ids?.length === 2 && state.revisions.length === repairBefore.revisions + 1,
    "successful repair links two attempt render ids to exactly one revision",
    { result_refs: repairJob?.result_refs, revisions: state.revisions }
  );
  reporter.assert(
    repairAttempts.every((render) => finishedReview(render)) && finishedReview(repairAttempts[1])?.critical_violations?.length === 0,
    "both repair attempts retain structured review evidence and the current candidate is critical-free",
    repairAttempts
  );

  reporter.finish();
}

main().catch((error) => {
  console.error("[p13-finished-image] FAILED:", error.message);
  reporter.assert(false, "suite completed without an unhandled error", error.message);
  reporter.finish();
});
