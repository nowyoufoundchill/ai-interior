import { NextResponse } from "next/server";
import { getJob, listChildJobs, reclaimIfStale, toOwnerSafeJob, JobsTableMissingError } from "@/lib/ai/jobs/service";
import { scheduleJob } from "@/lib/ai/jobs/runtime";

/**
 * P0.1 job status endpoint. Room-scoped (a job is only readable in the context
 * of its room). Reading a status also reclaims a stale/crashed running job
 * (bounded by max_attempts) and reschedules it, so a page refresh or reopen is
 * itself a recovery trigger — no separate cron needed for the common case.
 */
export async function GET(_: Request, { params }: { params: Promise<{ roomId: string; jobId: string }> }) {
  const { roomId, jobId } = await params;

  try {
    const job = await getJob(jobId, roomId);
    if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });

    const reclaimed = await reclaimIfStale(job);
    const current = reclaimed ?? job;
    if (reclaimed) scheduleJob(reclaimed.id);

    // For a batch, surface per-photo child state so the UI can show which
    // perspective is rendering, done, or failed.
    const children =
      current.job_type === "batch_render"
        ? (await listChildJobs(current.id)).map((child) => ({
            id: child.id,
            source_photo_id: (child.request_payload as { source_photo_id?: string })?.source_photo_id ?? null,
            status: child.status,
            stage: child.stage,
            error_message: child.error_message,
            render_id: (child.result_refs as { render_id?: string })?.render_id ?? null
          }))
        : undefined;

    return NextResponse.json({ job: toOwnerSafeJob(current), reclaimed: Boolean(reclaimed), ...(children ? { children } : {}) });
  } catch (error) {
    if (error instanceof JobsTableMissingError) {
      return NextResponse.json({ error: error.message, code: "jobs_table_missing" }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to read job." }, { status: 500 });
  }
}
