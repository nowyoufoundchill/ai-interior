import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { currentCorrelationId } from "@/lib/observability";
import {
  createOrGetActiveJob,
  getJob,
  JobsTableMissingError,
  reclaimIfStale,
  toOwnerSafeJob
} from "@/lib/ai/jobs/service";
import { scheduleJob } from "@/lib/ai/jobs/runtime";
import { batchConcurrency, type BatchItem } from "@/lib/ai/jobs/runners";
import { classifyPhotos, defaultSelection, estimateBatch } from "@/lib/ai/photo-eligibility";
import { evaluateBatchConsistency, type RenderForConsistency } from "@/lib/ai/batch-consistency";
import type { GenerationJob } from "@/types/database";

/**
 * P0.3 render-batch surface (docs/P0_P1_EXECUTION_PLAN_2026-07-10.md §P0.3).
 *
 * GET  — the batch VIEW: photo eligibility + a spend estimate for the confirm
 *        step, plus the latest batch composed with per-photo child status and
 *        the render each produced. This is the UI's source of truth (per-photo
 *        state comes from the durable child jobs, not the parent alone).
 * POST — create-or-return the active batch_render job and schedule it to run
 *        past this request. Rapid double-clicks dedupe to one batch.
 */

interface BatchPhotoView {
  photo_id: string;
  label: string | null;
  file_url: string;
  child_job_id: string | null;
  status: string; // pending | queued | running | completed | retryable_failed | terminal_failed | cancelled
  error_code: string | null;
  error_message: string | null;
  render: { id: string; file_url: string | null } | null;
}

function childStatusToPhoto(status: string): string {
  if (status === "completed") return "completed";
  if (status === "retryable_failed") return "retryable_failed";
  if (status === "terminal_failed") return "terminal_failed";
  if (status === "cancelled") return "cancelled";
  if (status === "queued") return "queued";
  return "running"; // planning | validating | generating | persisting
}

