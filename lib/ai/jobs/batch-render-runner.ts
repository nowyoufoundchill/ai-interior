import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isEligiblePerspectiveLabel } from "@/lib/constants";
import { advanceStage, completeJob, createOrGetActiveJob, failJob, listChildJobs, getJob } from "./service";
import { runJobNow } from "./runners";
import type { GenerationJob, Json, Photo } from "@/types/database";

/**
 * P0.3 all-perspective render batch runner
 * (docs/P0_P1_EXECUTION_PLAN_2026-07-10.md §P0.3).
 *
 * A batch is a parent `batch_render` job with one child `render` job per
 * eligible photo. Children are ordinary durable render jobs (the P0.2
 * `executeRender` runner, unchanged) linked by `parent_job_id`, so each
 * per-photo edit is independently checkpointed, atomic, and retryable.
 *
 * Guarantees for the §P0.3 gate:
 *  - one confirmed batch action produces one linked render per eligible photo;
 *  - children run with bounded concurrency (never a burst of paid calls);
 *  - a failed photo leaves its successful siblings intact;
 *  - re-running the batch SKIPS already-completed children — retrying one
 *    perspective never regenerates or stales the others;
 *  - progress (`n of m`) is persisted on the parent so refresh/close is safe.
 */

const BATCH_CONCURRENCY = 2;

export function selectBatchPhotos(photos: Photo[], explicitIds?: string[]): Photo[] {
  if (explicitIds && explicitIds.length) {
    const wanted = new Set(explicitIds);
    return photos.filter((p) => wanted.has(p.id));
  }
  // Perspective photos render by default; ceiling/floor/existing-item/
  // inspiration are excluded unless explicitly selected (shared rule).
  return photos.filter((p) => isEligiblePerspectiveLabel(p.label));
}

export async function executeBatchRender(job: GenerationJob): Promise<GenerationJob> {
  const supabase = createServerSupabaseClient();
  const roomId = job.room_id;
  const payload = (job.request_payload ?? {}) as { photo_ids?: string[]; instructions?: string };

  await advanceStage(job.id, "validating", "selecting eligible perspectives");

  const { data: room } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
  if (!room) {
    return failJob(job.id, { errorCode: "room_not_found", ownerMessage: "We couldn't find this room.", retryable: false });
  }

  const { data: lockedConcept } = await supabase
    .from("mood_boards")
    .select("id")
    .eq("room_id", roomId)
    .eq("status", "locked")
    .maybeSingle();
  if (!lockedConcept) {
    return failJob(job.id, {
      errorCode: "render_no_locked_concept",
      ownerMessage: "Lock a concept before rendering all perspectives.",
      retryable: false
    });
  }

  const { data: allPhotos } = await supabase
    .from("photos")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });
  const photos = selectBatchPhotos((allPhotos as Photo[]) ?? [], payload.photo_ids);

  if (!photos.length) {
    return failJob(job.id, {
      errorCode: "batch_no_eligible_photos",
      ownerMessage: "No eligible room perspectives to render. Add or select a room-angle photo first.",
      retryable: false
    });
  }

  // Reconcile children with the selected photos. Existing completed children are
  // preserved (skip); missing/failed ones are (re)created and re-run. This makes
  // a batch retry re-render only the outstanding perspectives.
  const existingChildren = await listChildJobs(job.id, supabase);
  const childByPhoto = new Map<string, GenerationJob>();
  for (const child of existingChildren) {
    const photoId = (child.request_payload as { source_photo_id?: string })?.source_photo_id;
    if (photoId) childByPhoto.set(photoId, child);
  }

  const instructions = typeof payload.instructions === "string" ? payload.instructions : undefined;
  const pending: string[] = [];
  const completedRenderIds: string[] = [];

  for (const photo of photos) {
    const existing = childByPhoto.get(photo.id);
    if (existing?.status === "completed") {
      const renderId = (existing.result_refs as { render_id?: string })?.render_id;
      if (renderId) completedRenderIds.push(renderId);
      continue;
    }
    // Child idempotency is keyed per batch + photo so batch items are distinct
    // from ad-hoc single renders and stable across a batch retry.
    const childKey = `render|${roomId}|photo:${photo.id}|batch:${job.id}`;
    const { job: child } = await createOrGetActiveJob(
      {
        roomId,
        jobType: "render",
        requestPayload: { source_photo_id: photo.id, instructions },
        requestedBy: "batch",
        correlationId: job.correlation_id,
        testRunId: job.test_run_id,
        idempotencyKey: childKey,
        parentJobId: job.id
      },
      supabase
    );
    // If a prior attempt left this child failed, requeue it in place.
    if (["retryable_failed", "terminal_failed"].includes(child.status)) {
      await supabase
        .from("generation_jobs")
        .update({ status: "queued", stage: "queued", heartbeat_at: new Date().toISOString() })
        .eq("id", child.id)
        .in("status", ["retryable_failed", "terminal_failed"]);
    }
    pending.push(child.id);
  }

  const total = photos.length;
  await advanceStage(job.id, "generating", `rendering ${pending.length} of ${total} perspective(s)`, {
    current: completedRenderIds.length,
    total
  });

  // Run pending children with bounded concurrency.
  let completed = completedRenderIds.length;
  const failedPhotoIds: string[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < pending.length) {
      const childId = pending[cursor++];
      const result = await runJobNow(childId);
      const settled = result.job ?? (await getJob(childId, undefined, supabase));
      if (settled?.status === "completed") {
        const renderId = (settled.result_refs as { render_id?: string })?.render_id;
        if (renderId) completedRenderIds.push(renderId);
        completed += 1;
      } else {
        const photoId = (settled?.request_payload as { source_photo_id?: string })?.source_photo_id;
        if (photoId) failedPhotoIds.push(photoId);
      }
      await advanceStage(job.id, "generating", `rendered ${completed} of ${total}`, { current: completed, total });
    }
  }

  await Promise.all(Array.from({ length: Math.min(BATCH_CONCURRENCY, pending.length) }, () => worker()));

  await advanceStage(job.id, "persisting", "finalizing the batch", { current: completed, total });

  const refs: Record<string, unknown> = {
    render_ids: completedRenderIds,
    completed,
    total,
    failed_photo_ids: failedPhotoIds
  };

  // Every eligible photo is completed, or the batch is partially successful and
  // retryable — successful siblings are already persisted as current renders.
  if (failedPhotoIds.length === 0 && completedRenderIds.length > 0) {
    return completeJob(job.id, refs);
  }

  // Persist the partial-success summary on the parent so the owner can retry
  // only the failed perspectives; keep result_refs on the row for the UI.
  await supabase.from("generation_jobs").update({ result_refs: refs as Json }).eq("id", job.id);
  return failJob(job.id, {
    errorCode: completedRenderIds.length ? "batch_partial" : "batch_all_failed",
    ownerMessage: completedRenderIds.length
      ? `${completed} of ${total} perspectives rendered. ${failedPhotoIds.length} can be retried.`
      : "None of the perspectives could be rendered. You can try again.",
    detail: `failed photos: ${failedPhotoIds.join(", ")}`,
    retryable: true
  });
}
