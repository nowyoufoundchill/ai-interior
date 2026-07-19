import { randomUUID } from "node:crypto";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { BASE_URL, readCurrentTestRun, requireServerIsolation, SuiteReporter, waitForServer } from "./_lib.mjs";
import { loadTestEnv } from "../test-env.mjs";

const reporter = new SuiteReporter("p15-whole-home");

async function main() {
  loadTestEnv();
  await waitForServer();
  const { serverAiMode } = await requireServerIsolation();
  if (serverAiMode !== "mock") throw new Error(`P1.5 gate requires AI_MODE=mock (got ${serverAiMode}).`);
  const { testRunId, homeId, roomId: seedRoomId } = readCurrentTestRun();
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: seedPhoto, error: seedPhotoError } = await supabase.from("photos").select("file_url, storage_path").eq("room_id", seedRoomId).limit(1).single();
  if (seedPhotoError || !seedPhoto) throw new Error(`Could not read the tagged source photo: ${seedPhotoError?.message}`);

  const definitions = [
    { key: "empty", name: "Entry", type: "Entry", status: "intake", stage: "empty" },
    { key: "ready", name: "Kitchen", type: "Kitchen", status: "photos", stage: "photos", photo: true },
    { key: "working", name: "Library", type: "Library", status: "photos", stage: "photos", photo: true, job: "generating" },
    { key: "needs_attention", name: "Bath", type: "Bathroom", status: "photos", stage: "photos", photo: true, job: "retryable_failed" },
    { key: "design_ready", name: "Dining room", type: "Dining room", status: "design_ready", stage: "design_ready", photo: true, render: "candidate" },
    { key: "kept", name: "Bedroom", type: "Bedroom", status: "approved", stage: "approved", photo: true, render: "accepted" }
  ];

  const ids = Object.fromEntries(definitions.map((definition) => [definition.key, randomUUID()]));
  const { error: roomsError } = await supabase.from("rooms").insert(definitions.map((definition) => ({
    id: ids[definition.key], home_id: homeId, name: definition.name, room_type: definition.type,
    purpose: `${definition.type} continuity fixture`, status: definition.status, current_stage: definition.stage,
    constraints: definition.key === "kept" ? ["blackout treatment stays in this bedroom only"] : [],
    test_run_id: testRunId
  })));
  if (roomsError) throw roomsError;

  const photoIds = {};
  for (const definition of definitions.filter((item) => item.photo)) {
    photoIds[definition.key] = randomUUID();
    const { error } = await supabase.from("photos").insert({
      id: photoIds[definition.key], room_id: ids[definition.key], file_url: seedPhoto.file_url,
      storage_path: seedPhoto.storage_path, label: "Main angle", test_run_id: testRunId
    });
    if (error) throw error;
  }

  const renderIds = {};
  for (const definition of definitions.filter((item) => item.render)) {
    renderIds[definition.key] = randomUUID();
    const { error } = await supabase.from("renders").insert({
      id: renderIds[definition.key], room_id: ids[definition.key], source_photo_id: photoIds[definition.key],
      file_url: `${seedPhoto.file_url}${seedPhoto.file_url.includes("?") ? "&" : "?"}p15=${definition.key}`,
      prompt: `P1.5 ${definition.key} fixture`, status: definition.render, test_run_id: testRunId
    });
    if (error) throw error;
  }

  for (const definition of definitions.filter((item) => item.job)) {
    const failed = definition.job === "retryable_failed";
    const { error } = await supabase.from("generation_jobs").insert({
      room_id: ids[definition.key], job_type: "diagnosis", status: definition.job,
      stage: failed ? "review" : "generating", idempotency_key: `p15:${testRunId}:${definition.key}`,
      error_message: failed ? "The room reading needs one more look." : null, test_run_id: testRunId
    });
    if (error) throw error;
  }

  const { error: preferenceError } = await supabase.from("design_preferences").insert({
    home_id: homeId, preference_type: "material", label: "Natural oak connects the rooms", test_run_id: testRunId
  });
  if (preferenceError) throw preferenceError;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const consoleErrors = [];
  const networkErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("response", (response) => { if (response.status() >= 400) networkErrors.push(`${response.status()} ${response.url()}`); });
  page.on("requestfailed", (request) => {
    if (!(request.url().includes("_rsc=") && request.failure()?.errorText === "net::ERR_ABORTED")) {
      networkErrors.push(`${request.failure()?.errorText ?? "failed"} ${request.url()}`);
    }
  });

  try {
    await page.goto(`${BASE_URL}/homes/${homeId}`, { waitUntil: "networkidle" });
    for (const definition of definitions) {
      const card = page.getByTestId(`room-card-${ids[definition.key]}`);
      reporter.assert(await card.getAttribute("data-lifecycle-state") === definition.key, `${definition.name} shows its persisted ${definition.key} state`);
      const expectedKind = definition.render ? "design" : definition.photo ? "source" : "empty";
      reporter.assert(await card.getAttribute("data-display-kind") === expectedKind, `${definition.name} shows the correct ${expectedKind} visual`);
      reporter.assert(await card.locator(`a[href="/rooms/${ids[definition.key]}"]`).count() === 1, `${definition.name}'s next action is one tap from the index`);
      if (definition.render) reporter.assert(await card.getAttribute("data-display-render-id") === renderIds[definition.key], `${definition.name} is bound to its own render`);
    }
    reporter.assert(await page.getByText("Natural oak connects the rooms").count() === 1, "confirmed whole-home memory survives on the visual index");

    await page.reload({ waitUntil: "networkidle" });
    reporter.assert(await page.getByTestId(`room-state-${ids.working}`).getAttribute("data-testid") !== null, "active work survives reload and navigation");
    reporter.assert((await page.getByTestId(`room-state-${ids.needs_attention}`).textContent())?.includes("Needs attention"), "failed work survives reload with recovery guidance");

    const { data: renders } = await supabase.from("renders").select("id, room_id, source_photo_id").in("id", Object.values(renderIds));
    const { data: jobs } = await supabase.from("generation_jobs").select("room_id, status").in("room_id", [ids.working, ids.needs_attention]);
    reporter.assert((renders ?? []).every((render) => render.room_id === (render.id === renderIds.design_ready ? ids.design_ready : ids.kept)), "render artifacts do not leak across rooms", renders);
    reporter.assert((jobs ?? []).every((job) => (job.status === "generating" ? job.room_id === ids.working : job.room_id === ids.needs_attention)), "job state does not leak across rooms", jobs);

    await mkdir(path.join(process.cwd(), "test-runs", "screenshots"), { recursive: true });
    await page.screenshot({ path: path.join(process.cwd(), "test-runs", "screenshots", "p15-room-index.png"), fullPage: true });
    reporter.assert(consoleErrors.length === 0, "room index has no browser console errors", consoleErrors);
    reporter.assert(networkErrors.length === 0, "room index has no application network errors", networkErrors);
  } finally {
    await browser.close();
  }
  reporter.finish();
}

main().catch((error) => {
  console.error("[p15-whole-home] FAILED:", error.message);
  reporter.assert(false, "suite completed without an unhandled error", error.message);
  reporter.finish();
});
