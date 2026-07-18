import { NextResponse } from "next/server";
import { getJob, reclaimIfStale, toOwnerSafeJob, JobsTableMissingError } from "@/lib/ai/jobs/service";
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

    // A deployment or local dev callback can end after persisting the queued
    // row but before `after()` begins execution. Polling is also a recovery
    // trigger: reschedule queued work and let claimJob enforce exactly-once
    // execution when multiple reopen/poll requests arrive together.
    if (job.status === "queued") {
      scheduleJob(job.id);
      return NextResponse.json({ job: toOwnerSafeJob(job), rescheduled: true });
    }

    const reclaimed = await reclaimIfStale(job);
    if (reclaimed) {
      scheduleJob(reclaimed.id);
      return NextResponse.json({ job: toOwnerSafeJob(reclaimed), reclaimed: true });
    }

    return NextResponse.json({ job: toOwnerSafeJob(job) });
  } catch (error) {
    if (error instanceof JobsTableMissingError) {
      return NextResponse.json({ error: error.message, code: "jobs_table_missing" }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to read job." }, { status: 500 });
  }
}
