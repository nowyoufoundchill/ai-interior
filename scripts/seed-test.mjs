import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { loadTestEnv } from "./test-env.mjs";

const SINGLE_HOUSEHOLD_USER_ID = "00000000-0000-0000-0000-000000000001";

loadTestEnv();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const testRunId = `test-${Date.now()}-${randomUUID().slice(0, 8)}`;

// Reuse the owner's real office photos + real brief/dimensions from the
// Phase 0 spike payload rather than inventing synthetic data, per PRD v3 §3:
// "seed:test creates a known state ... with the owner's real photos and
// typed dimensions."
const payloadPath = path.join(process.cwd(), "spike/payloads/office-variation-matrix.json");
const payload = JSON.parse(readFileSync(payloadPath, "utf-8"));
const { home: homeBrief, room: roomBrief } = payload.base;

async function main() {
  console.log(`[seed-test] test_run_id = ${testRunId}`);

  await ensureUser();

  const { data: home, error: homeError } = await supabase
    .from("homes")
    .insert({
      user_id: SINGLE_HOUSEHOLD_USER_ID,
      name: homeBrief.name,
      region: homeBrief.region,
      home_type: homeBrief.home_type,
      style_notes: homeBrief.style_notes,
      whole_home_palette: homeBrief.whole_home_palette,
      whole_home_constraints: homeBrief.whole_home_constraints,
      test_run_id: testRunId
    })
    .select("*")
    .single();
  if (homeError) throw new Error(`home insert failed: ${homeError.message}`);

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .insert({
      home_id: home.id,
      name: roomBrief.name,
      room_type: roomBrief.room_type,
      purpose: roomBrief.purpose,
      dimensions: roomBrief.dimensions,
      budget_range: roomBrief.budget_range,
      style_preferences: roomBrief.style_preferences,
      color_preferences: roomBrief.color_preferences,
      constraints: roomBrief.constraints,
      existing_items: roomBrief.existing_items,
      design_brief: roomBrief.design_brief,
      status: "photos",
      current_stage: "photos",
      test_run_id: testRunId
    })
    .select("*")
    .single();
  if (roomError) throw new Error(`room insert failed: ${roomError.message}`);

  const photos = [];
  for (const photo of payload.photos) {
    const fileBuffer = readFileSync(path.join(process.cwd(), photo.path));
    const storagePath = `test-runs/${testRunId}/${path.basename(photo.path)}`;

    const { error: uploadError } = await supabase.storage
      .from("room-photos")
      .upload(storagePath, fileBuffer, {
        contentType: "image/jpeg",
        upsert: true,
        metadata: { test_run_id: testRunId }
      });
    if (uploadError) throw new Error(`photo upload failed (${photo.path}): ${uploadError.message}`);

    const { data: publicUrl } = supabase.storage.from("room-photos").getPublicUrl(storagePath);

    const { data: photoRow, error: photoError } = await supabase
      .from("photos")
      .insert({
        room_id: room.id,
        file_url: publicUrl.publicUrl,
        storage_path: storagePath,
        label: photo.label,
        test_run_id: testRunId
      })
      .select("*")
      .single();
    if (photoError) throw new Error(`photo row insert failed: ${photoError.message}`);
    photos.push(photoRow);
  }

  const state = {
    testRunId,
    homeId: home.id,
    roomId: room.id,
    photoIds: photos.map((p) => p.id),
    createdAt: new Date().toISOString()
  };

  mkdirSync(path.join(process.cwd(), "test-runs"), { recursive: true });
  const statePath = path.join(process.cwd(), "test-runs", "current.json");
  writeFileSync(statePath, JSON.stringify(state, null, 2));

  console.log(`[seed-test] home=${home.id} room=${room.id} photos=${photos.length}`);
  console.log(`[seed-test] state written to ${statePath}`);
  console.log(`TEST_RUN_ID=${testRunId}`);
  console.log(`ROOM_ID=${room.id}`);
}

async function ensureUser() {
  const { data: existing } = await supabase.from("users").select("id").eq("id", SINGLE_HOUSEHOLD_USER_ID).maybeSingle();
  if (existing) return;

  const { error } = await supabase.from("users").insert({
    id: SINGLE_HOUSEHOLD_USER_ID,
    email: "owner@local.test",
    name: "Owner"
  });
  if (error && !error.message.includes("duplicate")) {
    throw new Error(`user ensure failed: ${error.message}`);
  }
}

main().catch((error) => {
  console.error("[seed-test] FAILED:", error.message);
  process.exitCode = 1;
});
