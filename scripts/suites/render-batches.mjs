import { createClient } from "@supabase/supabase-js";
import { loadTestEnv } from "../test-env.mjs";
import { BASE_URL, fetchJson, getRoomState, readCurrentTestRun, SuiteReporter, waitForServer, requireServerIsolation } from "./_lib.mjs";

/**
 * P0.3 All-Perspective Render Batches — strict success gate
 * (docs/P0_P1_EXECUTION_PLAN_2026-07-10.md §P0.3).
 *
 * Self-contained from a fresh `npm run seed:test` (a 4-photo office). Bootstraps
 * a locked concept, then drives the durable batch through the app's own routes:
 *
 *  - eligibility preview (4 perspectives, none excluded, estimate present);
 *  - rapid double-submit dedupes to ONE batch (no duplicate paid calls);
 *  - a forced first-attempt failure on photo 3 → 3 perspectives complete, only
 *    photo 3 is retryable, siblings intact;
 *  - retrying photo 3 completes it WITHOUT regenerating or staling siblings;
 *  - four linked current renders, one per photo, stamped with the locked version;
 *  - the consistency rubric passes across the four perspectives.
 *
 * Requires AI_MODE=mock (the forced-failure hook is inert live) + isolation.
 */

loadTestEnv();
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const reporter = new SuiteReporter("render-batches");
const TERMINAL = ["completed", "terminal_failed", "cancelled"];

async function pollJob(roomId, jobId, { timeoutMs = 90000, intervalMs = 500, until } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    const { body } = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/jobs/${jobId}`);
    last = body?.job ?? last;
    if (last && (until ? until(last) : TERMINAL.includes(last.status))) return last;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return last;
}

async function getBatch(roomId) {
  const { body } = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/render-batch`);
  return body;
}

async function pollBatch(roomId, { timeoutMs = 90000, intervalMs = 600, until } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await getBatch(roomId);
    if (last?.batch && until(last)) return last;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return last;
}

function currentRenders(state, photoId) {
  return (state.renders ?? []).filter((r) => r.source_photo_id === photoId && r.status === "current");
}

