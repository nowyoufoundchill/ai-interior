import { renderPromptDirector, roomVisionAnalyst, type RenderCriticOutcome } from "@/lib/ai/services";
import { activeFailureFixture } from "@/lib/ai/failure-fixtures";
import { generateImageEdit, resolveAiMode } from "@/lib/ai/gateway";
import { isOpenAiConfigured } from "@/lib/ai/openai";
import { logStructured } from "@/lib/observability";
import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";
import { classifyPhotos } from "@/lib/ai/photo-eligibility";
import { evaluateBatchConsistency, type RenderForConsistency } from "@/lib/ai/batch-consistency";
import {
  advanceStage,
  checkpointResult,
  claimJob,
  completeJob,
  createOrGetActiveJob,
  failJob,
  getJob,
  isStale,
  reclaimIfStale,
  TERMINAL_STATUSES,
  type JobStatus
} from "./service";
import type { GenerationJob, Json } from "@/types/database";

/** Bounded concurrency for a render batch (§P0.3 task 5 — respect rate limits). */
const DEFAULT_BATCH_CONCURRENCY = 2;
export function batchConcurrency(): number {
  const raw = Number(process.env.RENDER_BATCH_CONCURRENCY);
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : DEFAULT_BATCH_CONCURRENCY;
}

/** Per-photo item recorded on the parent batch job for resume + the batch view. */
export interface BatchItem {
  photo_id: string;
  child_job_id: string;
}

/**
 * P0.1 job runners (docs/P0_P1_EXECUTION_PLAN_2026-07-10.md §P0.1 task 4).
 *
 * A runner is the durable execution body of a job: it claims the job, walks it
 * through the stage machine, does the real AI work, and settles it as completed
 * (with a persisted artifact ref) or failed. It relies on no in-process memory
 * beyond the job id — every consequential state transition is written to the
 * `generation_jobs` row so the work survives client disconnect and a re-read
 * always shows the true current stage.
 */

export interface RunResult {
  ran: boolean;
  job: GenerationJob | null;
}

/**
 * Claim and execute a job exactly once. If the job is not claimable (already
 * running, already terminal, or won by another executor), returns ran:false.
 * Never throws to the caller — an unexpected error is recorded on the job.
 */
