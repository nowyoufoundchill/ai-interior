import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cancelJob, getJob, ACTIVE_STATUSES, JobsTableMissingError, type JobStatus } from "@/lib/ai/jobs/service";
import type { BatchItem } from "@/lib/ai/jobs/runners";
import type { GenerationJob } from "@/types/database";

/**
 * P0.3 cancel remaining (docs/P0_P1_EXECUTION_PLAN_2026-07-10.md §P0.3 task 8).
 * Cancels the parent batch and any still-active child render jobs. Completed
 * perspectives are terminal and are left intact (append-only artifact contract).
 */
export async function POST(_request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const supabase = createServerSupabaseClient();

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
    return NextResponse.json({ error: "Durable jobs are unavailable.", code: "jobs_table_missing" }, { status: 503 });
  }

  if (!batchJob) {
    return NextResponse.json({ error: "No batch to cancel for this room." }, { status: 404 });
  }

  const refs = (batchJob.result_refs as Record<string, unknown>) ?? {};
  const items: BatchItem[] = Array.isArray(refs.items) ? (refs.items as BatchItem[]) : [];
  const active = new Set<JobStatus>(ACTIVE_STATUSES);

  const cancelled: string[] = [];
  try {
    for (const item of items) {
      const child = await getJob(item.child_job_id, roomId);
      if (child && active.has(child.status as JobStatus)) {
        const done = await cancelJob(item.child_job_id, roomId);
        if (done) cancelled.push(item.photo_id);
      }
    }
    // Cancel the parent last so a resume can't re-open cancelled children.
    await cancelJob(batchJob.id, roomId);
  } catch (error) {
    if (error instanceof JobsTableMissingError) {
      return NextResponse.json({ error: error.message, code: "jobs_table_missing" }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Cancel failed." }, { status: 500 });
  }

  return NextResponse.json({ cancelled, cancelled_count: cancelled.length }, { status: 200 });
}