export async function GET(_request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const supabase = createServerSupabaseClient();

  const { data: room, error: roomError } = await supabase.from("rooms").select("id").eq("id", roomId).maybeSingle();
  if (roomError || !room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  const { data: photos } = await supabase
    .from("photos")
    .select("id, label, angle_type, file_url")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });
  const roomPhotos = photos ?? [];
  const eligibility = classifyPhotos(roomPhotos);
  const eligibleCount = eligibility.filter((p) => p.eligible).length;
  const concurrency = batchConcurrency();

  // Latest batch_render job for the room (tolerant of the table being absent).
  let batchJob: GenerationJob | null = null;
  try {
    const { data } = await supabase
      .from("generation_jobs")
      .select("*")
      .eq("room_id", roomId)
      .eq("job_type", "batch_render")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    batchJob = (data as GenerationJob | null) ?? null;
  } catch {
    batchJob = null;
  }

  // Resume a crashed batch surfaced here (bounded by max_attempts).
  if (batchJob) {
    const reclaimed = await reclaimIfStale(batchJob);
    if (reclaimed) {
      scheduleJob(reclaimed.id);
      batchJob = reclaimed;
    }
  }

  let batch: {
    job: Omit<GenerationJob, "error_detail">;
    photos: BatchPhotoView[];
    completed: number;
    failed: number;
    total: number;
    consistency: unknown;
  } | null = null;

  if (batchJob) {
    const refs = (batchJob.result_refs as Record<string, unknown>) ?? {};
    const items: BatchItem[] = Array.isArray(refs.items) ? (refs.items as BatchItem[]) : [];

    const children = await Promise.all(
      items.map((item) => getJob(item.child_job_id, roomId).then((job) => ({ item, job })))
    );

    // Current render per source photo, so a completed child shows its result.
    const photoIds = items.map((i) => i.photo_id);
    const { data: renders } = photoIds.length
      ? await supabase
          .from("renders")
          .select(
            "id, source_photo_id, file_url, status, mood_board_version, preservation_constraints, transformation_instructions, negative_instructions, render_prompt"
          )
          .eq("room_id", roomId)
          .in("source_photo_id", photoIds)
          .eq("status", "current")
      : { data: [] };
    const currentByPhoto = new Map<string, { id: string; file_url: string | null }>();
    for (const r of renders ?? []) {
      if (r.source_photo_id) currentByPhoto.set(r.source_photo_id, { id: r.id, file_url: r.file_url });
    }

    const photoMeta = new Map(roomPhotos.map((p) => [p.id, p]));
    const photoViews: BatchPhotoView[] = children.map(({ item, job }) => {
      const meta = photoMeta.get(item.photo_id);
      return {
        photo_id: item.photo_id,
        label: meta?.label ?? null,
        file_url: meta?.file_url ?? "",
        child_job_id: item.child_job_id,
        status: job ? childStatusToPhoto(job.status) : "pending",
        error_code: job?.error_code ?? null,
        error_message: job?.error_message ?? null,
        render: currentByPhoto.get(item.photo_id) ?? null
      };
    });

    // Consistency is computed LIVE from the completed perspectives' current
    // renders (not read from the parent's snapshot), so it always reflects the
    // set as it stands — including any photo recovered by a later retry.
    const completedPhotoIds = new Set(photoViews.filter((p) => p.status === "completed").map((p) => p.photo_id));
    const completedRenders = (renders ?? []).filter(
      (r) => r.source_photo_id && completedPhotoIds.has(r.source_photo_id)
    ) as RenderForConsistency[];
    const { data: locked } = await supabase
      .from("mood_boards")
      .select("version")
      .eq("room_id", roomId)
      .eq("status", "locked")
      .maybeSingle();
    const consistency = evaluateBatchConsistency(completedRenders, { lockedVersion: locked?.version ?? null });

    batch = {
      job: toOwnerSafeJob(batchJob),
      photos: photoViews,
      completed: photoViews.filter((p) => p.status === "completed").length,
      failed: photoViews.filter((p) => p.status === "retryable_failed" || p.status === "terminal_failed").length,
      total: photoViews.length,
      consistency
    };
  }

  return NextResponse.json({
    eligibility: { photos: eligibility, eligible_count: eligibleCount },
    estimate: estimateBatch(eligibleCount, concurrency),
    concurrency,
    batch
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const body = await request.json().catch(() => ({}) as Record<string, unknown>);

  const supabase = createServerSupabaseClient();
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, test_run_id")
    .eq("id", roomId)
    .maybeSingle();
  if (roomError || !room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  // Resolve the selection now so the parent's progress_total is right from the
  // first status read (the runner re-resolves identically and is authoritative).
  const { data: photos } = await supabase
    .from("photos")
    .select("id, label, angle_type, file_url")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });
  const roomPhotos = photos ?? [];
  const requested = Array.isArray(body.photo_ids) ? (body.photo_ids as unknown[]).map(String) : null;
  const selection =
    requested && requested.length
      ? requested.filter((id) => roomPhotos.some((p) => p.id === id))
      : defaultSelection(roomPhotos);

  if (!selection.length) {
    return NextResponse.json(
      { error: "There are no room perspectives to visualize yet. Add a room photo and try again." },
      { status: 400 }
    );
  }

  const requestPayload: Record<string, unknown> = { photo_ids: selection };
  if (Array.isArray(body.test_force_failure_photo_ids)) {
    requestPayload.test_force_failure_photo_ids = (body.test_force_failure_photo_ids as unknown[]).map(String);
  }

  const correlationId = await currentCorrelationId();

  try {
    const { job, created } = await createOrGetActiveJob({
      roomId,
      jobType: "batch_render",
      requestPayload,
      requestedBy: "owner",
      correlationId,
      testRunId: room.test_run_id,
      progressTotal: selection.length
    });

    if (created) scheduleJob(job.id);

    return NextResponse.json({ job: toOwnerSafeJob(job), created }, { status: created ? 202 : 200 });
  } catch (error) {
    if (error instanceof JobsTableMissingError) {
      return NextResponse.json({ error: error.message, code: "jobs_table_missing" }, { status: 503 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start the batch." },
      { status: 500 }
    );
  }
}
