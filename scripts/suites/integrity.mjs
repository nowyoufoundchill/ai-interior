import { readFileSync } from "node:fs";
import path from "node:path";
import { BASE_URL, fetchJson, getRoomState, readCurrentTestRun, SuiteReporter, waitForServer, requireServerIsolation } from "./_lib.mjs";

/**
 * PRD v3 §12.1 Suite 1 — Integrity. Drives every upstream change in the §4
 * invalidation table via the app's own API routes (not raw SQL), then asserts
 * the exact downstream effect via the read-only debug state endpoint. Any
 * deviation from the table — including "nothing deleted" and "locked boards
 * uneditable" — is a failure even if the app "looks fine."
 *
 * Assumes AI_MODE=mock (the dev server this script talks to must have been
 * started with AI_MODE=mock) and a fresh `npm run seed:test` state.
 */

const reporter = new SuiteReporter("integrity");

async function main() {
  await waitForServer();
  await requireServerIsolation();
  const { roomId, homeId } = readCurrentTestRun();
  console.log(`[integrity] room=${roomId} home=${homeId}`);

  // --- Baseline -------------------------------------------------------
  let state = await getRoomState(roomId);
  reporter.assert(state.diagnoses.length === 0, "baseline: no diagnoses yet");
  reporter.assert(state.mood_boards.length === 0, "baseline: no mood boards yet");
  reporter.assert(state.products.length === 0, "baseline: no products yet");
  reporter.assert(state.renders.length === 0, "baseline: no renders yet");

  // --- First diagnosis --------------------------------------------------
  const analyze1 = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/analyze`, { method: "POST" });
  reporter.assert(analyze1.ok, "POST /analyze (v1) succeeds", analyze1.body);

  state = await getRoomState(roomId);
  reporter.assert(state.diagnoses.length === 1, "diagnosis v1: exactly one row exists", state.diagnoses);
  reporter.assert(state.derived.current_diagnosis_version === 1, "diagnosis v1: current version is 1", state.derived);
  reporter.assert(state.derived.stale_diagnosis_count === 0, "diagnosis v1: nothing stale yet", state.derived);

  // --- §4 Row 1: new photo -> diagnosis marked stale, nothing else touched
  const photoPath = path.join(process.cwd(), "spike/input-images/IMG_1126.jpg");
  const form = new FormData();
  form.set("file", new Blob([readFileSync(photoPath)], { type: "image/jpeg" }), "IMG_1126-integrity.jpg");
  form.set("label", "Inspiration");
  const photoUpload = await fetch(`${BASE_URL}/api/rooms/${roomId}/photos`, { method: "POST", body: form });
  reporter.assert(photoUpload.ok, "POST /photos (new photo) succeeds", await safeJson(photoUpload));

  state = await getRoomState(roomId);
  reporter.assert(state.diagnoses.length === 1, "row1: new photo keeps the diagnosis row (nothing deleted)", state.diagnoses);
  reporter.assert(state.derived.current_diagnosis_version === null, "row1: diagnosis no longer current", state.derived);
  reporter.assert(state.derived.stale_diagnosis_count === 1, "row1: diagnosis marked stale", state.derived);
  reporter.assert(state.mood_boards.length === 0, "row1: nothing else touched (no mood boards created)", state.mood_boards);

  // --- Second diagnosis (rerun) ------------------------------------------
  const analyze2 = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/analyze`, { method: "POST" });
  reporter.assert(analyze2.ok, "POST /analyze (v2) succeeds", analyze2.body);

  state = await getRoomState(roomId);
  reporter.assert(state.diagnoses.length === 2, "diagnosis v2: v1 kept, v2 added", state.diagnoses);
  reporter.assert(state.derived.current_diagnosis_version === 2, "diagnosis v2: current version is 2", state.derived);
  reporter.assert(state.derived.stale_diagnosis_count === 1, "diagnosis v2: exactly v1 stale", state.derived);

  // --- Generate concepts, then §4 Row 2: diagnosis re-run -> mood boards stale
  const moodboards1 = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/generate-moodboards`, { method: "POST" });
  reporter.assert(moodboards1.ok, "POST /generate-moodboards succeeds", moodboards1.body);
  reporter.assert(
    Array.isArray(moodboards1.body?.mood_boards) && moodboards1.body.mood_boards.length === 3,
    "generate-moodboards returns exactly 3 concepts",
    moodboards1.body
  );

  state = await getRoomState(roomId);
  reporter.assert(state.mood_boards.length === 3, "concepts: 3 draft mood boards exist", state.mood_boards);
  reporter.assert(
    state.mood_boards.every((board) => board.status === "draft"),
    "concepts: all 3 are draft (none stale/locked yet)",
    state.mood_boards
  );

  const analyze3 = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/analyze`, { method: "POST" });
  reporter.assert(analyze3.ok, "POST /analyze (v3, rerun after concepts exist) succeeds", analyze3.body);

  state = await getRoomState(roomId);
  reporter.assert(state.diagnoses.length === 3, "diagnosis v3: v1+v2 kept, v3 added", state.diagnoses);
  reporter.assert(state.mood_boards.length === 3, "row2: diagnosis rerun keeps all 3 mood boards (nothing deleted)", state.mood_boards);
  reporter.assert(
    state.mood_boards.every((board) => board.status === "stale"),
    "row2: diagnosis rerun marks all existing mood boards stale",
    state.mood_boards
  );

  // --- Regenerate concepts against the current diagnosis so we have an
  // active (non-stale) concept to lock for the remaining rows.
  const moodboards2 = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/generate-moodboards`, { method: "POST" });
  reporter.assert(moodboards2.ok, "POST /generate-moodboards (v2 set) succeeds", moodboards2.body);

  state = await getRoomState(roomId);
  reporter.assert(state.mood_boards.length === 6, "concepts v2: 3 stale (kept) + 3 new draft = 6 total", state.mood_boards);
  const freshBoards = state.mood_boards.filter((board) => board.status === "draft");
  reporter.assert(freshBoards.length === 3, "concepts v2: exactly 3 fresh draft boards", freshBoards);

  const boardToLock = freshBoards[0];

  // --- Lock a concept, generate products + a render against it ----------
  const lock1 = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/select-moodboard`, {
    method: "POST",
    body: JSON.stringify({ mood_board_id: boardToLock.id })
  });
  reporter.assert(lock1.ok, "POST /select-moodboard locks a concept", lock1.body);

  state = await getRoomState(roomId);
  reporter.assert(state.derived.locked_mood_board_version === boardToLock.version, "lock1: locked version matches the board we locked", state.derived);

  // Render BEFORE products: product sourcing is gated behind both an approved
  // direction and a completed render record (Phase 5). Generate the render
  // first so the product gate is satisfied.
  const photosResp = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/photos`);
  const sourcePhotoId = photosResp.body.photos[0].id;

  const render1 = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/generate-render`, {
    method: "POST",
    body: JSON.stringify({ source_photo_id: sourcePhotoId })
  });
  reporter.assert(render1.ok, "POST /generate-render succeeds against the locked concept", render1.body);

  state = await getRoomState(roomId);
  const rendersAfterFirst = state.renders.length;
  reporter.assert(rendersAfterFirst >= 1, "renders: at least one render created", state.renders);
  reporter.assert(
    state.renders.every((r) => r.mood_board_version === boardToLock.version || r.status === "stale"),
    "renders: current render stamped with the locked concept version",
    state.renders
  );

  const products1 = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/source-products`, { method: "POST" });
  reporter.assert(products1.ok, "POST /source-products succeeds against the locked concept", products1.body);

  state = await getRoomState(roomId);
  reporter.assert(state.products.length > 0, "products: at least one product created", state.products);
  reporter.assert(
    state.products.every((p) => p.mood_board_version === boardToLock.version),
    "products: every product stamped with the locked concept version",
    state.products
  );

  // --- §4 Row 4: editing a locked concept is not possible ----------------
  const editWhileLocked = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/moodboards/${boardToLock.id}`, {
    method: "POST",
    body: JSON.stringify({ action: "edit", updates: { concept_name: "Should be rejected" } })
  });
  reporter.assert(editWhileLocked.status === 400, "row4: editing a locked concept is rejected (400)", editWhileLocked.body);

  const mbCountBeforeBlockedEdit = state.mood_boards.length;
  state = await getRoomState(roomId);
  reporter.assert(
    state.mood_boards.length === mbCountBeforeBlockedEdit,
    "row4: rejected edit created no new mood board version",
    state.mood_boards
  );

  // --- §4 Row 3: unlock + edit -> new version; products/renders stale ----
  const unlock1 = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/moodboards/${boardToLock.id}`, {
    method: "POST",
    body: JSON.stringify({ action: "unlock" })
  });
  reporter.assert(unlock1.ok, "POST unlock succeeds", unlock1.body);

  state = await getRoomState(roomId);
  reporter.assert(state.derived.locked_mood_board_version === null, "unlock: no concept is locked anymore", state.derived);
  reporter.assert(
    state.products.every((p) => p.status === "stale"),
    "row3: unlock immediately marks products stale (not deferred to re-lock)",
    state.products
  );
  reporter.assert(
    state.renders.filter((r) => r.status !== "rejected").every((r) => r.status === "stale"),
    "row3: unlock immediately marks renders stale (not deferred to re-lock)",
    state.renders
  );
  reporter.assert(state.products.length > 0, "row3: unlock kept products (nothing deleted)", state.products);
  reporter.assert(state.renders.length === rendersAfterFirst, "row3: unlock kept renders (nothing deleted)", state.renders);

  const mbCountBeforeEdit = state.mood_boards.length;
  const edit1 = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/moodboards/${boardToLock.id}`, {
    method: "POST",
    body: JSON.stringify({ action: "edit", updates: { concept_name: "Integrity Suite Edited Concept" } })
  });
  reporter.assert(edit1.ok, "POST edit (after unlock) succeeds", edit1.body);
  const editedBoard = edit1.body.mood_board;

  state = await getRoomState(roomId);
  reporter.assert(state.mood_boards.length === mbCountBeforeEdit + 1, "row3: edit creates exactly one new version", state.mood_boards);
  const sourceAfterEdit = state.mood_boards.find((b) => b.id === boardToLock.id);
  reporter.assert(sourceAfterEdit?.status === "stale", "row3: source concept kept, marked stale (not deleted)", sourceAfterEdit);
  reporter.assert(editedBoard?.parent_version === boardToLock.version, "row3: new version records parent_version", editedBoard);

  // --- §4 Row 5: render regenerated -> old kept, new becomes current -----
  const lock2 = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/select-moodboard`, {
    method: "POST",
    body: JSON.stringify({ mood_board_id: editedBoard.id })
  });
  reporter.assert(lock2.ok, "re-lock the edited concept succeeds", lock2.body);

  const render2 = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/generate-render`, {
    method: "POST",
    body: JSON.stringify({ source_photo_id: sourcePhotoId, instructions: "make it moodier" })
  });
  reporter.assert(render2.ok, "regenerate render (same photo) succeeds", render2.body);

  const render3 = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/generate-render`, {
    method: "POST",
    body: JSON.stringify({ source_photo_id: sourcePhotoId, instructions: "darker walls" })
  });
  reporter.assert(render3.ok, "regenerate render again (same photo, same locked version) succeeds", render3.body);

  state = await getRoomState(roomId);
  const rendersForPhoto = state.renders.filter((r) => r.source_photo_id === sourcePhotoId);
  const currentForPhoto = rendersForPhoto.filter((r) => r.status === "current");
  reporter.assert(currentForPhoto.length === 1, "row5: exactly one current render per source photo", rendersForPhoto);
  reporter.assert(
    currentForPhoto[0]?.id === render3.body.render.id,
    "row5: the newest regeneration is the current one",
    { expected: render3.body.render.id, actual: currentForPhoto[0]?.id }
  );
  reporter.assert(
    rendersForPhoto.some((r) => r.id === render2.body.render.id && r.status === "stale"),
    "row5: the previous regeneration is kept, marked stale",
    rendersForPhoto
  );

  // --- Global structural assertions --------------------------------------
  reporter.assert(
    state.diagnoses.length === 3 && state.mood_boards.length === mbCountBeforeEdit + 1,
    "no rows were ever deleted across the whole cycle (counts only grow)",
    { diagnoses: state.diagnoses.length, mood_boards: state.mood_boards.length }
  );

  reporter.finish();
}

async function safeJson(response) {
  try {
    return await response.clone().json();
  } catch {
    return null;
  }
}

main().catch((error) => {
  console.error("[integrity] FAILED:", error);
  process.exitCode = 1;
});