async function main() {
  await waitForServer();
  const { serverAiMode } = await requireServerIsolation();
  if (serverAiMode !== "mock") {
    throw new Error(`render-batches requires an AI_MODE=mock server (got ${serverAiMode}).`);
  }
  const { roomId } = readCurrentTestRun();
  console.log(`[render-batches] room=${roomId}`);

  // --- Bootstrap: diagnosis -> concepts -> lock ------------------------------
  const analyze = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/analyze`, { method: "POST" });
  reporter.assert(analyze.ok, "bootstrap: diagnosis succeeds", analyze.body);
  const concepts = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/generate-moodboards`, { method: "POST" });
  reporter.assert(concepts.ok && concepts.body?.mood_boards?.length === 3, "bootstrap: 3 concepts generated", concepts.body);
  const boardToLock = concepts.body.mood_boards[0];
  const lock = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/select-moodboard`, {
    method: "POST",
    body: JSON.stringify({ mood_board_id: boardToLock.id })
  });
  reporter.assert(lock.ok, "bootstrap: a concept is locked", lock.body);

  const photosResp = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/photos`);
  const photos = photosResp.body.photos;
  reporter.assert(photos.length === 4, "seed room has 4 photos (the four-photo gate)", photos.length);
  const [p0, p1, p2, p3] = photos.map((p) => p.id);

  // --- 1. Eligibility preview ------------------------------------------------
  const preview = await getBatch(roomId);
  reporter.assert(
    preview?.eligibility?.eligible_count === 4 && preview.eligibility.photos.every((p) => p.eligible),
    "eligibility: all 4 room perspectives eligible by default, none excluded",
    preview?.eligibility
  );
  reporter.assert(
    typeof preview?.estimate?.est_seconds_min === "number" && preview.estimate.photo_count === 4,
    "eligibility: a spend/time estimate is offered before confirmation",
    preview?.estimate
  );
  reporter.assert(preview?.batch === null, "eligibility: no batch exists before the owner confirms", preview?.batch);

  // Prove exclusion-by-default against the real route: relabel one photo as a
  // ceiling shot, confirm it drops out of the default selection, then restore.
  await admin.from("photos").update({ angle_type: "ceiling detail", label: "Ceiling view" }).eq("id", p3);
  const previewWithCeiling = await getBatch(roomId);
  const ceilingEntry = previewWithCeiling.eligibility.photos.find((p) => p.photo_id === p3);
  reporter.assert(
    previewWithCeiling.eligibility.eligible_count === 3 && ceilingEntry?.eligible === false && ceilingEntry?.reason === "ceiling",
    "eligibility: a ceiling photo is excluded from the default selection with a reason",
    { count: previewWithCeiling.eligibility.eligible_count, ceilingEntry }
  );
  await admin.from("photos").update({ angle_type: null, label: "Window wall showing all three windows" }).eq("id", p3);

  // --- 2. Rapid double-submit dedupes to one batch (forced fail on photo 3) --
  const bodyStart = JSON.stringify({ test_force_failure_photo_ids: [p2] });
  const [a, b] = await Promise.all([
    fetchJson(`${BASE_URL}/api/rooms/${roomId}/render-batch`, { method: "POST", body: bodyStart }),
    fetchJson(`${BASE_URL}/api/rooms/${roomId}/render-batch`, { method: "POST", body: bodyStart })
  ]);
  reporter.assert(a.body?.job?.id === b.body?.job?.id, "rapid double-submit: both resolve to one batch id", [a.body?.job?.id, b.body?.job?.id]);
  reporter.assert([a.body?.created, b.body?.created].filter(Boolean).length === 1, "rapid double-submit: exactly one created the batch", [a.body?.created, b.body?.created]);
  const batchJobId = a.body.job.id;

  const { count: batchCount } = await admin
    .from("generation_jobs")
    .select("id", { count: "exact", head: true })
    .eq("room_id", roomId)
    .eq("job_type", "batch_render");
  reporter.assert(batchCount === 1, "rapid double-submit: exactly one batch_render job row exists", batchCount);

  // --- 3. Batch completes on its own after the POST returned (browser-close) --
  const settledParent = await pollJob(roomId, batchJobId);
  reporter.assert(settledParent?.status === "completed", "durable batch: parent completes on its own (partial success)", settledParent);

  const afterBatch = await pollBatch(roomId, { until: (v) => !batchViewActive(v.batch) });
  const view = afterBatch.batch;
  reporter.assert(view?.completed === 3 && view?.failed === 1 && view?.total === 4, "partial batch: 3 of 4 complete, 1 to retry", { completed: view?.completed, failed: view?.failed, total: view?.total });

  const photo2View = view.photos.find((p) => p.photo_id === p2);
  reporter.assert(photo2View?.status === "retryable_failed", "partial batch: only photo 3 is retryable", photo2View);
  reporter.assert(
    ["completed"].includes(view.photos.find((p) => p.photo_id === p0)?.status) &&
      view.photos.find((p) => p.photo_id === p1)?.status === "completed" &&
      view.photos.find((p) => p.photo_id === p3)?.status === "completed",
    "partial batch: photos 1, 2, and 4 completed",
    view.photos.map((p) => [p.photo_id, p.status])
  );

  // Siblings intact at the DB level; photo 3 has no current render yet.
  let state = await getRoomState(roomId);
  const sibling0 = currentRenders(state, p0)[0];
  const sibling1 = currentRenders(state, p1)[0];
  const sibling3 = currentRenders(state, p3)[0];
  reporter.assert(sibling0 && sibling1 && sibling3, "partial batch: siblings each have exactly one current render", { s0: !!sibling0, s1: !!sibling1, s3: !!sibling3 });
  reporter.assert(currentRenders(state, p2).length === 0, "partial batch: the failed photo has no current render", currentRenders(state, p2));
  reporter.assert(
    [sibling0, sibling1, sibling3].every((r) => r.mood_board_version === boardToLock.version),
    "partial batch: sibling renders are stamped with the locked concept version",
    [sibling0, sibling1, sibling3].map((r) => r.mood_board_version)
  );
  const siblingIdsBefore = [sibling0.id, sibling1.id, sibling3.id].sort();

  // --- 4. Retry photo 3: completes it without regenerating siblings ----------
  const retry = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/render-batch/retry`, { method: "POST", body: JSON.stringify({ photo_ids: [p2] }) });
  reporter.assert(retry.status === 202 && retry.body?.retried_count === 1, "retry: photo 3 retry accepted", retry);
  await pollJob(roomId, photo2View.child_job_id, { until: (j) => j.status === "completed" || j.status === "terminal_failed" });

  const afterRetry = await pollBatch(roomId, { until: (v) => v.batch.completed === 4 });
  reporter.assert(afterRetry.batch.completed === 4 && afterRetry.batch.failed === 0, "retry: all four perspectives now complete", afterRetry.batch);

  state = await getRoomState(roomId);
  reporter.assert(currentRenders(state, p2).length === 1, "retry: photo 3 now has exactly one current render", currentRenders(state, p2));
  const siblingIdsAfter = [currentRenders(state, p0)[0]?.id, currentRenders(state, p1)[0]?.id, currentRenders(state, p3)[0]?.id].sort();
  reporter.assert(
    JSON.stringify(siblingIdsBefore) === JSON.stringify(siblingIdsAfter),
    "retry: siblings were NOT regenerated or staled (same current render ids)",
    { before: siblingIdsBefore, after: siblingIdsAfter }
  );

  // --- 5. Four linked current renders, one per photo, no duplicates ----------
  const allCurrent = [p0, p1, p2, p3].map((pid) => currentRenders(state, pid));
  reporter.assert(allCurrent.every((rs) => rs.length === 1), "four-photo batch: exactly one current render per photo (no duplicates)", allCurrent.map((rs) => rs.length));
  reporter.assert(
    allCurrent.flat().every((r) => r.mood_board_version === boardToLock.version),
    "four-photo batch: every current render is linked to the locked concept version",
    allCurrent.flat().map((r) => r.mood_board_version)
  );
  const distinctPhotos = new Set(allCurrent.flat().map((r) => r.source_photo_id));
  reporter.assert(distinctPhotos.size === 4, "four-photo batch: four distinct source photos rendered", [...distinctPhotos]);

  // --- 6. Consistency rubric passes across the four perspectives -------------
  const finalView = await getBatch(roomId);
  reporter.assert(
    finalView.batch.consistency?.passed === true && finalView.batch.consistency.evaluated_count === 4,
    "consistency: the four-perspective set passes the palette/anchor/art/material rubric",
    finalView.batch.consistency
  );

  // --- 7. No duplicate paid children: exactly 4 render children for the batch -
  const { count: childCount } = await admin
    .from("generation_jobs")
    .select("id", { count: "exact", head: true })
    .eq("room_id", roomId)
    .eq("job_type", "render");
  reporter.assert(childCount === 4, "concurrency/idempotency: exactly 4 render child jobs (one per photo, no duplicates)", childCount);
  reporter.assert(finalView.concurrency >= 1, "concurrency: a bounded concurrency is configured", finalView.concurrency);

  reporter.finish();
}

function batchViewActive(view) {
  if (!view) return false;
  const active = ["queued", "planning", "validating", "generating", "persisting"];
  if (active.includes(view.job.status)) return true;
  return view.photos.some((p) => p.status === "running" || p.status === "queued" || p.status === "pending");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
