import { NextResponse } from "next/server";
import { scheduleJob } from "@/lib/ai/jobs/runtime";
import { ACTIVE_STATUSES, createOrGetActiveJob, JobsTableMissingError, toOwnerSafeJob } from "@/lib/ai/jobs/service";
import { currentCorrelationId } from "@/lib/observability";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const body = await request.json().catch(() => ({}));
  const requestId = typeof body.request_id === "string" ? body.request_id : "";
  if (!requestId || requestId.length > 100) return NextResponse.json({ error: "A room-plan request id is required." }, { status: 400 });
  const supabase = createServerSupabaseClient();
  const [{ data: room }, { data: accepted }] = await Promise.all([
    supabase.from("rooms").select("id, test_run_id").eq("id", roomId).maybeSingle(),
    supabase.from("renders").select("id").eq("room_id", roomId).eq("status", "accepted").order("created_at", { ascending: false }).limit(1).maybeSingle()
  ]);
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  if (!accepted) return NextResponse.json({ error: "Keep a room design before creating its plan." }, { status: 409 });

  const { data: currentPackage } = await supabase.from("implementation_packages").select("*").eq("room_id", roomId).eq("status", "current").maybeSingle();
  if (currentPackage?.accepted_render_id === accepted.id) {
    return NextResponse.json({ implementation_package: currentPackage, created: false }, { status: 200 });
  }
  const { data: replay } = await supabase
    .from("generation_jobs").select("*").eq("room_id", roomId).eq("job_type", "products")
    .contains("request_payload", { package_request_id: requestId }).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (replay) return NextResponse.json({ job: toOwnerSafeJob(replay), created: false }, { status: 200 });
  const { data: activeRows } = await supabase.from("generation_jobs").select("id, request_payload").eq("room_id", roomId).eq("job_type", "products").in("status", ACTIVE_STATUSES);
  if ((activeRows ?? []).some((row) => (row.request_payload as Record<string, unknown>)?.operation === "implementation_package")) {
    return NextResponse.json({ error: "A room plan is already in progress." }, { status: 409 });
  }
  try {
    const { job, created } = await createOrGetActiveJob({
      roomId,
      jobType: "products",
      requestPayload: { operation: "implementation_package", package_request_id: requestId, accepted_render_id: accepted.id },
      requestedBy: "owner",
      correlationId: await currentCorrelationId(),
      testRunId: room.test_run_id
    });
    if (created) scheduleJob(job.id);
    return NextResponse.json({ job: toOwnerSafeJob(job), created }, { status: created ? 202 : 200 });
  } catch (error) {
    if (error instanceof JobsTableMissingError) return NextResponse.json({ error: error.message, code: "jobs_table_missing" }, { status: 503 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "We couldn't start the room plan." }, { status: 500 });
  }
}
