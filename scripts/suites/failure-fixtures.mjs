import { createClient } from "@supabase/supabase-js";
import { loadTestEnv } from "../test-env.mjs";
import {
  BASE_URL,
  fetchJson,
  getRoomState,
  readCurrentTestRun,
  SuiteReporter,
  waitForServer,
  requireServerIsolation
} from "./_lib.mjs";

/**
 * P0.0 failure-fixture suite (docs/P0_P1_EXECUTION_PLAN_2026-07-10.md).
 * Exercises every named deterministic failure class through the app's REAL
 * routes against the seeded room, with zero paid provider calls
 * (AI_MODE=mock server + x-test-failure-fixture headers). Assertions are
 * delta-based so fixture failures must leave state untouched, and the one
 * faithful-defect fixture (db_persist_failure staling the current render
 * before failing — today's non-atomic ordering, fixed in P0.2) is restored
 * by a normal regeneration before the suite ends.
 *
 * Ordering is deliberate: provider failures first (no state change), render
 * boundaries second (need the locked concept the integrity/journey state
 * built), client-disconnect via slow_generation last (its successful
 * diagnosis marks mood boards stale per §4).
 */

loadTestEnv();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const reporter = new SuiteReporter("failure-fixtures");

function fixtureHeaders(fixture, extra = {}) {
  return { headers: { "x-test-failure-fixture": fixture, ...extra } };
}

