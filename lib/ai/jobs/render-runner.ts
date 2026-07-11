import { activeFailureFixture } from "@/lib/ai/failure-fixtures";
import { generateImageEdit, resolveAiMode } from "@/lib/ai/gateway";
import { isOpenAiConfigured } from "@/lib/ai/openai";
import { renderPromptDirector } from "@/lib/ai/services";
import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";
import { advanceStage, completeJob, failJob } from "./service";
import type { GenerationJob, Json } from "@/types/database";

/**
 * P0.2 resilient single-photo render runner
 * (docs/P0_P1_EXECUTION_PLAN_2026-07-10.md §P0.2).
 *
 * Decomposes a render into independently recorded, resumable stages:
 *   validating → planning (+ model critic) → generating → uploading →
 *   persisting → completed.
 *
 * Every consequential intermediate result is checkpointed into the job's
 * `result_refs` (the composed plan, the uploaded image path, per-stage
 * timings). A retry resumes from the last checkpoint rather than repeating
 * work — so a persistence failure NEVER triggers a second paid image call, and
 * the owner's request, source photo, approved concept version, and plan survive
 * across attempts.
 *
 * Critic contract: a BLOCKING design violation (door/path block, backlit call
 * seat, etc.) stops the pipeline before any image is generated and settles as a
 * non-retryable, actionable design failure. An operational critic failure is
 * handled inside the director (deterministic fallback) and is never silently
 * treated as a passed critic.
 */

interface RenderRefs {
  plan?: Json;
  image_path?: string | null;
  file_url?: string | null;
  render_id?: string;
  mood_board_version?: number | null;
  stage_timings?: Record<string, number>;
  [key: string]: unknown;
}

