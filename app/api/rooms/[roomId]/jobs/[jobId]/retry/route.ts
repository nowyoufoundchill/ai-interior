import { NextResponse } from "next/server";
import { getJob, requeueJob, toOwnerSafeJob, JobsTableMissingError } from "@/lib/ai/jobs/service";
import { scheduleJob } from "@/lib/ai/jobs/runtime";

/**
 * P0.1 retry endpoint. Requeues a retryable_failed job for another bounded
 * attempt and reschedules execution. Returns 409 if the job has no attempts
 * left (already terminal) so the UI shows a clear terminal state instead of an
 * infinite retry loop.
 */
export async function POST(_: Request, { params }: { params: Promise<{ roomId: string; jobId: string }> }) {
  const { roomId, jobId } = await params;

  try {
    const existing = await getJob(jobId, roomId);
    if (!existing) return NextResponse.json({ error: "Job not found." }, { status: 404 });

    const requeued = await requeueJob(jobId);
    if (!requeued) {
      const settled = await getJob(jobId, roomId);
      return NextResponse.json(
        { error: "This step can't be retried — no attempts remain.", job: settled ? toOwnerSafeJob(settled) : null },
        { status: 409 }
      );
    }

    scheduleJob(requeued.id);
    return NextResponse.json({ job: toOwnerSafeJob(requeued) }, { status: 202 });
  } catch (error) {
    if (error instanceof JobsTableMissingError) {
      return NextResponse.json({ error: error.message, code: "jobs_table_missing" }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to retry job." }, { status: 500 });
  }
}
