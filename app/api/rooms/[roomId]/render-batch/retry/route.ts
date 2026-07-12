import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getJob, requeueJob, JobsTableMissingError } from "@/lib/ai/jobs/service";
import { scheduleJob } from "@/lib/ai/jobs/runtime";
import type { BatchItem } from "@/lib/ai/jobs/runners";
import type { GenerationJob } from "@/types/database";

/**
 * P0.3 batch retry (docs/P0_P1_EXECUTION_PLAN_2026-07-10.md §P0.3 task 8):
 * retry failed / retry selected. Requeues and reschedules only the matching
 * failed CHILD render jobs, each independently — a completed sibling is never
 * touched, so retrying one perspective never regenerates the others.
 *
 * Body: { photo_ids?: string[] } — omit to retry every retryable failed photo.
 */
export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const body = await request.json().catch(() => ({}) as Record<string, unknown>);
  const scope = Array.isArray(body.photo_ids) ? new Set((body.photo_ids as unknown[]).map(String)) : null;

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
    return NextResponse.json({ error: "No batch to retry for this room." }, { status: 404 });
  }

  const refs = (batchJob.result_refs as Record<string, unknown>) ?? {};
  const items: BatchItem[] = Array.isArray(refs.items) ? (refs.items as BatchItem[]) : [];
  const inScope = scope ? items.filter((i) => scope.has(i.photo_id)) : items;

  const retried: string[] = [];
  const exhausted: string[] = [];
  try {
    for (const item of inScope) {
      const child = await getJob(item.child_job_id, roomId);
      if (!child) continue;
      if (child.status !== "retryable_failed") continue; // only failed-with-attempts-left
      const requeued = await requeueJob(item.child_job_id);
      if (requeued) {
        scheduleJob(requeued.id);
        retried.push(item.photo_id);
      } else {
        exhausted.push(item.photo_id);
      }
    }
  } catch (error) {
    if (error instanceof JobsTableMissingError) {
      return NextResponse.json({ error: error.message, code: "jobs_table_missing" }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Retry failed." }, { status: 500 });
  }

  return NextResponse.json({ retried, exhausted, retried_count: retried.length }, { status: retried.length ? 202 : 409 });
}