export async function runJobNow(jobId: string): Promise<RunResult> {
  const claimed = await claimJob(jobId);
  if (!claimed) {
    return { ran: false, job: await getJob(jobId) };
  }

  try {
    switch (claimed.job_type) {
      case "diagnosis": {
        const job = await executeDiagnosis(claimed);
        return { ran: true, job };
      }
      case "render": {
        const job = await executeRender(claimed);
        return { ran: true, job };
      }
      case "batch_render": {
        const job = await executeBatchRender(claimed);
        return { ran: true, job };
      }
      default: {
        // P0.1 converts one low-risk operation (diagnosis) to prove the
        // contract; other job types land in P0.2+. Fail closed rather than
        // silently completing.
        const job = await failJob(claimed.id, {
          errorCode: "unsupported_job_type",
          ownerMessage: "This operation is not available yet.",
          detail: `No runner registered for job_type=${claimed.job_type}`,
          retryable: false
        });
        return { ran: true, job };
      }
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const job = await failJob(claimed.id, {
      errorCode: "runner_error",
      ownerMessage: "Something interrupted this step. You can try again.",
      detail
    });
    return { ran: true, job };
  }
}

/**
 * Diagnosis executor. Mirrors the persistence and invalidation contract of the
 * legacy synchronous /analyze route (stale prior diagnosis, append new version,
 * stale downstream concepts, advance room stage) but drives it through durable
 * stages and coordinates artifact persistence with job completion so the job
 * cannot report complete without a real room_analyses row.
 */
async function executeDiagnosis(job: GenerationJob): Promise<GenerationJob> {
  const supabase = createServerSupabaseClient();
  const roomId = job.room_id;

  await advanceStage(job.id, "validating", "loading room + photos");

  const { data: room, error: roomError } = await supabase.from("rooms").select("*").eq("id", roomId).single();
  if (roomError || !room) {
    return failJob(job.id, {
      errorCode: "room_not_found",
      ownerMessage: "We couldn't find this room.",
      detail: roomError?.message ?? "room missing",
      retryable: false
    });
  }

  const { data: home } = await supabase.from("homes").select("*").eq("id", room.home_id).maybeSingle();

  const { data: photos, error: photoError } = await supabase
    .from("photos")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });
  if (photoError) {
    return failJob(job.id, {
      errorCode: "photos_load_failed",
      ownerMessage: "We couldn't load this room's photos. Please try again.",
      detail: photoError.message
    });
  }

  const { data: existingAnalyses } = await supabase
    .from("room_analyses")
    .select("version")
    .eq("room_id", roomId)
    .order("version", { ascending: false })
    .limit(1);

  await advanceStage(job.id, "generating", "reading the room");

  let diagnosis;
  try {
    diagnosis = await roomVisionAnalyst({
      room,
      home,
      photoCount: photos?.length ?? 0,
      photos: photos ?? []
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Room diagnosis failed.";
    return failJob(job.id, {
      errorCode: "diagnosis_provider_failed",
      ownerMessage: "The room reading didn't finish. You can try again.",
      detail: message
    });
  }

  await advanceStage(job.id, "persisting", "saving the diagnosis");

  // Stale the prior current diagnosis before inserting the new current one.
  await supabase.from("room_analyses").update({ status: "stale" }).eq("room_id", roomId).eq("status", "current");

  const { data: analysis, error: insertError } = await supabase
    .from("room_analyses")
    .insert({
      room_id: roomId,
      analysis: diagnosis,
      version: (existingAnalyses?.[0]?.version ?? 0) + 1,
      status: "current",
      source_photo_ids: (photos ?? []).map((photo) => photo.id),
      brief_snapshot: {
        design_brief: room.design_brief,
        dimensions: room.dimensions
      },
      quality_score: 82,
      test_run_id: room.test_run_id
    })
    .select("*")
    .single();

  if (insertError || !analysis) {
    // Persistence failed AFTER provider success. Fail retryably; a retry
    // regenerates rather than leaving a "complete" job with no artifact.
    return failJob(job.id, {
      errorCode: "diagnosis_persist_failed",
      ownerMessage: "We read the room but couldn't save the result. Please try again.",
      detail: insertError?.message ?? "insert returned no row"
    });
  }

  // Downstream invalidation, identical to the legacy route.
  await supabase
    .from("mood_boards")
    .update({ status: "stale", selected: false })
    .eq("room_id", roomId)
    .in("status", ["draft", "locked", "unlocked"]);

  await supabase
    .from("rooms")
    .update({ status: "analyzed", current_stage: "diagnosed", selected_mood_board_id: null })
    .eq("id", roomId);

  // Completion requires a real artifact ref: the job can never say "done"
  // without pointing at a persisted room_analyses row.
  return completeJob(job.id, { analysis_id: analysis.id, version: analysis.version });
}

/**
 * P0.2 render executor (docs/P0_P1_EXECUTION_PLAN_2026-07-10.md §P0.2).
 *
 * Decomposes single-photo rendering into durable, independently-recorded stages
 * so one approved direction can produce — or recoverably fail — one room-photo
 * edit without losing the owner's instructions:
 *
 *   validating → planning (+critic) → generating (image + upload) → persisting
 *
 * Key resilience properties:
 *  - the critic distinguishes a BLOCKING design violation (terminal design
 *    failure, no image generated) from an OPERATIONAL critic failure/timeout
 *    (recoverable retry, never a silent pass);
 *  - the expensive image is checkpointed to `result_refs` the instant it exists,
 *    so a persistence failure + bounded retry NEVER regenerates a paid image;
 *  - persistence is INSERT-FIRST: the new render is written as `current` before
 *    siblings are staled, so a failed insert leaves the prior current intact
 *    (never "current staled, nothing inserted" — the exact July-10 defect) and a
 *    retry that already inserted reconciles instead of duplicating.
 *
 * Failure fixtures (mock-only; honored via the request-scoped header when this
 * runs inline for a suite) simulate each boundary exactly where it would fail.
 */
async function executeRender(job: GenerationJob): Promise<GenerationJob> {
  const supabase = createServerSupabaseClient();
  const roomId = job.room_id;
  const payload = (job.request_payload as Record<string, unknown>) ?? {};
  const sourcePhotoId = typeof payload.source_photo_id === "string" ? payload.source_photo_id : null;
  const userInstructions = typeof payload.instructions === "string" ? payload.instructions : undefined;
  const checkpoint = (job.result_refs as Record<string, unknown>) ?? {};

  await advanceStage(job.id, "validating", "checking the direction and photo");

  const { data: room, error: roomError } = await supabase.from("rooms").select("*").eq("id", roomId).single();
  if (roomError || !room) {
    return failJob(job.id, {
      errorCode: "room_not_found",
      ownerMessage: "We couldn't find this room.",
      detail: roomError?.message ?? "room missing",
      retryable: false
    });
  }

  if (!sourcePhotoId) {
    return failJob(job.id, {
      errorCode: "missing_source_photo",
      ownerMessage: "Select a source photo before visualizing it.",
      detail: "request_payload.source_photo_id is required",
      retryable: false
    });
  }

  const { data: selectedMoodBoard } = await supabase
    .from("mood_boards")
    .select("*")
    .eq("room_id", roomId)
    .eq("status", "locked")
    .maybeSingle();
  if (!selectedMoodBoard) {
    return failJob(job.id, {
      errorCode: "no_locked_concept",
      ownerMessage: "Lock a concept before visualizing a room photo.",
      detail: "no locked mood_board for room",
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
      errorCode: "source_photo_not_found",
      ownerMessage: "The selected source photo was not found for this room.",
      detail: `photo ${sourcePhotoId} not in room`,
      retryable: false
    });
  }

  // Test-only, mock-only durable failure hook (P0.3). A batch child rendered
  // through the async `after()` path never carries the request-scoped fixture
  // header, so the batch gate injects a forced first-attempt failure via the
  // child payload instead. It fails ONLY the first attempt so a retry recovers
  // (exactly the partial-batch → retry scenario). Inert in live/production.
  const forcedFailure = typeof payload.test_force_failure === "string" ? payload.test_force_failure : null;
  if (forcedFailure && resolveAiMode() === "mock" && job.attempt_count <= 1) {
    return failJob(job.id, {
      errorCode: forcedFailure,
      ownerMessage: "This perspective couldn't be visualized. Your direction is saved — try again.",
      detail: `test_force_failure=${forcedFailure} (attempt ${job.attempt_count})`,
      retryable: true
    });
  }

  // Fast path: a prior attempt already produced (and checkpointed) the paid
  // image. Skip planning + generation entirely and go straight to persistence,
  // so a persistence-only failure never repeats a paid image call.
  const alreadyRendered = checkpoint.image_ready === true && checkpoint.plan;
  let plan = alreadyRendered ? (checkpoint.plan as RenderPlanShape) : null;
  let fileUrl: string | null = alreadyRendered ? ((checkpoint.image_url as string) ?? null) : null;

  if (!alreadyRendered) {
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

    await advanceStage(job.id, "planning", "composing the render plan");

    // The render critic runs inside renderPromptDirector; capture its outcome so
    // we can make the blocking-vs-operational distinction the matrix requires.
    let criticOutcome: RenderCriticOutcome | null = null;
    try {
      plan = (await renderPromptDirector({
        roomId,
        sourcePhotoId,
        moodBoardId: selectedMoodBoard.id,
        room,
        home,
        analysis: latestDiagnosis?.analysis,
        selectedMoodBoard,
        sourcePhoto,
        designPreferences: designPreferences ?? undefined,
        userInstructions,
        onCriticOutcome: (outcome) => {
          criticOutcome = outcome;
        }
      })) as RenderPlanShape;
    } catch (error) {
      return failJob(job.id, {
        errorCode: "render_plan_failed",
        ownerMessage: "The render plan didn't finish. Your instructions are saved — try again.",
        detail: error instanceof Error ? error.message : String(error)
      });
    }

    // Critic outcome gate (before any image is generated).
    if (criticOutcome) {
      const outcome = criticOutcome as RenderCriticOutcome;
      if (outcome.blockingViolations.length) {
        // A door/path/backlight design violation: an actionable DESIGN failure.
        // No image is generated. Terminal — a plain retry with the same inputs
        // would reproduce it; the owner adjusts the direction or instructions.
        return failJob(job.id, {
          errorCode: "render_design_violation",
          ownerMessage:
            "This visualization would block a doorway or walkway in the room. Adjust the direction or your instructions and try again.",
          detail: outcome.blockingViolations.join(" | "),
          retryable: false
        });
      }
      if (outcome.operationalFailure) {
        // The critic itself timed out / errored. Recoverable — never a silent
        // pass. The composed plan is retained on the job for the retry.
        await checkpointResult(job.id, { plan });
        return failJob(job.id, {
          errorCode: "render_critic_unavailable",
          ownerMessage: "We couldn't finish reviewing this visualization. Your instructions are saved — try again.",
          detail: outcome.detail ?? "render critic operational failure"
        });
      }
    }

    // --- generating: produce the image (the paid step in live mode) ---------
    await advanceStage(job.id, "generating", "creating your render");

    const fixture = await activeFailureFixture();
    if (fixture === "image_no_image") {
      return failJob(job.id, {
        errorCode: "image_no_image",
        ownerMessage: "The visualization finished without producing an image. Your instructions and plan were saved — try again.",
        detail: "image_no_image fixture"
      });
    }
    if (fixture === "provider_timeout" || fixture === "provider_rate_limit" || fixture === "provider_server_error") {
      return failJob(job.id, {
        errorCode: fixture,
        ownerMessage: "The image service didn't respond in time. Your instructions and plan were saved — try again.",
        detail: `${fixture} fixture at image stage`
      });
    }
    // Storage-upload failure fixture fires in either mode (in mock the upload
    // step is simulated), matching the boundary the legacy route exercised.
    if (fixture === "storage_upload_failure") {
      return failJob(job.id, {
        errorCode: "storage_upload_failure",
        ownerMessage: "The render couldn't be stored. The generated work is recoverable — try again.",
        detail: "storage_upload_failure fixture"
      });
    }

    const isLiveImageEdit = isOpenAiConfigured() && resolveAiMode() !== "mock";
    if (resolveAiMode() === "mock") {
      // Mock mode makes no paid call: the "edit" is represented by the source
      // photo url (same convention as the legacy route's placeholder).
      fileUrl = sourcePhoto.file_url;
    } else {
      try {
        const imageBase64 = await generateImageEdit({
          roomId,
          serviceName: "Render Image Generator",
          promptVersion: "render_image_v1",
          prompt: plan!.render_prompt,
          sourceImageUrl: sourcePhoto.file_url
        });
        if (!imageBase64) {
          return failJob(job.id, {
            errorCode: "image_no_image",
            ownerMessage: "The visualization finished without producing an image. Your instructions and plan were saved — try again.",
            detail: "live image edit returned no image"
          });
        }
        const serviceSupabase = createServiceSupabaseClient();
        const storagePath = `${roomId}/renders/${crypto.randomUUID()}.png`;
        const imageBytes = Uint8Array.from(atob(imageBase64), (char) => char.charCodeAt(0));
        const { error: uploadError } = await serviceSupabase.storage
          .from("room-photos")
          .upload(storagePath, imageBytes, { contentType: "image/png", cacheControl: "3600", upsert: false });
        if (uploadError) {
          return failJob(job.id, {
            errorCode: "storage_upload_failure",
            ownerMessage: "The render couldn't be stored. The generated work is recoverable — try again.",
            detail: uploadError.message
          });
        }
        const { data: publicUrlData } = serviceSupabase.storage.from("room-photos").getPublicUrl(storagePath);
        fileUrl = publicUrlData.publicUrl;
      } catch (error) {
        // A live provider timeout/429/5xx: recoverable, bounded retry (same
        // idempotency key, same job). The paid attempt produced nothing to
        // preserve, so a retry legitimately re-attempts generation.
        return failJob(job.id, {
          errorCode: "image_generation_failed",
          ownerMessage: "The image service didn't respond. Your instructions and plan were saved — try again.",
          detail: error instanceof Error ? error.message : String(error)
        });
      }
      void isLiveImageEdit;
    }

    // Checkpoint the expensive result the instant it exists. From here on, any
    // failure + retry reuses this and never regenerates a paid image.
    await checkpointResult(job.id, { plan, image_url: fileUrl, image_ready: true });
  }

  if (!plan) {
    return failJob(job.id, {
      errorCode: "render_plan_missing",
      ownerMessage: "The render plan was lost. Your instructions are saved — try again.",
      detail: "no plan available at persistence stage"
    });
  }

  // --- persisting: INSERT-FIRST atomicity ---------------------------------
  await advanceStage(job.id, "persisting", "saving your render");

  const fixture = await activeFailureFixture();
  if (fixture === "db_persist_failure") {
    // Reproduce a persistence failure. With insert-first ordering NOTHING has
    // been staled or inserted yet, so the prior current render is untouched —
    // the July-10 "current staled, nothing inserted" defect can no longer occur.
    // The image is checkpointed, so a retry completes WITHOUT a second paid call.
    logStructured("render_failure", {
      correlation_id: job.correlation_id,
      room_id: roomId,
      job_id: job.id,
      error_code: "db_persist_failure",
      stage: "persisting"
    });
    return failJob(job.id, {
      errorCode: "db_persist_failure",
      ownerMessage: "The finished render couldn't be saved. The generated work is recoverable — try again.",
      detail: "db_persist_failure fixture"
    });
  }

  // Idempotent re-entry: if a prior attempt already inserted the render row,
  // reconcile (ensure current + stale siblings) instead of inserting a duplicate.
  let renderId = typeof checkpoint.render_id === "string" ? checkpoint.render_id : null;
  if (!renderId) {
    const { data: inserted, error: insertError } = await supabase
      .from("renders")
      .insert({
        room_id: roomId,
        mood_board_id: selectedMoodBoard.id,
        mood_board_version: selectedMoodBoard.version ?? null,
        source_photo_id: sourcePhotoId,
        file_url: fileUrl,
        prompt: plan.render_prompt,
        render_prompt: plan.render_prompt,
        preservation_constraints: plan.preservation_constraints,
        transformation_instructions: plan.transformation_instructions,
        negative_instructions: plan.negative_instructions,
        user_regeneration_instructions: userInstructions ?? null,
        generated_image_path: fileUrl,
        status: "current",
        critique: plan.critique,
        quality_score: plan.quality_score,
        test_run_id: room.test_run_id
      })
      .select("*")
      .single();

    if (insertError || !inserted) {
      // Insert failed AFTER the paid image succeeded. Nothing was staled, so the
      // prior current is intact. The image is checkpointed → retry persists it.
      return failJob(job.id, {
        errorCode: "render_persist_failed",
        ownerMessage: "The finished render couldn't be saved. The generated work is recoverable — try again.",
        detail: insertError?.message ?? "insert returned no row"
      });
    }
    renderId = inserted.id;
    await checkpointResult(job.id, { render_id: renderId });
  }

  // Stale sibling currents for this photo (never the just-inserted row). If this
  // fails, the new render is already current and a retry (render_id checkpointed)
  // re-runs only this idempotent step — one current per photo is restored.
  const { error: staleError } = await supabase
    .from("renders")
    .update({ status: "stale" })
    .eq("room_id", roomId)
    .eq("source_photo_id", sourcePhotoId)
    .eq("status", "current")
    .neq("id", renderId);
  if (staleError) {
    return failJob(job.id, {
      errorCode: "render_stale_failed",
      ownerMessage: "The render was saved but tidying up the previous version didn't finish. Try again.",
      detail: staleError.message
    });
  }

  await supabase.from("rooms").update({ status: "renders", current_stage: "executing" }).eq("id", roomId);

  return completeJob(job.id, { render_id: renderId });
}

/**
 * P0.3 batch render executor (docs/P0_P1_EXECUTION_PLAN_2026-07-10.md §P0.3).
 *
 * Delivers one approved direction across all eligible room photos as a single
 * understandable, durable, partially-recoverable operation. The parent
 * `batch_render` job ORCHESTRATES one child `render` job per selected photo,
 * reusing the entire P0.2 render pipeline (idempotency, checkpointing,
 * insert-first atomicity, the critic gate). It owns three things the children
 * cannot: photo selection, bounded concurrency, and cross-photo consistency.
 *
 * Resilience properties:
 *  - each photo is its OWN durable child row, so a failure on one photo leaves
 *    the others' completed renders intact and makes only that photo retryable
 *    (retry is the existing per-child endpoint — siblings never regenerate);
 *  - the child list is checkpointed to the parent BEFORE any child runs, so a
 *    stale-reclaim of the parent resumes: completed children are skipped and
 *    only unfinished ones run again (no duplicate paid calls);
 *  - children are created UNSCHEDULED and driven only here, so the batch never
 *    exceeds its concurrency and rapid double-clicks dedupe to one batch (the
 *    parent's own idempotency key is `batch_render|room`).
 */
async function executeBatchRender(job: GenerationJob): Promise<GenerationJob> {
  const supabase = createServerSupabaseClient();
  const roomId = job.room_id;
  const payload = (job.request_payload as Record<string, unknown>) ?? {};
  const checkpoint = (job.result_refs as Record<string, unknown>) ?? {};

  await advanceStage(job.id, "validating", "checking the direction and photos");

  const { data: room, error: roomError } = await supabase.from("rooms").select("*").eq("id", roomId).single();
  if (roomError || !room) {
    return failJob(job.id, {
      errorCode: "room_not_found",
      ownerMessage: "We couldn't find this room.",
      detail: roomError?.message ?? "room missing",
      retryable: false
    });
  }

  const { data: locked } = await supabase
    .from("mood_boards")
    .select("id, version")
    .eq("room_id", roomId)
    .eq("status", "locked")
    .maybeSingle();
  if (!locked) {
    return failJob(job.id, {
      errorCode: "no_locked_concept",
      ownerMessage: "Approve a direction before visualizing the whole room.",
      detail: "no locked mood_board for room",
      retryable: false
    });
  }

  // Resume-safe: reuse the child list checkpointed on a prior attempt; otherwise
  // resolve the selection and create the children (once).
  let items: BatchItem[] = Array.isArray(checkpoint.items) ? (checkpoint.items as BatchItem[]) : [];
  let selectedPhotoIds: string[] = Array.isArray(checkpoint.selected_photo_ids)
    ? (checkpoint.selected_photo_ids as string[])
    : [];

  if (!items.length) {
    const { data: photos } = await supabase
      .from("photos")
      .select("id, label, angle_type, file_url")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });
    const roomPhotos = photos ?? [];

    // Explicit owner selection wins (they may have opted a normally-excluded
    // photo in or a perspective out); otherwise default to eligible perspectives.
    const requested = Array.isArray(payload.photo_ids) ? (payload.photo_ids as unknown[]).map(String) : null;
    selectedPhotoIds =
      requested && requested.length
        ? requested.filter((id) => roomPhotos.some((p) => p.id === id))
        : classifyPhotos(roomPhotos)
            .filter((p) => p.eligible)
            .map((p) => p.photo_id);

    if (!selectedPhotoIds.length) {
      return failJob(job.id, {
        errorCode: "no_eligible_photos",
        ownerMessage: "There are no room perspectives to visualize yet. Add a room photo and try again.",
        detail: "no eligible/selected photos for batch",
        retryable: false
      });
    }

    // Test-only, mock-only: force specific photos to fail their first attempt so
    // the partial-batch + retry gate is deterministic through the async path.
    const forceFail = new Set(
      Array.isArray(payload.test_force_failure_photo_ids)
        ? (payload.test_force_failure_photo_ids as unknown[]).map(String)
        : []
    );

    for (const photoId of selectedPhotoIds) {
      const childPayload: Record<string, unknown> = { source_photo_id: photoId, batch_id: job.id };
      if (forceFail.has(photoId)) childPayload.test_force_failure = "batch_perspective_failed";
      const { job: child } = await createOrGetActiveJob({
        roomId,
        jobType: "render",
        requestPayload: childPayload,
        requestedBy: "batch",
        correlationId: job.correlation_id,
        testRunId: job.test_run_id
      });
      items.push({ photo_id: photoId, child_job_id: child.id });
    }
    await checkpointResult(job.id, { batch_id: job.id, selected_photo_ids: selectedPhotoIds, items });
  }

  const total = items.length;
  const completedNow = async () => {
    const children = await Promise.all(items.map((i) => getJob(i.child_job_id, roomId)));
    return children.filter((c) => c?.status === "completed").length;
  };

  await advanceStage(job.id, "generating", `0 of ${total} complete`, { current: await completedNow(), total });

  // --- Drive children with bounded concurrency ------------------------------
  const queue = [...items];
  const drive = async () => {
    while (queue.length) {
      const item = queue.shift();
      if (!item) break;
      await driveChild(item.child_job_id, roomId);
      const done = await completedNow();
      await advanceStage(job.id, "generating", `${done} of ${total} complete`, { current: done, total });
    }
  };
  await Promise.all(Array.from({ length: Math.min(batchConcurrency(), total) }, () => drive()));

  // --- Consistency across the completed perspectives ------------------------
  await advanceStage(job.id, "persisting", "checking the set holds together");

  const finalChildren = await Promise.all(items.map((i) => getJob(i.child_job_id, roomId)));
  const completedChildren = finalChildren.filter((c) => c?.status === "completed");
  const failedChildren = finalChildren.filter(
    (c) => c && (c.status === "retryable_failed" || c.status === "terminal_failed")
  );

  const renderIds = completedChildren
    .map((c) => (c?.result_refs as Record<string, unknown> | undefined)?.render_id)
    .filter((id): id is string => typeof id === "string");

  let consistency = evaluateBatchConsistency([], { lockedVersion: locked.version });
  if (renderIds.length) {
    const { data: renders } = await supabase
      .from("renders")
      .select("id, source_photo_id, mood_board_version, preservation_constraints, transformation_instructions, negative_instructions, render_prompt")
      .in("id", renderIds);
    consistency = evaluateBatchConsistency((renders ?? []) as RenderForConsistency[], { lockedVersion: locked.version });
  }

  const summary = {
    batch_id: job.id,
    selected_photo_ids: selectedPhotoIds,
    items,
    consistency,
    completed: completedChildren.length,
    failed: failedChildren.length,
    total
  };

  logStructured("batch_render_settled", {
    correlation_id: job.correlation_id,
    room_id: roomId,
    job_id: job.id,
    completed: completedChildren.length,
    failed: failedChildren.length,
    total,
    consistency_passed: consistency.passed
  });

  // Partial success is success: as long as one perspective landed, the batch
  // completed and the failed photos stay individually retryable via their child
  // jobs (surfaced by the batch view). Only an all-failed batch is a failure.
  if (completedChildren.length >= 1) {
    return completeJob(job.id, summary);
  }
  await checkpointResult(job.id, summary);
  return failJob(job.id, {
    errorCode: "batch_all_failed",
    ownerMessage: "None of the perspectives could be visualized. Your direction is saved — try again.",
    detail: `0/${total} perspectives completed`
  });
}

/**
 * Advance one child render job by exactly one execution. Completed/terminal
 * children are left untouched (so siblings never regenerate); a crashed
 * (stale-heartbeat) child is reclaimed first; a retryable child is left for the
 * owner's explicit retry. Only a queued child is actually run here.
 */
async function driveChild(childId: string, roomId: string): Promise<void> {
  let child = await getJob(childId, roomId);
  if (!child) return;
  if (TERMINAL_STATUSES.includes(child.status as JobStatus)) return;
  if (child.status === "retryable_failed") return;
  if (isStale(child)) {
    const reclaimed = await reclaimIfStale(child);
    child = reclaimed ?? (await getJob(childId, roomId));
  }
  if (child && child.status === "queued") {
    await runJobNow(childId);
  }
}

/** Minimal shape of the render plan consumed at persistence (see services.RenderPlan). */
interface RenderPlanShape {
  render_prompt: string;
  preservation_constraints: Json;
  transformation_instructions: Json;
  negative_instructions: Json;
  critique: Json;
  quality_score: number | null;
}
