import { createClient } from "@supabase/supabase-js";
import { loadTestEnv } from "../test-env.mjs";
import { BASE_URL, fetchJson, getRoomState, readCurrentTestRun, SuiteReporter, waitForServer, requireServerIsolation } from "./_lib.mjs";

/**
 * P0.1 Durable Generation Jobs — strict success gate
 * (docs/P0_P1_EXECUTION_PLAN_2026-07-10.md §P0.1).
 *
 * Proves the durable-job contract against a real seeded room via the app's own
 * routes, with a direct admin client used only to INJECT a crash (stale
 * heartbeat) — the one thing HTTP can't simulate. Assumes AI_MODE=mock and a
 * fresh `npm run seed:test`.
 *
 * Gate items proven here:
 *  - a queued mock job completes after the initiating request returns (the
 *    caller never holds the work open — same as the browser tab closing);
 *  - reopening the room shows the true current stage with no duplicate output;
 *  - two rapid submissions produce ONE logical job;
 *  - a crashed (stale) execution is reclaimed once and never loops forever;
 *  - completion always references a persisted artifact; failure never
 *    masquerades as complete.
 */

const reporter = new SuiteReporter("jobs");

// Admin client for crash injection only (mirrors seed-test's connection). The
// P0.0 guard in loadTestEnv() throws before this if isolation isn't satisfied.
loadTestEnv();
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const TERMINAL = ["completed", "terminal_failed", "cancelled"];

