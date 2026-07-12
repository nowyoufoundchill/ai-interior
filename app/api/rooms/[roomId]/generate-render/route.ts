import { NextResponse } from "next/server";
import { activeFailureFixture } from "@/lib/ai/failure-fixtures";
import { generateImageEdit, resolveAiMode } from "@/lib/ai/gateway";
import { isOpenAiConfigured } from "@/lib/ai/openai";
import { renderPromptDirector } from "@/lib/ai/services";
import { createOrGetActiveJob, getJob, JobsTableMissingError } from "@/lib/ai/jobs/service";
import { runJobInline } from "@/lib/ai/jobs/runtime";
import { currentCorrelationId, logStructured } from "@/lib/observability";
import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";

/**
 * P0.2 single-photo render — durable compatibility layer.
 *
 * The render now runs as a durable `generation_jobs` job (validate → plan+critic
 * → generate/upload → INSERT-FIRST persist), so a failed persistence never
 * leaves the room "current staled, nothing inserted", the paid image is never
 * regenerated just because saving failed, and the work survives client
 * disconnect. This route keeps the legacy synchronous contract — it runs the job
 * inline and returns `{ render, job_id }` unchanged in shape — so existing API
 * consumers (integrity/e2e suites) stay green while the browser uses the async
 * `/jobs` path for live progress. The pre-migration-008 fallback below preserves
 * the old direct-write behavior only when the jobs table is absent.
 */
