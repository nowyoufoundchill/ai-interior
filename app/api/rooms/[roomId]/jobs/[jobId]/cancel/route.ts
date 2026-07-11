import { NextResponse } from "next/server";
import { cancelJob, getJob, toOwnerSafeJob, JobsTableMissingError } from "@/lib/ai/jobs/service";

/**
 * P0.1 cancel endpoint. Moves a non-terminal job to `cancelled`. A cancelled
 * job frees its idempotency slot so the owner can start the action fresh.
 */
export async function POST(_: Request, { params }: { params: Promise<{ roomId: string; jobId: string }> }) {
  const { roomId, jobId } = await params;

  try {
    const cancelled = await cancelJob(jobId, roomId);
    if (!cancelled) {
      const existing = await getJob(jobId, roomId);
      if (!existing) return NextResponse.json({ error: "Job not found." }, { status: 404 });
      return NextResponse.json(
        { error: "This job has already finished and can't be cancelled.", job: toOwnerSafeJob(existing) },
        { status: 409 }
      );
    }
    return NextResponse.json({ job: toOwnerSafeJob(cancelled) });
  } catch (error) {
    if (error instanceof JobsTableMissingError) {
      return NextResponse.json({ error: error.message, code: "jobs_table_missing" }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to cancel job." }, { status: 500 });
  }
}
