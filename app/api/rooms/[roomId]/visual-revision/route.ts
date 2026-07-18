import { NextResponse } from "next/server";
import { classifyDirectVisualRevision } from "@/lib/ai/proposals";
import { scheduleJob } from "@/lib/ai/jobs/runtime";
import { ACTIVE_STATUSES, createOrGetActiveJob, JobsTableMissingError, toOwnerSafeJob } from "@/lib/ai/jobs/service";
import { currentCorrelationId } from "@/lib/observability";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const body = await request.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const requestId = typeof body.request_id === "string" ? body.request_id : "";
  if (!requestId || requestId.length > 100) {
    return NextResponse.json({ error: "A revision request id is required." }, { status: 400 });
  }
  if (message.length > 600) {
    return NextResponse.json({ error: "Keep this revision request under 600 characters." }, { status: 400 });
  }

  const decision = classifyDirectVisualRevision(message);
  if (!decision.actionable) {
    return NextResponse.json({ error: decision.error, code: decision.code }, { status: 422 });
  }

  const supabase = createServerSupabaseClient();
  const { data: room } = await supabase.from("rooms").select("id, test_run_id").eq("id", roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const { data: replay } = await supabase
    .from("generation_jobs")
    .select("*")
    .eq("room_id", roomId)
    .eq("job_type", "render")
    .contains("request_payload", { revision_request_id: requestId })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (replay) return NextResponse.json({ job: toOwnerSafeJob(replay), created: false }, { status: 200 });

  const { data: activeRows } = await supabase
    .from("generation_jobs")
    .select("id, request_payload")
    .eq("room_id", roomId)
    .eq("job_type", "render")
    .in("status", ACTIVE_STATUSES);
  const activeDesignJob = (activeRows ?? []).find((row) => {
    const payload = row.request_payload as Record<string, unknown>;
    return payload.operation === "first_design" || payload.operation === "visual_revision";
  });
  if (activeDesignJob) {
    return NextResponse.json({ error: "A room design is already in progress. Your note has not been submitted." }, { status: 409 });
  }

  const { data: parent } = await supabase
    .from("renders")
    .select("id, source_photo_id, file_url, critique, status")
    .eq("room_id", roomId)
    .in("status", ["candidate", "accepted"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!parent?.source_photo_id || !parent.file_url) {
    return NextResponse.json({ error: "Keep or generate a room design before revising it." }, { status: 409 });
  }

  try {
    const { job, created } = await createOrGetActiveJob({
      roomId,
      jobType: "render",
      requestPayload: {
        operation: "visual_revision",
        revision_request_id: requestId,
        parent_render_id: parent.id,
        source_photo_id: parent.source_photo_id,
        instructions: decision.instructions
      },
      requestedBy: "owner",
      correlationId: await currentCorrelationId(),
      testRunId: room.test_run_id
    });
    if (created) scheduleJob(job.id);
    return NextResponse.json({ job: toOwnerSafeJob(job), created }, { status: created ? 202 : 200 });
  } catch (error) {
    if (error instanceof JobsTableMissingError) {
      return NextResponse.json({ error: error.message, code: "jobs_table_missing" }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "We couldn't start that revision." }, { status: 500 });
  }
}