export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const sourcePhotoId = typeof body.source_photo_id === "string" ? body.source_photo_id : null;
  const instructions = typeof body.instructions === "string" ? body.instructions : undefined;

  if (!sourcePhotoId) {
    return NextResponse.json({ error: "Select a source photo before visualizing it." }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, test_run_id")
    .eq("id", roomId)
    .maybeSingle();
  if (roomError || !room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  const correlationId = await currentCorrelationId();

  try {
    const { job } = await createOrGetActiveJob({
      roomId,
      jobType: "render",
      requestPayload: { source_photo_id: sourcePhotoId, instructions: instructions ?? null },
      requestedBy: "owner",
      correlationId,
      testRunId: room.test_run_id
    });

    // Run inline so this legacy route resolves with the artifact, exactly like
    // before — but through the identical durable contract the async path uses.
    await runJobInline(job.id);
    const settled = await getJob(job.id, roomId);

    if (settled?.status === "completed") {
      const renderId = (settled.result_refs as Record<string, unknown>)?.render_id;
      if (typeof renderId === "string") {
        const { data: render } = await supabase.from("renders").select("*").eq("id", renderId).single();
        return NextResponse.json({ render, job_id: job.id });
      }
    }

    // Failed (or never completed): surface the job's owner-safe error + code.
    return NextResponse.json(
      { error: settled?.error_message ?? "The visualization didn't finish.", error_code: settled?.error_code ?? null, job_id: job.id },
      { status: statusForFailure(settled?.status, settled?.error_code) }
    );
  } catch (error) {
    if (error instanceof JobsTableMissingError) {
      // Degraded mode only (migration 008 not applied): old synchronous path.
      return legacyGenerateRender(request, roomId, body);
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "The visualization didn't finish." }, { status: 500 });
  }
}

/** Map a durable render failure to a legacy-compatible HTTP status. */
function statusForFailure(status: string | undefined, errorCode: string | null | undefined): number {
  switch (errorCode) {
    case "missing_source_photo":
    case "no_locked_concept":
    case "source_photo_not_found":
      return 400;
    case "room_not_found":
      return 404;
    case "render_design_violation":
      return 422;
    default:
      // Operational/recoverable failures (image/storage/persist/critic timeout).
      return status === "terminal_failed" ? 500 : 502;
  }
}

/**
 * Pre-migration-008 fallback: the original synchronous render path. Retained so
 * an environment without the `generation_jobs` table still renders (in a
 * non-durable way). Once 008 is applied everywhere this is dead code.
 */
async function legacyGenerateRender(request: Request, roomId: string, body: Record<string, unknown>) {
  const supabase = createServerSupabaseClient();
  const { data: room, error: roomError } = await supabase.from("rooms").select("*").eq("id", roomId).single();
  if (roomError) return NextResponse.json({ error: roomError.message }, { status: 404 });

  const { data: selectedMoodBoard } = await supabase
    .from("mood_boards")
    .select("*")
    .eq("room_id", roomId)
    .eq("status", "locked")
    .maybeSingle();
  if (!selectedMoodBoard) {
    return NextResponse.json({ error: "Lock a concept before editing a room photo." }, { status: 400 });
  }

  if (typeof body.source_photo_id !== "string") {
    return NextResponse.json({ error: "Select a source photo before visualizing it." }, { status: 400 });
  }

  const { data: sourcePhoto } = await supabase.from("photos").select("*").eq("id", body.source_photo_id).eq("room_id", roomId).maybeSingle();
  if (!sourcePhoto) {
    return NextResponse.json({ error: "The selected source photo was not found for this room." }, { status: 400 });
  }

  const { data: latestDiagnosis } = await supabase
    .from("room_analyses")
    .select("*")
    .eq("room_id", roomId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: home } = await supabase.from("homes").select("*").eq("id", room.home_id).maybeSingle();
  const { data: designPreferences } = home
    ? await supabase.from("design_preferences").select("preference_type, label").eq("home_id", home.id)
    : { data: null };

  let plan;
  try {
    plan = await renderPromptDirector({
      roomId,
      sourcePhotoId: body.source_photo_id,
      moodBoardId: selectedMoodBoard.id,
      room,
      home,
      analysis: latestDiagnosis?.analysis,
      selectedMoodBoard,
      sourcePhoto,
      designPreferences: designPreferences ?? undefined,
      userInstructions: typeof body.instructions === "string" ? body.instructions : undefined
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Render planning failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const fixture = await activeFailureFixture();
  const correlationId = await currentCorrelationId();

  if (fixture === "image_no_image") {
    logStructured("render_failure", { correlation_id: correlationId, room_id: roomId, error_code: "image_no_image", stage: "generating" });
    return NextResponse.json(
      { error: "The visualization finished without producing an image. Your instructions and plan were saved — try again.", error_code: "image_no_image" },
      { status: 502 }
    );
  }

  let fileUrl: string | null = null;
  const isLiveImageEdit = isOpenAiConfigured() && resolveAiMode() !== "mock";
  if (resolveAiMode() === "mock") {
    fileUrl = sourcePhoto.file_url;
  }

  if (fixture === "storage_upload_failure") {
    logStructured("render_failure", { correlation_id: correlationId, room_id: roomId, error_code: "storage_upload_failure", stage: "persisting" });
    return NextResponse.json(
      { error: "The render could not be stored. The generated work is recoverable — try again.", error_code: "storage_upload_failure" },
      { status: 502 }
    );
  }

  try {
    const imageBase64 =
      resolveAiMode() === "mock"
        ? null
        : await generateImageEdit({
            roomId,
            serviceName: "Render Image Generator",
            promptVersion: "render_image_v1",
            prompt: plan.render_prompt,
            sourceImageUrl: sourcePhoto.file_url
          });

    if (isLiveImageEdit && !imageBase64) {
      throw new Error("OpenAI image generation returned no image output.");
    }

    if (imageBase64) {
      const serviceSupabase = createServiceSupabaseClient();
      const storagePath = `${roomId}/renders/${crypto.randomUUID()}.png`;
      const imageBytes = Uint8Array.from(atob(imageBase64), (char) => char.charCodeAt(0));
      const { error: uploadError } = await serviceSupabase.storage.from("room-photos").upload(storagePath, imageBytes, {
        contentType: "image/png",
        cacheControl: "3600",
        upsert: false
      });
      if (uploadError) throw uploadError;
      const { data: publicUrlData } = serviceSupabase.storage.from("room-photos").getPublicUrl(storagePath);
      fileUrl = publicUrlData.publicUrl;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Render image generation failed.";
    if (isLiveImageEdit) {
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  await supabase
    .from("renders")
    .update({ status: "stale" })
    .eq("room_id", roomId)
    .eq("source_photo_id", body.source_photo_id)
    .eq("status", "current");

  if (fixture === "db_persist_failure") {
    logStructured("render_failure", { correlation_id: correlationId, room_id: roomId, error_code: "db_persist_failure", stage: "persisting" });
    return NextResponse.json(
      { error: "The finished edit could not be saved. The generated work is recoverable — try again.", error_code: "db_persist_failure" },
      { status: 500 }
    );
  }

  const { data, error } = await supabase
    .from("renders")
    .insert({
      room_id: roomId,
      mood_board_id: selectedMoodBoard.id,
      mood_board_version: selectedMoodBoard.version ?? null,
      source_photo_id: body.source_photo_id,
      file_url: fileUrl,
      prompt: plan.render_prompt,
      render_prompt: plan.render_prompt,
      preservation_constraints: plan.preservation_constraints,
      transformation_instructions: plan.transformation_instructions,
      negative_instructions: plan.negative_instructions,
      user_regeneration_instructions: typeof body.instructions === "string" ? body.instructions : null,
      generated_image_path: fileUrl,
      status: "current",
      critique: plan.critique,
      quality_score: plan.quality_score,
      test_run_id: room.test_run_id
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("rooms").update({ status: "renders", current_stage: "executing" }).eq("id", roomId);

  return NextResponse.json({ render: data });
}
