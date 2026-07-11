import { roomVisionAnalyst } from "@/lib/ai/services";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { advanceStage, claimJob, completeJob, failJob, getJob } from "./service";
import { executeRender } from "./render-runner";
import type { GenerationJob } from "@/types/database";

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
      default: {
        // Remaining job types (batch_render, chat_action, products) land in
        // P0.3+. Fail closed rather than silently completing.
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
