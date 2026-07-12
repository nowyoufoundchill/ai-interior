import { createClient } from "@supabase/supabase-js";
import { loadTestEnv } from "../test-env.mjs";
import { BASE_URL, fetchJson, getRoomState, readCurrentTestRun, SuiteReporter, waitForServer, requireServerIsolation } from "./_lib.mjs";

/**
 * P0.4 Confirmed Chat-to-Action Execution — strict success gate
 * (docs/P0_P1_EXECUTION_PLAN_2026-07-10.md §P0.4).
 *
 * Self-contained from a fresh `npm run seed:test` (a 4-photo office). Bootstraps
 * a locked concept + one render, then drives the seven required scenarios through
 * the app's own routes, asserting the gate at every boundary:
 *
 *   - a chat turn NEVER mutates an artifact before explicit confirmation;
 *   - confirming a proposal starts exactly ONE durable job carrying the
 *     normalized instructions the owner saw, and cannot be replayed;
 *   - the completed artifact is linked back into the SAME thread;
 *   - a question stays a question (no proposal / no action controls);
 *   - an ambiguous request becomes a clarification with no Apply control;
 *   - dismiss + restate works and a dismissed proposal can't be confirmed;
 *   - confirm → provider failure → retry recovers without premature mutation;
 *   - invalidation previews match the executable integrity table.
 *
 * Requires AI_MODE=mock (the forced-failure hook is inert live) + isolation.
 */

loadTestEnv();
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const reporter = new SuiteReporter("chat-actions");
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

async function chat(roomId, message) {
  return fetchJson(`${BASE_URL}/api/rooms/${roomId}/chat`, { method: "POST", body: JSON.stringify({ message }) });
}