async function pollJob(roomId, jobId, { timeoutMs = 60000, intervalMs = 500, until } = {}) {
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

async function main() {
  await waitForServer();
  await requireServerIsolation();
  const { roomId } = readCurrentTestRun();
  console.log(`[jobs] room=${roomId}`);

  // --- Guard: table present --------------------------------------------
  const preflight = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/jobs`, { method: "GET" });
  reporter.assert(preflight.ok, "GET /jobs responds (generation_jobs table reachable)", preflight);

  // --- 1. Durable completion after the initiating request returns -------
  const create = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/jobs`, {
    method: "POST",
    body: JSON.stringify({ job_type: "diagnosis" })
  });
  reporter.assert(create.status === 202, "POST /jobs returns 202 (job accepted, work continues)", create);
  reporter.assert(create.body?.created === true, "first submission creates a new job", create.body);
  const jobId = create.body?.job?.id;
  reporter.assert(Boolean(jobId), "response carries a job id", create.body);
  reporter.assert(
    ["queued", "planning", "validating", "generating", "persisting", "completed"].includes(create.body?.job?.status),
    "job starts in a live status, not a failure",
    create.body?.job
  );

  // The caller (this request) is done; the job must finish on its own. This is
  // the "browser page closed" case — we only poll a *separate* status route.
  const settled = await pollJob(roomId, jobId);
  reporter.assert(settled?.status === "completed", "queued mock job completes on its own after the POST returned", settled);
  reporter.assert(
    Boolean(settled?.result_refs?.analysis_id),
    "completed job references a persisted analysis artifact (no complete-without-artifact)",
    settled?.result_refs
  );

  // --- 2. Reopen shows true stage, no duplicate output ------------------
  let state = await getRoomState(roomId);
  const currentDiagnoses = state.diagnoses.filter((d) => d.status === "current");
  reporter.assert(currentDiagnoses.length === 1, "exactly one current diagnosis after the job (no duplicate output)", state.diagnoses);
  const jobRow = (state.generation_jobs ?? []).find((j) => j.id === jobId);
  reporter.assert(jobRow?.status === "completed", "reopened room shows the job as completed", jobRow);
  reporter.assert(
    jobRow?.result_refs?.analysis_id === currentDiagnoses[0]?.id,
    "job artifact ref matches the current diagnosis row",
    { ref: jobRow?.result_refs, current: currentDiagnoses[0]?.id }
  );

  // --- 3. Two rapid submissions -> one logical job ----------------------
  const [a, b] = await Promise.all([
    fetchJson(`${BASE_URL}/api/rooms/${roomId}/jobs`, { method: "POST", body: JSON.stringify({ job_type: "diagnosis" }) }),
    fetchJson(`${BASE_URL}/api/rooms/${roomId}/jobs`, { method: "POST", body: JSON.stringify({ job_type: "diagnosis" }) })
  ]);
  const ids = [a.body?.job?.id, b.body?.job?.id];
  reporter.assert(ids[0] === ids[1], "two rapid submissions resolve to one job id", ids);
  const createdFlags = [a.body?.created, b.body?.created];
  reporter.assert(
    createdFlags.filter(Boolean).length === 1,
    "exactly one of the two rapid submissions created the job (the other deduped)",
    createdFlags
  );
  const rapidSettled = await pollJob(roomId, ids[0]);
  reporter.assert(rapidSettled?.status === "completed", "the single deduped job completes", rapidSettled);

  state = await getRoomState(roomId);
  const diagnosisJobs = (state.generation_jobs ?? []).filter((j) => j.job_type === "diagnosis");
  // Two POST rounds so far (round 1 + the rapid pair = 2 logical jobs), never 3.
  reporter.assert(diagnosisJobs.length === 2, "two logical diagnosis jobs exist despite three POSTs", diagnosisJobs.map((j) => j.id));

  // --- 4a. Crash reclaim: stale running job is reclaimed and completes --
  const crashCreate = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/jobs`, {
    method: "POST",
    body: JSON.stringify({ job_type: "diagnosis" })
  });
  const crashId = crashCreate.body?.job?.id;
  // Simulate a serverless kill mid-generation: stuck in `generating`, heartbeat
  // 5 minutes old, one attempt used, attempts remaining.
  await admin
    .from("generation_jobs")
    .update({
      status: "generating",
      stage: "reading the room",
      attempt_count: 1,
      heartbeat_at: new Date(Date.now() - 5 * 60_000).toISOString()
    })
    .eq("id", crashId);

  // A status read must reclaim it (queued) and reschedule; it then completes.
  const reclaimRead = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/jobs/${crashId}`);
  reporter.assert(
    reclaimRead.body?.reclaimed === true || reclaimRead.body?.job?.status === "queued" || reclaimRead.body?.job?.status === "completed",
    "reading a stale running job reclaims it",
    reclaimRead.body
  );
  const crashSettled = await pollJob(roomId, crashId);
  reporter.assert(crashSettled?.status === "completed", "reclaimed crashed job completes on a bounded retry", crashSettled);
  reporter.assert(crashSettled?.attempt_count <= crashSettled?.max_attempts, "attempts stay within max_attempts", crashSettled);

  // --- 4b. Exhausted attempts -> terminal, never an infinite loop -------
  const loopCreate = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/jobs`, {
    method: "POST",
    body: JSON.stringify({ job_type: "diagnosis" })
  });
  const loopId = loopCreate.body?.job?.id;
  // Stuck running, heartbeat old, attempts already exhausted.
  await admin
    .from("generation_jobs")
    .update({
      status: "generating",
      stage: "reading the room",
      attempt_count: 3,
      max_attempts: 3,
      heartbeat_at: new Date(Date.now() - 5 * 60_000).toISOString()
    })
    .eq("id", loopId);
  const loopRead = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/jobs/${loopId}`);
  reporter.assert(
    loopRead.body?.job?.status === "terminal_failed",
    "a stale job with no attempts left settles terminal, not looping",
    loopRead.body?.job
  );
  reporter.assert(loopRead.body?.job?.error_code === "stale_timeout", "terminal stale job carries stale_timeout error code", loopRead.body?.job);

  // --- 5. Retry a terminal job is refused (bounded, no loop) ------------
  const retryTerminal = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/jobs/${loopId}/retry`, { method: "POST" });
  reporter.assert(retryTerminal.status === 409, "retry of an exhausted terminal job is refused (409)", retryTerminal);

  // --- 6. Cancel a fresh job frees the slot -----------------------------
  const cancelCreate = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/jobs`, {
    method: "POST",
    body: JSON.stringify({ job_type: "diagnosis" })
  });
  const cancelId = cancelCreate.body?.job?.id;
  // Park it so it isn't already completed by the time we cancel.
  await admin.from("generation_jobs").update({ status: "queued", stage: "queued" }).eq("id", cancelId);
  const cancelResp = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/jobs/${cancelId}/cancel`, { method: "POST" });
  reporter.assert(
    cancelResp.body?.job?.status === "cancelled" || cancelResp.status === 409,
    "cancel settles the job (cancelled) or reports it already finished",
    cancelResp.body
  );

  // --- 7. Room scoping: a job is not readable under the wrong room ------
  const wrongRoom = "00000000-0000-0000-0000-0000000000ff";
  const scoped = await fetchJson(`${BASE_URL}/api/rooms/${wrongRoom}/jobs/${jobId}`);
  reporter.assert(scoped.status === 404, "a job is not readable under a different room id (room scoping)", scoped);

  reporter.finish();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
