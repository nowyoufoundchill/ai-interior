import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const configArg = process.argv[2] ?? "spike/payloads/office-variation-matrix.json";
const configPath = path.resolve(repoRoot, configArg);
const rawConfig = await fs.readFile(configPath, "utf8");
const config = JSON.parse(rawConfig);

const apiBaseUrl = config.apiBaseUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Supabase environment variables are not configured.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);
const batchId = new Date().toISOString().replace(/[:.]/g, "-");
const batchDir = path.join(repoRoot, "spike", "runs", "batch", batchId);

await fs.mkdir(batchDir, { recursive: true });
await assertApiReachable(apiBaseUrl);

const summary = [];

for (const [index, variant] of (config.variants ?? []).entries()) {
  const variantLabel = variant.name ?? variant.slug ?? `variant-${index + 1}`;
  const slug = sanitizeSlug(variant.slug ?? variant.name ?? `variant-${index + 1}`);
  const startedAt = new Date().toISOString();

  console.log(`\n[${index + 1}/${config.variants.length}] Running ${variantLabel}`);

  try {
    const homePayload = mergeRecords(config.base?.home ?? {}, variant.home ?? {});
    const roomPayload = mergeRecords(config.base?.room ?? {}, variant.room ?? {});
    const photoSpecs = Array.isArray(variant.photos) && variant.photos.length ? variant.photos : config.photos ?? [];

    const homeResponse = await postJson(`${apiBaseUrl}/api/homes`, {
      ...homePayload,
      name: variant.home?.name ?? `${homePayload.name} - ${variantLabel}`
    });

    const roomResponse = await postJson(`${apiBaseUrl}/api/homes/${homeResponse.home.id}/rooms`, roomPayload);
    const roomId = roomResponse.room.id;

    const uploadedPhotos = [];
    for (const photoSpec of photoSpecs) {
      const photoResponse = await uploadPhoto(apiBaseUrl, roomId, photoSpec);
      uploadedPhotos.push(photoResponse.photo);
    }

    const diagnosisResponse = await postJson(`${apiBaseUrl}/api/rooms/${roomId}/analyze`, {});
    const conceptsResponse = await postJson(`${apiBaseUrl}/api/rooms/${roomId}/generate-moodboards`, {});
    const selectedMoodBoard = pickMoodBoard(conceptsResponse.mood_boards ?? [], variant.selectConcept);
    const lockResponse = await postJson(`${apiBaseUrl}/api/rooms/${roomId}/select-moodboard`, {
      mood_board_id: selectedMoodBoard.id
    });
    const productsResponse = await postJson(`${apiBaseUrl}/api/rooms/${roomId}/source-products`, {});

    let renderResponse = null;
    if (variant.runRender !== false) {
      const sourcePhoto = pickPhoto(uploadedPhotos, variant.renderPhoto);
      renderResponse = await postJson(`${apiBaseUrl}/api/rooms/${roomId}/generate-render`, {
        source_photo_id: sourcePhoto.id
      });
    }

    const workspaceSnapshot = await readWorkspaceSnapshot(supabase, roomId);
    const artifact = {
      batch_id: batchId,
      variant: {
        name: variantLabel,
        slug,
        selectConcept: variant.selectConcept ?? "highest_quality",
        renderPhoto: variant.renderPhoto ?? { index: 0 }
      },
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      config: {
        home: homePayload,
        room: roomPayload,
        photos: photoSpecs
      },
      responses: {
        home: homeResponse,
        room: roomResponse,
        uploaded_photos: uploadedPhotos,
        diagnosis: diagnosisResponse,
        concepts: conceptsResponse,
        locked_concept: lockResponse,
        products: productsResponse,
        render: renderResponse
      },
      workspace_snapshot: workspaceSnapshot
    };

    const artifactPath = path.join(batchDir, `${slug}.json`);
    await fs.writeFile(artifactPath, JSON.stringify(artifact, null, 2), "utf8");

    summary.push({
      variant: variantLabel,
      slug,
      status: "completed",
      artifact_path: toRelativeRepoPath(artifactPath),
      room_id: roomId,
      selected_concept: lockResponse.mood_board?.concept_name ?? selectedMoodBoard.concept_name,
      concept_names: (conceptsResponse.mood_boards ?? []).map((board) => board.concept_name),
      product_count: productsResponse.products?.length ?? 0,
      render_generated: Boolean(renderResponse?.render),
      stage: workspaceSnapshot.room?.current_stage ?? workspaceSnapshot.room?.status ?? "unknown"
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown batch failure.";
    const artifactPath = path.join(batchDir, `${slug}.error.json`);
    await fs.writeFile(
      artifactPath,
      JSON.stringify(
        {
          batch_id: batchId,
          variant: variantLabel,
          failed_at: new Date().toISOString(),
          error: message
        },
        null,
        2
      ),
      "utf8"
    );

    summary.push({
      variant: variantLabel,
      slug,
      status: "failed",
      artifact_path: toRelativeRepoPath(artifactPath),
      error: message
    });
  }
}

const summaryPath = path.join(batchDir, "summary.json");
await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf8");

console.log(`\nBatch complete. Summary saved to ${toRelativeRepoPath(summaryPath)}`);
for (const item of summary) {
  console.log(
    item.status === "completed"
      ? `- ${item.variant}: ${item.selected_concept} (${item.product_count} products, render=${item.render_generated})`
      : `- ${item.variant}: FAILED - ${item.error}`
  );
}

async function assertApiReachable(baseUrl) {
  const response = await fetch(`${baseUrl}/api/homes`, { signal: AbortSignal.timeout(15000) }).catch((error) => {
    throw new Error(`Could not reach ${baseUrl}/api/homes: ${error instanceof Error ? error.message : String(error)}`);
  });

  if (!response.ok) {
    throw new Error(`API check failed at ${baseUrl}/api/homes with status ${response.status}.`);
  }
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(240000)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${url} failed (${response.status}): ${payload.error ?? "Unknown error"}`);
  }

  return payload;
}

async function uploadPhoto(baseUrl, roomId, photoSpec) {
  const absolutePath = path.resolve(repoRoot, photoSpec.path);
  const bytes = await fs.readFile(absolutePath);
  const file = new File([bytes], path.basename(absolutePath), {
    type: inferMimeType(absolutePath)
  });

  const form = new FormData();
  form.append("file", file);
  form.append("label", photoSpec.label ?? path.basename(absolutePath));

  const response = await fetch(`${baseUrl}/api/rooms/${roomId}/photos`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(120000)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Photo upload failed for ${photoSpec.path}: ${payload.error ?? "Unknown error"}`);
  }

  return payload;
}