async function confirm(roomId, proposalId, body = {}) {
  return fetchJson(`${BASE_URL}/api/rooms/${roomId}/proposals/${proposalId}/confirm`, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

function currentRenders(state, photoId) {
  return (state.renders ?? []).filter((r) => r.source_photo_id === photoId && r.status === "current");
}

function currentRenderId(state, photoId) {
  return currentRenders(state, photoId)[0]?.id ?? null;
}

async function main() {
  await waitForServer();
  const { serverAiMode } = await requireServerIsolation();
  if (serverAiMode !== "mock") {
    throw new Error(`chat-actions requires an AI_MODE=mock server (got ${serverAiMode}).`);
  }
  const { roomId } = readCurrentTestRun();
  console.log(`[chat-actions] room=${roomId}`);

  // --- Bootstrap: diagnosis -> concepts -> lock -> one render ----------------
  const analyze = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/analyze`, { method: "POST" });
  reporter.assert(analyze.ok, "bootstrap: diagnosis succeeds", analyze.body);
  const concepts = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/generate-moodboards`, { method: "POST" });
  reporter.assert(concepts.ok && concepts.body?.mood_boards?.length >= 1, "bootstrap: concepts generated", concepts.body);
  const boardToLock = concepts.body.mood_boards[0];
  const lock = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/select-moodboard`, {
    method: "POST",
    body: JSON.stringify({ mood_board_id: boardToLock.id })
  });
  reporter.assert(lock.ok, "bootstrap: a concept is locked", lock.body);

  const photosResp = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/photos`);
  const photos = photosResp.body.photos;
  const [p0] = photos.map((p) => p.id);

  const seedRender = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/jobs`, {
    method: "POST",
    body: JSON.stringify({ job_type: "render", payload: { source_photo_id: p0 } })
  });
  reporter.assert(seedRender.ok, "bootstrap: seed render job created", seedRender.body);
  const seedSettled = await pollJob(roomId, seedRender.body.job.id);
  reporter.assert(seedSettled?.status === "completed", "bootstrap: seed render completes", seedSettled);

  // Preflight: P0.4 requires migration 009 (action_proposals) to be live in the
  // API. If the app can't persist a proposal, fail fast with a clear message
  // instead of dereferencing a null proposal downstream — the whole gate is
  // blocked on the schema, not on the scenarios.
  const preflight = await chat(roomId, "Replace the ocean artwork with a calm sky painting across all renders");
  if (!preflight.ok || !preflight.body?.proposal) {
    reporter.assert(
      false,
      "preflight: chat surfaces a structured proposal (requires migration 009 / action_proposals live in the API)",
      preflight.body?.proposal ?? preflight.body
    );
    reporter.finish();
    return;
  }
  // The preflight created a real proposed proposal; dismiss it so it doesn't
  // perturb the scenario counts below (teardown would clean it either way).
  await fetchJson(`${BASE_URL}/api/rooms/${roomId}/proposals/${preflight.body.proposal.id}/dismiss`, { method: "POST" });

  // ========================================================================
  // Scenario 4 — a question stays a question (no proposal, no mutation).
  // ========================================================================
  let state = await getRoomState(roomId);
  const rendersBeforeQuestion = (state.renders ?? []).length;
  const proposalsBeforeQuestion = (state.action_proposals ?? []).length;
  const chatMsgsBeforeQuestion = (state.chat_messages ?? []).length;

  const question = await chat(roomId, "Why did you choose this palette for the room?");
  reporter.assert(question.ok, "S4 question: chat responds", question.body);
  reporter.assert(question.body?.proposal == null, "S4 question: a question produces NO action proposal", question.body?.proposal);

  state = await getRoomState(roomId);
  reporter.assert(
    (state.action_proposals ?? []).length === proposalsBeforeQuestion,
    "S4 question: no proposal persisted for a question",
    { before: proposalsBeforeQuestion, after: (state.action_proposals ?? []).length }
  );
  reporter.assert(
    (state.renders ?? []).length === rendersBeforeQuestion,
    "S4 question: no artifact mutated by a question",
    { before: rendersBeforeQuestion, after: (state.renders ?? []).length }
  );
  reporter.assert(
    (state.chat_messages ?? []).length === chatMsgsBeforeQuestion + 2,
    "S4 question: the exchange is recorded (user + designer)",
    { before: chatMsgsBeforeQuestion, after: (state.chat_messages ?? []).length }
  );

  // ========================================================================
  // Scenario 5 — ambiguous request → clarification, NOT a guess (no Apply).
  // ========================================================================
  const rendersBeforeVague = (await getRoomState(roomId)).renders.length;
  const vague = await chat(roomId, "Can you make it better?");
  reporter.assert(vague.ok && vague.body?.proposal, "S5 ambiguous: a proposal card is returned", vague.body);
  reporter.assert(
    vague.body.proposal.intent_type === "clarification",
    "S5 ambiguous: intent is clarification (not a guessed mutation)",
    vague.body.proposal.intent_type
  );
  reporter.assert(
    Boolean(vague.body.proposal.clarifying_question),
    "S5 ambiguous: a clarifying question is asked",
    vague.body.proposal.clarifying_question
  );
  // A clarification is not confirmable — proves it carries no misleading Apply.
  const confirmVague = await confirm(roomId, vague.body.proposal.id);
  reporter.assert(confirmVague.status === 400, "S5 ambiguous: a clarification cannot be confirmed", confirmVague.status);
  reporter.assert(
    (await getRoomState(roomId)).renders.length === rendersBeforeVague,
    "S5 ambiguous: nothing was mutated",
    { before: rendersBeforeVague }
  );

  // ========================================================================
  // Scenario 1 — replace ocean art with sky art across ALL renders.
  //   Proves: no mutation before confirm; one job with the shown instructions;
  //   no replay; result linked into the thread; invalidation matches preview.
  // ========================================================================
  state = await getRoomState(roomId);
  const renderIdsBeforeS1 = new Set((state.renders ?? []).map((r) => r.id));

  const s1 = await chat(roomId, "Replace the ocean artwork with a calm sky painting across all renders");
  reporter.assert(s1.ok && s1.body?.proposal, "S1 all-render: proposal returned", s1.body);
  const p1proposal = s1.body.proposal;
  reporter.assert(p1proposal.intent_type === "render_revision", "S1 all-render: intent render_revision", p1proposal.intent_type);
  reporter.assert(p1proposal.scope === "all_perspectives", "S1 all-render: scope all_perspectives", p1proposal.scope);
  reporter.assert(p1proposal.status === "proposed", "S1 all-render: proposal starts as proposed", p1proposal.status);

  // No mutation before confirm.
  state = await getRoomState(roomId);
  reporter.assert(
    (state.renders ?? []).every((r) => renderIdsBeforeS1.has(r.id)),
    "S1 all-render: NO render is created or changed before confirmation",
    (state.renders ?? []).filter((r) => !renderIdsBeforeS1.has(r.id)).map((r) => r.id)
  );

  const preCount = await countChatActionJobs(roomId);
  const s1confirm = await confirm(roomId, p1proposal.id);
  reporter.assert(s1confirm.status === 202 && s1confirm.body?.job?.id, "S1 all-render: confirm starts a durable job", s1confirm.body);
  const s1jobId = s1confirm.body.job.id;

  // No replay: a second confirm (or a refresh re-POST) resolves to the SAME job.
  const s1replay = await confirm(roomId, p1proposal.id);
  reporter.assert(
    s1replay.body?.job?.id === s1jobId && s1replay.body?.created === false,
    "S1 all-render: re-confirm does NOT replay — same job, created:false",
    { first: s1jobId, second: s1replay.body?.job?.id, created: s1replay.body?.created }
  );

  const s1settled = await pollJob(roomId, s1jobId);
  reporter.assert(s1settled?.status === "completed", "S1 all-render: the chat_action job completes", s1settled);

  const postCount = await countChatActionJobs(roomId);
  reporter.assert(postCount === preCount + 1, "S1 all-render: exactly ONE chat_action job was created", { preCount, postCount });

  // The job carries the exact normalized instructions the owner saw.
  const { data: s1job } = await admin.from("generation_jobs").select("request_payload").eq("id", s1jobId).single();
  reporter.assert(
    s1job?.request_payload?.instructions === p1proposal.normalized_instructions,
    "S1 all-render: the job runs the normalized instructions shown to the owner",
    { job: s1job?.request_payload?.instructions, proposal: p1proposal.normalized_instructions }
  );

  // Result linked back into the same thread + proposal applied.
  const { data: s1prop } = await admin.from("action_proposals").select("*").eq("id", p1proposal.id).single();
  reporter.assert(s1prop?.status === "applied", "S1 all-render: proposal is marked applied", s1prop?.status);
  reporter.assert(Boolean(s1prop?.result_message_id), "S1 all-render: a result message id is linked to the proposal", s1prop?.result_message_id);
  const { data: resultMsg } = await admin.from("chat_messages").select("*").eq("id", s1prop.result_message_id).single();
  reporter.assert(resultMsg?.role === "assistant", "S1 all-render: the result is an assistant message in the thread", resultMsg?.role);
  const linkedRenderIds = Array.isArray(resultMsg?.referenced_artifact_ids) ? resultMsg.referenced_artifact_ids : [];
  reporter.assert(linkedRenderIds.length >= 1, "S1 all-render: the result message references the produced renders", linkedRenderIds);

  // Invalidation matches the preview: each affected photo has exactly one current
  // render, the prior render for the seed photo is now stale, all on locked ver.
  state = await getRoomState(roomId);
  const eligiblePhotoIds = photos.map((p) => p.id);
  const perPhotoCurrent = eligiblePhotoIds.map((pid) => currentRenders(state, pid).length);
  reporter.assert(perPhotoCurrent.every((n) => n === 1), "S1 all-render: exactly one current render per perspective (invalidation preview holds)", perPhotoCurrent);
  reporter.assert(
    currentRenders(state, p0).length === 1 && (state.renders ?? []).some((r) => r.source_photo_id === p0 && r.status === "stale"),
    "S1 all-render: the seed render for p0 was replaced (prior render staled, not deleted)",
    (state.renders ?? []).filter((r) => r.source_photo_id === p0).map((r) => r.status)
  );
  reporter.assert(
    eligiblePhotoIds.every((pid) => currentRenders(state, pid)[0]?.mood_board_version === boardToLock.version),
    "S1 all-render: every new render is linked to the locked concept version",
    eligiblePhotoIds.map((pid) => currentRenders(state, pid)[0]?.mood_board_version)
  );

  // ========================================================================
  // Scenario 3 — retain an existing chair EVERYWHERE (all-scope preservation).
  // ========================================================================
  const s3 = await chat(roomId, "Keep the existing accent chair in every perspective");
  reporter.assert(
    s3.ok && s3.body?.proposal?.intent_type === "render_revision" && s3.body.proposal.scope === "all_perspectives",
    "S3 retain-everywhere: render_revision across all perspectives",
    s3.body?.proposal
  );
  const s3confirm = await confirm(roomId, s3.body.proposal.id);
  const s3settled = await pollJob(roomId, s3confirm.body.job.id);
  reporter.assert(s3settled?.status === "completed", "S3 retain-everywhere: applies across the set", s3settled);
  const { data: s3prop } = await admin.from("action_proposals").select("status, result_message_id").eq("id", s3.body.proposal.id).single();
  reporter.assert(s3prop?.status === "applied" && s3prop.result_message_id, "S3 retain-everywhere: applied + linked into thread", s3prop);

  // ========================================================================
  // Scenario 2 — warm wall color on ONE perspective only.
  // ========================================================================
  state = await getRoomState(roomId);
  const s2 = await chat(roomId, "Make the wall color warmer on this one perspective only");
  reporter.assert(
    s2.ok && s2.body?.proposal?.scope === "one_perspective",
    "S2 one-perspective: scope one_perspective",
    s2.body?.proposal
  );
  const targetPhoto = Array.isArray(s2.body.proposal.scope_photo_ids) ? s2.body.proposal.scope_photo_ids[0] : null;
  reporter.assert(Boolean(targetPhoto), "S2 one-perspective: a single target perspective is named", s2.body.proposal.scope_photo_ids);
  const siblingIds = photos.map((p) => p.id).filter((pid) => pid !== targetPhoto);
  const targetBefore = currentRenderId(state, targetPhoto);
  const siblingsBefore = siblingIds.map((pid) => currentRenderId(state, pid));

  const s2confirm = await confirm(roomId, s2.body.proposal.id);
  const s2settled = await pollJob(roomId, s2confirm.body.job.id);
  reporter.assert(s2settled?.status === "completed", "S2 one-perspective: applies", s2settled);

  state = await getRoomState(roomId);
  reporter.assert(
    currentRenderId(state, targetPhoto) && currentRenderId(state, targetPhoto) !== targetBefore,
    "S2 one-perspective: the targeted perspective got a NEW current render",
    { before: targetBefore, after: currentRenderId(state, targetPhoto) }
  );
  reporter.assert(
    siblingIds.every((pid, i) => currentRenderId(state, pid) === siblingsBefore[i]),
    "S2 one-perspective: the OTHER perspectives were untouched",
    { before: siblingsBefore, after: siblingIds.map((pid) => currentRenderId(state, pid)) }
  );

  // ========================================================================
  // Scenario 6 — dismiss, then restate. A dismissed proposal can't be confirmed.
  // ========================================================================
  const s6a = await chat(roomId, "Change the rug to a natural jute rug across all renders");
  const propA = s6a.body.proposal.id;
  const dismiss = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/proposals/${propA}/dismiss`, { method: "POST" });
  reporter.assert(dismiss.ok && dismiss.body?.dismissed, "S6 dismiss: the proposal is dismissed", dismiss.body);
  const confirmDismissed = await confirm(roomId, propA);
  reporter.assert(confirmDismissed.status === 409, "S6 dismiss: a dismissed proposal cannot be confirmed", confirmDismissed.status);
  const { data: propArow } = await admin.from("action_proposals").select("status").eq("id", propA).single();
  reporter.assert(propArow?.status === "rejected", "S6 dismiss: dismissed proposal is rejected (kept in history)", propArow?.status);

  const s6b = await chat(roomId, "Change the rug to a natural jute rug across all renders");
  const propB = s6b.body.proposal.id;
  reporter.assert(propB !== propA && s6b.body.proposal.status === "proposed", "S6 restate: a fresh proposal is created", { propA, propB });
  const s6bConfirm = await confirm(roomId, propB);
  const s6bSettled = await pollJob(roomId, s6bConfirm.body.job.id);
  reporter.assert(s6bSettled?.status === "completed", "S6 restate: the restated proposal applies", s6bSettled);

  // ========================================================================
  // Scenario 7 — confirm → provider failure → retry (no premature mutation).
  // ========================================================================
  state = await getRoomState(roomId);
  const s7 = await chat(roomId, "Recolor the accent wall to sage green on this one perspective only");
  reporter.assert(s7.body?.proposal?.scope === "one_perspective", "S7 failure+retry: one_perspective proposal", s7.body?.proposal);
  const s7photo = s7.body.proposal.scope_photo_ids[0];
  const s7before = currentRenderId(state, s7photo);

  const s7confirm = await confirm(roomId, s7.body.proposal.id, { test_force_failure_photo_ids: [s7photo] });
  reporter.assert(s7confirm.status === 202, "S7 failure+retry: confirm starts the job", s7confirm.body);
  const s7jobId = s7confirm.body.job.id;
  const s7failed = await pollJob(roomId, s7jobId, { until: (j) => j.status === "retryable_failed" || TERMINAL.includes(j.status) });
  reporter.assert(s7failed?.status === "retryable_failed", "S7 failure+retry: the forced provider failure is recoverable (retryable)", s7failed);

  // No premature mutation: the target's current render is unchanged by the failure.
  state = await getRoomState(roomId);
  reporter.assert(currentRenderId(state, s7photo) === s7before, "S7 failure+retry: the failed attempt did NOT mutate the render", { before: s7before, after: currentRenderId(state, s7photo) });
  const { data: s7propMid } = await admin.from("action_proposals").select("status").eq("id", s7.body.proposal.id).single();
  reporter.assert(s7propMid?.status === "executing", "S7 failure+retry: proposal is still executing (not applied, not failed)", s7propMid?.status);

  const s7retry = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/jobs/${s7jobId}/retry`, { method: "POST" });
  reporter.assert(s7retry.status === 202, "S7 failure+retry: retry is accepted", s7retry.body);
  const s7done = await pollJob(roomId, s7jobId);
  reporter.assert(s7done?.status === "completed", "S7 failure+retry: the retry completes the change", s7done);

  state = await getRoomState(roomId);
  reporter.assert(
    currentRenderId(state, s7photo) && currentRenderId(state, s7photo) !== s7before,
    "S7 failure+retry: after retry the perspective got its new render",
    { before: s7before, after: currentRenderId(state, s7photo) }
  );
  const { data: s7prop } = await admin.from("action_proposals").select("status, result_message_id").eq("id", s7.body.proposal.id).single();
  reporter.assert(s7prop?.status === "applied" && s7prop.result_message_id, "S7 failure+retry: proposal applied + result linked into thread", s7prop);

  // No duplicate paid image from the retry: exactly one current render for the photo.
  reporter.assert(currentRenders(state, s7photo).length === 1, "S7 failure+retry: exactly one current render for the photo (no duplicate)", currentRenders(state, s7photo).length);

  reporter.finish();
}

async function countChatActionJobs(roomId) {
  const { count } = await admin
    .from("generation_jobs")
    .select("id", { count: "exact", head: true })
    .eq("room_id", roomId)
    .eq("job_type", "chat_action");
  return count ?? 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
