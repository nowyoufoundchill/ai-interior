import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { currentCorrelationId } from "@/lib/observability";
import {
  ACTIVE_STATUSES,
  createOrGetActiveJob,
  JobsTableMissingError,
  reclaimIfStale,
  toOwnerSafeJob,
  type JobType
} from "@/lib/ai/jobs/service";
import { scheduleJob } from "@/lib/ai/jobs/runtime";
import type { GenerationJob } from "@/types/database";

const SUPPORTED_JOB_TYPES: JobType[] = ["diagnosis", "render"];

/**
 * P0.1 durable job surface (docs/P0_P1_EXECUTION_PLAN_2026-07-10.md §P0.1).
 *
 * POST creates-or-returns the active job for an owner action and schedules its
 * execution to continue past this request (via `after()`), returning 202 with
 * the job so the browser can poll status. GET lists the room's active/recent
 * jobs so reopening a room shows in-flight work without duplicating it.
 */

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const jobType = String(body.job_type ?? "") as JobType;

  if (!SUPPORTED_JOB_TYPES.includes(jobType)) {
    return NextResponse.json(
      { error: `Unsupported job_type. Supported: ${SUPPORTED_JOB_TYPES.join(", ")}.` },
      { status: 400 }
    );
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
    const { job, created } = await createOrGetActiveJob({
      roomId,
      jobType,
      requestPayload: (body.payload as Record<string, unknown>) ?? {},
      requestedBy: "owner",
      correlationId,
      testRunId: room.test_run_id
    });

    // Only schedule execution for a freshly created job. A deduped active job
    // is already running (or scheduled), so rapid double-clicks never launch a
    // second execution of the same logical action.
    if (created) scheduleJob(job.id);

    return NextResponse.json({ job: toOwnerSafeJob(job), created }, { status: created ? 202 : 200 });
  } catch (error) {
    if (error instanceof JobsTableMissingError) {
      return NextResponse.json({ error: error.message, code: "jobs_table_missing" }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to start job." }, { status: 500 });
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const url = new URL(request.url);
  const typeFilter = url.searchParams.get("type");
  const activeOnly = url.searchParams.get("active") === "1";

  const supabase = createServerSupabaseClient();
  let query = supabase
    .from("generation_jobs")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (typeFilter) query = query.eq("job_type", typeFilter);
  if (activeOnly) query = query.in("status", ACTIVE_STATUSES);

  const { data, error } = await query;
  if (error) {
    if (/generation_jobs/.test(error.message)) {
      return NextResponse.json({ jobs: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Opportunistically reclaim any stale running job surfaced here so a
  // dashboard/room reopen after a crash resumes work bounded by max_attempts.
  const jobs = (data as GenerationJob[]) ?? [];
  for (const job of jobs) {
    const reclaimed = await reclaimIfStale(job);
    if (reclaimed) scheduleJob(reclaimed.id);
  }

  return NextResponse.json({ jobs: jobs.map(toOwnerSafeJob) });
}