function pickMoodBoard(moodBoards, selection) {
  if (!Array.isArray(moodBoards) || moodBoards.length === 0) {
    throw new Error("No mood boards were returned for selection.");
  }

  if (typeof selection === "number") {
    return moodBoards[selection] ?? moodBoards[0];
  }

  if (selection && typeof selection === "object" && typeof selection.nameIncludes === "string") {
    const matched = moodBoards.find((board) =>
      board.concept_name?.toLowerCase().includes(selection.nameIncludes.toLowerCase())
    );
    return matched ?? moodBoards[0];
  }

  if (selection === "highest_quality" || !selection) {
    return [...moodBoards].sort((left, right) => Number(right.quality_score ?? 0) - Number(left.quality_score ?? 0))[0];
  }

  return moodBoards[0];
}

function pickPhoto(photos, selection) {
  if (!Array.isArray(photos) || photos.length === 0) {
    throw new Error("No uploaded photos are available for render selection.");
  }

  if (selection && typeof selection === "object" && typeof selection.labelIncludes === "string") {
    const matched = photos.find((photo) =>
      String(photo.label ?? "").toLowerCase().includes(selection.labelIncludes.toLowerCase())
    );
    return matched ?? photos[0];
  }

  if (selection && typeof selection === "object" && typeof selection.index === "number") {
    return photos[selection.index] ?? photos[0];
  }

  return photos[0];
}

async function readWorkspaceSnapshot(client, roomId) {
  const [room, photos, analyses, moodBoards, products, renders, revisions, memories, aiRuns] = await Promise.all([
    client.from("rooms").select("*").eq("id", roomId).single(),
    client.from("photos").select("*").eq("room_id", roomId).order("created_at", { ascending: true }),
    client.from("room_analyses").select("*").eq("room_id", roomId).order("created_at", { ascending: true }),
    client.from("mood_boards").select("*").eq("room_id", roomId).order("created_at", { ascending: true }),
    client.from("products").select("*").eq("room_id", roomId).order("created_at", { ascending: true }),
    client.from("renders").select("*").eq("room_id", roomId).order("created_at", { ascending: true }),
    client.from("revisions").select("*").eq("room_id", roomId).order("created_at", { ascending: true }),
    client.from("design_memories").select("*").eq("scope_id", roomId).order("created_at", { ascending: true }),
    client.from("ai_runs").select("*").eq("room_id", roomId).order("created_at", { ascending: true })
  ]);

  return {
    room: room.data ?? null,
    photos: photos.data ?? [],
    analyses: analyses.data ?? [],
    mood_boards: moodBoards.data ?? [],
    products: products.data ?? [],
    renders: renders.data ?? [],
    revisions: revisions.data ?? [],
    memories: memories.data ?? [],
    ai_runs: aiRuns.data ?? []
  };
}

function mergeRecords(base, override) {
  const result = { ...base };

  for (const [key, value] of Object.entries(override)) {
    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = mergeRecords(result[key], value);
      continue;
    }

    result[key] = value;
  }

  return result;
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeSlug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function inferMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".heic") return "image/heic";
  return "image/jpeg";
}

function toRelativeRepoPath(absolutePath) {
  return path.relative(repoRoot, absolutePath).replaceAll("\\", "/");
}
