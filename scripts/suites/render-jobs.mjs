import { BASE_URL, fetchJson, getRoomState, readCurrentTestRun, SuiteReporter, waitForServer, requireServerIsolation } from "./_lib.mjs";

/**
 * P0.2 Resilient Single-Photo Rendering — strict success gate
 * (docs/P0_P1_EXECUTION_PLAN_2026-07-10.md §P0.2).
 *
 * Self-contained from a fresh `npm run seed:test`: it bootstraps a locked
 * concept, then exercises the durable render job through the app's own routes.
 *
 * Two delivery paths, deliberately:
 *  - the async `POST /jobs` path (browser-close durability, idempotency, the
 *    10-consecutive no-duplicate run) — no fixtures, real durable execution;
 *  - the inline compat `POST /generate-render` path WITH fixture headers (the
 *    failure matrix), because request-scoped fixtures only fire inline.
 *
 * Requires AI_MODE=mock (fixtures are inert live) and production/test isolation.
 */

const reporter = new SuiteReporter("render-jobs");
const TERMINAL = ["completed", "terminal_failed", "cancelled"];

async function pollJob(roomId, jobId, { timeoutMs = 60000, intervalMs = 400, until } = {}) {
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

function currentRenders(state, photoId) {
  return (state.renders ?? []).filter((r) => r.source_photo_id === photoId && r.status === "current");
}

async function main() {
  await waitForServer();
  const { serverAiMode } = await requireServerIsolation();
  if (serverAiMode !== "mock") {
    throw new Error(`render-jobs requires an AI_MODE=mock server (got ${serverAiMode}).`);
  }
  const { roomId } = readCurrentTestRun();
  console.log(`[render-jobs] room=${roomId}`);

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
  const photoId = photosResp.body.photos[0].id;

  // --- 1. Durable render completes AFTER the POST returns (browser-close) -----
  const create = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/jobs`, {
    method: "POST",
    body: JSON.stringify({ job_type: "render", payload: { source_photo_id: photoId } })
  });
  reporter.assert(create.status === 202 && create.body?.created === true, "durable render: POST /jobs returns 202 created", create);
  const jobId = create.body?.job?.id;
  const settled = await pollJob(roomId, jobId);
  reporter.assert(settled?.status === "completed", "durable render: job completes on its own after the POST returned", settled);
  const renderId = settled?.result_refs?.render_id;
  reporter.assert(Boolean(renderId), "durable render: completed job references a persisted render artifact", settled?.result_refs);

  let state = await getRoomState(roomId);
  const cur = currentRenders(state, photoId);
  reporter.assert(cur.length === 1, "durable render: exactly one current render for the photo", cur);
  reporter.assert(cur[0]?.id === renderId, "durable render: current render id matches the job artifact ref", { ref: renderId, current: cur[0]?.id });
  reporter.assert(cur[0]?.mood_board_version === boardToLock.version, "durable render: render is stamped with the locked concept version", cur[0]);

  // --- 2. Two rapid submissions -> one logical job ---------------------------
  const [a, b] = await Promise.all([
    fetchJson(`${BASE_URL}/api/rooms/${roomId}/jobs`, { method: "POST", body: JSON.stringify({ job_type: "render", payload: { source_photo_id: photoId, instructions: "rapid" } }) }),
    fetchJson(`${BASE_URL}/api/rooms/${roomId}/jobs`, { method: "POST", body: JSON.stringify({ job_type: "render", payload: { source_photo_id: photoId, instructions: "rapid" } }) })
  ]);
  reporter.assert(a.body?.job?.id === b.body?.job?.id, "two rapid renders resolve to one job id", [a.body?.job?.id, b.body?.job?.id]);
  reporter.assert([a.body?.created, b.body?.created].filter(Boolean).length === 1, "exactly one of the two rapid renders created the job", [a.body?.created, b.body?.created]);
  const rapidSettled = await pollJob(roomId, a.body.job.id);
  reporter.assert(rapidSettled?.status === "completed", "the single deduped render job completes", rapidSettled);
  state = await getRoomState(roomId);
  reporter.assert(currentRenders(state, photoId).length === 1, "after rapid pair: still exactly one current render", currentRenders(state, photoId));

  // --- 3. Ten consecutive mock renders, no duplicate current artifacts -------
  const beforeTen = (await getRoomState(roomId)).renders.filter((r) => r.source_photo_id === photoId).length;
  let allSingleCurrent = true;
  for (let i = 0; i < 10; i += 1) {
    const c = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/jobs`, {
      method: "POST",
      body: JSON.stringify({ job_type: "render", payload: { source_photo_id: photoId, instructions: `consecutive ${i}` } })
    });
    const s = await pollJob(roomId, c.body.job.id);
    if (s?.status !== "completed") allSingleCurrent = false;
    const st = await getRoomState(roomId);
    if (currentRenders(st, photoId).length !== 1) allSingleCurrent = false;
  }
  reporter.assert(allSingleCurrent, "10 consecutive renders each complete with exactly one current at every step", allSingleCurrent);
  state = await getRoomState(roomId);
  const afterTen = state.renders.filter((r) => r.source_photo_id === photoId).length;
  reporter.assert(afterTen === beforeTen + 10, "10 consecutive renders create exactly 10 new render rows (no duplicates)", { beforeTen, afterTen });
  reporter.assert(currentRenders(state, photoId).length === 1, "after 10 renders: exactly one current render remains", currentRenders(state, photoId));

  // --- 4. Failure matrix via the inline compat route (fixtures fire inline) --
  const baselineCurrent = currentRenders(await getRoomState(roomId), photoId)[0];

  // (a) Render Critic timeout — the exact July-10 class: recoverable, never a
  //     silent pass, no image generated.
  const criticTimeout = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/generate-render`, {
    method: "POST",
    body: JSON.stringify({ source_photo_id: photoId, instructions: "critic-timeout case" }),
    headers: { "x-test-failure-fixture": "critic_timeout" }
  });
  reporter.assert(
    criticTimeout.status === 502 && criticTimeout.body?.error_code === "render_critic_unavailable",
    "critic_timeout: recoverable failure (render_critic_unavailable), not a silent pass",
    criticTimeout
  );
  let after = currentRenders(await getRoomState(roomId), photoId);
  reporter.assert(after.length === 1 && after[0]?.id === baselineCurrent?.id, "critic_timeout: no new render; prior current untouched", after);

  // (b) Critic finds a door/path violation — actionable DESIGN failure, no image.
  const criticReject = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/generate-render`, {
    method: "POST",
    body: JSON.stringify({ source_photo_id: photoId, instructions: "design-violation case" }),
    headers: { "x-test-failure-fixture": "critic_rejection" }
  });
  reporter.assert(
    criticReject.status === 422 && criticReject.body?.error_code === "render_design_violation",
    "critic_rejection: blocking design violation -> actionable design failure (422), no image",
    criticReject
  );
  after = currentRenders(await getRoomState(roomId), photoId);
  reporter.assert(after.length === 1 && after[0]?.id === baselineCurrent?.id, "critic_rejection: no image generated; prior current untouched", after);

  // (c) DB insert fails AFTER the image exists — prior current preserved, image
  //     checkpointed, and a retry completes WITHOUT regenerating a paid image.
  const dbFail = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/generate-render`, {
    method: "POST",
    body: JSON.stringify({ source_photo_id: photoId, instructions: "persist-fail case" }),
    headers: { "x-test-failure-fixture": "db_persist_failure" }
  });
  reporter.assert(dbFail.body?.error_code === "db_persist_failure", "db_persist_failure: surfaced with its error code", dbFail);
  const dbJobId = dbFail.body?.job_id;
  after = currentRenders(await getRoomState(roomId), photoId);
  reporter.assert(after.length === 1 && after[0]?.id === baselineCurrent?.id, "db_persist_failure: prior current render untouched (defect fixed)", after);

  const failedJob = (await fetchJson(`${BASE_URL}/api/rooms/${roomId}/jobs/${dbJobId}`)).body?.job;
  reporter.assert(failedJob?.status === "retryable_failed", "db_persist_failure: job is recoverable (retryable_failed)", failedJob);
  reporter.assert(
    failedJob?.result_refs?.image_ready === true && Boolean(failedJob?.result_refs?.image_url),
    "db_persist_failure: image was checkpointed BEFORE the persist failure (a retry won't regenerate a paid image)",
    failedJob?.result_refs
  );

  const retry = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/jobs/${dbJobId}/retry`, { method: "POST" });
  reporter.assert(retry.status === 202, "db_persist_failure: retry is accepted", retry);
  const retried = await pollJob(roomId, dbJobId);
  reporter.assert(retried?.status === "completed", "db_persist_failure: retry completes and persists the render", retried);
  after = currentRenders(await getRoomState(roomId), photoId);
  reporter.assert(
    after.length === 1 && after[0]?.id === retried?.result_refs?.render_id,
    "db_persist_failure: after retry, exactly one current render — the recovered one",
    { after, ref: retried?.result_refs?.render_id }
  );

  reporter.finish();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