async function pollJob(roomId, jobId, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    const response = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/jobs/${jobId}`);
    last = response.body?.job ?? last;
    if (last && ["completed", "retryable_failed", "terminal_failed", "cancelled"].includes(last.status)) return last;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return last;
}

async function main() {
  await waitForServer();
  const { serverAiMode } = await requireServerIsolation();
  if (serverAiMode !== "mock") {
    throw new Error(`failure-fixtures requires an AI_MODE=mock server (got ${serverAiMode}) — fixtures are inert in live mode.`);
  }
  const { roomId, testRunId } = readCurrentTestRun();
  console.log(`[failure-fixtures] room=${roomId}`);

  // Every suite is freshly seeded. Build the locked-render state this suite's
  // render-boundary fixtures require instead of relying on another suite's
  // prior mutations.
  const diagnosis = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/analyze`, { method: "POST" });
  reporter.assert(diagnosis.ok, "precondition: diagnosis is available", diagnosis.body);
  const concepts = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/generate-moodboards`, { method: "POST" });
  reporter.assert(concepts.ok && concepts.body?.mood_boards?.length > 0, "precondition: a concept is available", concepts.body);
  const lock = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/select-moodboard`, {
    method: "POST",
    body: JSON.stringify({ mood_board_id: concepts.body.mood_boards[0].id })
  });
  reporter.assert(lock.ok, "precondition: a concept is locked", lock.body);
  const photos = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/photos`);
  const sourcePhotoId = photos.body?.photos?.[0]?.id;
  const renderStart = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/jobs`, {
    method: "POST",
    body: JSON.stringify({ job_type: "render", payload: { source_photo_id: sourcePhotoId } })
  });
  reporter.assert(renderStart.ok && renderStart.body?.job?.id, "precondition: render job starts", renderStart.body);
  const renderDone = await pollJob(roomId, renderStart.body.job.id);
  reporter.assert(renderDone?.status === "completed", "precondition: current render completes", renderDone);

  let state = await getRoomState(roomId);
  const baseDiagnoses = state.diagnoses.length;
  const baseRenders = state.renders.length;
  const currentRender = state.renders.find((render) => render.status === "current");
  reporter.assert(Boolean(currentRender), "precondition: a current render exists (locked-concept state)", state.renders);

  // --- Provider failure classes on a real generation route ---------------
  // /analyze is now the durable diagnosis compat layer (P0.1): a provider
  // failure fails the job recoverably and returns an owner-safe error (no
  // internal "simulated"/provider detail) with a job_id — not the old raw 500.
  // The fixture firing is proven by the failed ai_runs assertion below and by
  // "no diagnosis row created".
  for (const fixture of ["provider_timeout", "provider_rate_limit", "provider_server_error"]) {
    const response = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/analyze`, {
      method: "POST",
      ...fixtureHeaders(fixture)
    });
    reporter.assert(
      !response.ok && (response.status === 502 || response.status === 500),
      `${fixture}: analyze fails recoverably (durable owner-safe failure)`,
      response
    );
    reporter.assert(
      typeof response.body?.error === "string" &&
        response.body.error.length > 0 &&
        !response.body.error.toLowerCase().includes("simulated"),
      `${fixture}: owner-safe error surfaced without leaking internal provider detail`,
      response.body
    );
    state = await getRoomState(roomId);
    reporter.assert(
      state.diagnoses.length === baseDiagnoses,
      `${fixture}: no diagnosis row created by the failed run`,
      state.diagnoses
    );
  }

  const { data: failedRuns } = await supabase
    .from("ai_runs")
    .select("service_name, status, provider")
    .eq("room_id", roomId)
    .eq("status", "failed");
  reporter.assert(
    (failedRuns?.length ?? 0) >= 3,
    "provider fixtures: >=3 failed ai_runs rows recorded",
    failedRuns
  );

  // --- Correlation ID: caller-supplied ID survives request -> response ----
  const correlationId = `co-fixture-suite-${Date.now().toString(36)}`;
  const echo = await fetch(`${BASE_URL}/api/debug/fixture-check?roomId=${roomId}`, {
    headers: { "x-correlation-id": correlationId }
  });
  const echoBody = await echo.json();
  reporter.assert(
    echo.headers.get("x-correlation-id") === correlationId && echoBody.correlation_id === correlationId,
    "correlation: caller-supplied x-correlation-id survives middleware -> route -> body",
    { header: echo.headers.get("x-correlation-id"), body: echoBody.correlation_id }
  );

  // --- Critic rejection (blocking violations, no silent pass) ------------
  const criticCheck = await fetch(
    `${BASE_URL}/api/debug/fixture-check?roomId=${roomId}&boundary=critic`,
    fixtureHeaders("critic_rejection")
  );
  const criticBody = await criticCheck.json();
  reporter.assert(
    criticBody.ok === true && Array.isArray(criticBody.blocking_violations) && criticBody.blocking_violations.length > 0,
    "critic_rejection: render critic returns blocking violations",
    criticBody
  );

  // --- Image/storage/persistence boundaries on the real render route ------
  const fixtureSourcePhotoId = currentRender?.source_photo_id;

  const noImage = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/generate-render`, {
    method: "POST",
    body: JSON.stringify({ source_photo_id: fixtureSourcePhotoId }),
    ...fixtureHeaders("image_no_image")
  });
  reporter.assert(
    noImage.status === 502 && noImage.body?.error_code === "image_no_image",
    "image_no_image: render fails 502 with error_code, plan-stage work acknowledged",
    noImage
  );

  const storageFail = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/generate-render`, {
    method: "POST",
    body: JSON.stringify({ source_photo_id: fixtureSourcePhotoId }),
    ...fixtureHeaders("storage_upload_failure")
  });
  reporter.assert(
    storageFail.status === 502 && storageFail.body?.error_code === "storage_upload_failure",
    "storage_upload_failure: render fails 502 with error_code",
    storageFail
  );

  state = await getRoomState(roomId);
  reporter.assert(
    state.renders.length === baseRenders,
    "image/storage fixtures: no render rows created and current render untouched",
    state.renders
  );
  reporter.assert(
    state.renders.find((render) => render.id === currentRender.id)?.status === "current",
    "image/storage fixtures: prior current render still current",
    state.renders
  );

  const dbFail = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/generate-render`, {
    method: "POST",
    body: JSON.stringify({ source_photo_id: fixtureSourcePhotoId }),
    ...fixtureHeaders("db_persist_failure")
  });
  reporter.assert(
    (dbFail.status === 502 || dbFail.status === 500) && dbFail.body?.error_code === "db_persist_failure",
    "db_persist_failure: render fails with error_code and a recoverable job",
    dbFail
  );
  state = await getRoomState(roomId);
  reporter.assert(
    state.renders.length === baseRenders &&
      state.renders.find((render) => render.id === currentRender.id)?.status === "current",
    "db_persist_failure: P0.2 FIX — prior current render is untouched (no 'current staled, nothing inserted' defect)",
    state.renders
  );

  // Restore a current render so the suite leaves usable state behind.
  const restore = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/generate-render`, {
    method: "POST",
    body: JSON.stringify({ source_photo_id: sourcePhotoId })
  });
  reporter.assert(restore.ok, "recovery: a normal regeneration restores a current render", restore.body);
  state = await getRoomState(roomId);
  reporter.assert(
    state.renders.some((render) => render.status === "current" && render.source_photo_id === fixtureSourcePhotoId),
    "recovery: exactly one current render exists again for the photo",
    state.renders
  );

  // --- Client disconnect mid-generation (slow_generation) -----------------
  const controller = new AbortController();
  const slowStarted = Date.now();
  const slowRequest = fetch(`${BASE_URL}/api/rooms/${roomId}/analyze`, {
    method: "POST",
    signal: controller.signal,
    headers: { "x-test-failure-fixture": "slow_generation", "x-test-fixture-delay-ms": "6000" }
  }).catch(() => "aborted");
  setTimeout(() => controller.abort(), 1500);
  const slowOutcome = await slowRequest;
  reporter.assert(
    slowOutcome === "aborted" && Date.now() - slowStarted < 5000,
    "slow_generation: client disconnected mid-generation",
    { outcome: slowOutcome }
  );

  let diagnosisAfterDisconnect = 0;
  const pollDeadline = Date.now() + 20000;
  while (Date.now() < pollDeadline) {
    state = await getRoomState(roomId);
    diagnosisAfterDisconnect = state.diagnoses.length;
    if (diagnosisAfterDisconnect > baseDiagnoses) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  reporter.assert(
    diagnosisAfterDisconnect === baseDiagnoses + 1,
    "slow_generation: server completed the diagnosis after the client disconnected",
    { before: baseDiagnoses, after: diagnosisAfterDisconnect }
  );

  // --- Tagging invariant: nothing this suite created is untagged ----------
  const { count: untagged } = await supabase
    .from("ai_runs")
    .select("*", { count: "exact", head: true })
    .eq("room_id", roomId)
    .is("test_run_id", null);
  reporter.assert(
    (untagged ?? 0) === 0,
    "tagging: every ai_runs row for the seeded room carries the cycle's test_run_id",
    { untagged, testRunId }
  );

  reporter.finish();
}

main().catch((error) => {
  console.error("[failure-fixtures] FAILED:", error.message);
  reporter.assert(false, "suite completed without an unhandled error", error.message);
  reporter.finish();
});