export async function executeRender(job: GenerationJob): Promise<GenerationJob> {
  const supabase = createServerSupabaseClient();
  const roomId = job.room_id;
  const payload = (job.request_payload ?? {}) as { source_photo_id?: string; instructions?: string };
  const refs: RenderRefs = { ...(job.result_refs as RenderRefs), stage_timings: { ...(job.result_refs as RenderRefs)?.stage_timings } };

  const sourcePhotoId = payload.source_photo_id;
  if (!sourcePhotoId) {
    return failJob(job.id, {
      errorCode: "render_no_source_photo",
      ownerMessage: "Select a source photo before editing it.",
      detail: "request_payload.source_photo_id missing",
      retryable: false
    });
  }

  // --- validating -------------------------------------------------------
  await advanceStage(job.id, "validating", "checking the approved direction and source photo");
  const stageStart = () => Date.now();
  const recordTiming = (name: string, start: number) => {
    refs.stage_timings = { ...refs.stage_timings, [name]: Date.now() - start };
  };

  const { data: room, error: roomError } = await supabase.from("rooms").select("*").eq("id", roomId).single();
  if (roomError || !room) {
    return failJob(job.id, { errorCode: "room_not_found", ownerMessage: "We couldn't find this room.", detail: roomError?.message, retryable: false });
  }

  const { data: selectedMoodBoard } = await supabase
    .from("mood_boards")
    .select("*")
    .eq("room_id", roomId)
    .eq("status", "locked")
    .maybeSingle();
  if (!selectedMoodBoard) {
    return failJob(job.id, {
      errorCode: "render_no_locked_concept",
      ownerMessage: "Lock a concept before editing a room photo.",
      detail: "no locked mood board",
      retryable: false
    });
  }

  const { data: sourcePhoto } = await supabase
    .from("photos")
    .select("*")
    .eq("id", sourcePhotoId)
    .eq("room_id", roomId)
    .maybeSingle();
  if (!sourcePhoto) {
    return failJob(job.id, {
      errorCode: "render_source_photo_not_found",
      ownerMessage: "The selected source photo was not found for this room.",
      detail: `photo ${sourcePhotoId} not in room ${roomId}`,
      retryable: false
    });
  }

  // --- planning (+ critic) ---------------------------------------------
  // Resume: skip re-planning (and its model calls) if a plan is checkpointed.
  let plan = refs.plan as Awaited<ReturnType<typeof renderPromptDirector>> | undefined;
  if (!plan) {
    await advanceStage(job.id, "planning", "composing the edit plan");
    const t = stageStart();

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

    try {
      plan = await renderPromptDirector({
        roomId,
        sourcePhotoId,
        moodBoardId: selectedMoodBoard.id,
        room,
        home,
        analysis: latestDiagnosis?.analysis,
        selectedMoodBoard,
        sourcePhoto,
        designPreferences: designPreferences ?? undefined,
        userInstructions: typeof payload.instructions === "string" ? payload.instructions : undefined
      });
    } catch (error) {
      return failJob(job.id, {
        errorCode: "render_plan_failed",
        ownerMessage: "The edit plan didn't finish. You can try again.",
        detail: error instanceof Error ? error.message : String(error)
      });
    }
    recordTiming("planning", t);
    refs.plan = plan as unknown as Json;
    await checkpoint(job.id, refs);
  }

  // Blocking design violation → no image generation; actionable, non-retryable.
  // renderPromptDirector marks a survived blocking violation with a
  // "BLOCKING (unresolved):" note after its one bounded re-plan.
  const blocking = (plan.critique?.notes ?? []).filter((n) => n.startsWith("BLOCKING (unresolved)"));
  if (blocking.length) {
    return failJob(job.id, {
      errorCode: "render_design_violation",
      ownerMessage:
        "This edit would break the room's layout (" +
        blocking.map((b) => b.replace("BLOCKING (unresolved): ", "")).join("; ") +
        "). Adjust your instructions or the approved direction, then try again.",
      detail: blocking.join(" | "),
      retryable: false
    });
  }

  // --- generating + uploading ------------------------------------------
  // Resume: skip the paid image + upload if already checkpointed.
  const fixture = await activeFailureFixture();
  const isLiveImageEdit = isOpenAiConfigured() && resolveAiMode() !== "mock";

  if (refs.file_url === undefined && refs.image_path === undefined) {
    await advanceStage(job.id, "generating", "editing the room photo");
    const t = stageStart();

    // Fixtures fire before real work so they exercise the boundary even in
    // mock mode (where no paid image or upload actually happens).
    if (fixture === "image_no_image") {
      return failJob(job.id, {
        errorCode: "image_no_image",
        ownerMessage: "The photo edit finished without producing an image. Your instructions and plan were saved — try again.",
        detail: "fixture:image_no_image"
      });
    }
    if (fixture === "storage_upload_failure") {
      return failJob(job.id, {
        errorCode: "storage_upload_failure",
        ownerMessage: "The edited image could not be stored. The generated work is recoverable — try again.",
        detail: "fixture:storage_upload_failure"
      });
    }

    let fileUrl: string | null = resolveAiMode() === "mock" ? sourcePhoto.file_url : null;
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
        return failJob(job.id, {
          errorCode: "image_no_image",
          ownerMessage: "The photo edit finished without producing an image. Your instructions and plan were saved — try again.",
          detail: "OpenAI returned no image output"
        });
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
        if (uploadError) {
          return failJob(job.id, {
            errorCode: "storage_upload_failure",
            ownerMessage: "The edited image could not be stored. The generated work is recoverable — try again.",
            detail: uploadError.message
          });
        }
        const { data: publicUrlData } = serviceSupabase.storage.from("room-photos").getPublicUrl(storagePath);
        fileUrl = publicUrlData.publicUrl;
        refs.image_path = storagePath;
      }
    } catch (error) {
      // Operational image/transport failure: retryable, plan already saved so a
      // retry does NOT re-plan; it re-enters here only because no image was
      // checkpointed yet (no paid image was successfully produced).
      return failJob(job.id, {
        errorCode: "image_generation_failed",
        ownerMessage: "The photo edit didn't finish. Your instructions and plan were saved — try again.",
        detail: error instanceof Error ? error.message : String(error)
      });
    }

    recordTiming("generating", t);
    refs.file_url = fileUrl;
    // Checkpoint the produced image BEFORE persistence, so a persistence
    // failure never causes a second paid image call on retry.
    await checkpoint(job.id, refs);
  }

  // --- persisting -------------------------------------------------------
  await advanceStage(job.id, "persisting", "saving the render");
  const t = stageStart();

  if (fixture === "db_persist_failure") {
    return failJob(job.id, {
      errorCode: "db_persist_failure",
      ownerMessage: "The finished edit could not be saved. The generated work is recoverable — try again.",
      detail: "fixture:db_persist_failure"
    });
  }

  // Insert the new render as current FIRST, then stale prior currents for this
  // photo (excluding the new row). Ordering this way means a crash between the
  // two statements can never leave the photo with zero current renders.
  const { data: render, error: insertError } = await supabase
    .from("renders")
    .insert({
      room_id: roomId,
      mood_board_id: selectedMoodBoard.id,
      mood_board_version: selectedMoodBoard.version ?? null,
      source_photo_id: sourcePhotoId,
      file_url: refs.file_url ?? null,
      prompt: plan.render_prompt,
      render_prompt: plan.render_prompt,
      preservation_constraints: plan.preservation_constraints,
      transformation_instructions: plan.transformation_instructions,
      negative_instructions: plan.negative_instructions,
      user_regeneration_instructions: typeof payload.instructions === "string" ? payload.instructions : null,
      generated_image_path: refs.file_url ?? null,
      status: "current",
      critique: plan.critique as unknown as Json,
      quality_score: plan.quality_score,
      test_run_id: room.test_run_id
    })
    .select("*")
    .single();

  if (insertError || !render) {
    return failJob(job.id, {
      errorCode: "render_persist_failed",
      ownerMessage: "The finished edit could not be saved. The generated work is recoverable — try again.",
      detail: insertError?.message ?? "insert returned no row"
    });
  }

  await supabase
    .from("renders")
    .update({ status: "stale" })
    .eq("room_id", roomId)
    .eq("source_photo_id", sourcePhotoId)
    .eq("status", "current")
    .neq("id", render.id);

  await supabase.from("rooms").update({ status: "renders", current_stage: "executing" }).eq("id", roomId);

  recordTiming("persisting", t);
  refs.render_id = render.id;
  refs.mood_board_version = selectedMoodBoard.version ?? null;

  return completeJob(job.id, refs as Record<string, unknown>);
}

async function checkpoint(jobId: string, refs: RenderRefs): Promise<void> {
  const supabase = createServerSupabaseClient();
  await supabase
    .from("generation_jobs")
    .update({ result_refs: refs as Json, heartbeat_at: new Date().toISOString() })
    .eq("id", jobId);
}
