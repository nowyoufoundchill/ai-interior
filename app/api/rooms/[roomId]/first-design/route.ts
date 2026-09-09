import { NextResponse } from "next/server";
import { renderModeSchema } from "@/lib/ai/render-contract";
import { createOrGetActiveJob, JobsTableMissingError, toOwnerSafeJob } from "@/lib/ai/jobs/service";
import { scheduleJob } from "@/lib/ai/jobs/runtime";
import { currentCorrelationId } from "@/lib/observability";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const body = await request.json().catch(() => ({}));
  const sourcePhotoId = typeof body.source_photo_id === "string" ? body.source_photo_id : null;
  const mode = renderModeSchema.safeParse(body.render_mode ?? "designer");
  if (!mode.success) return NextResponse.json({ error: "Choose Designer Render or Concept." }, { status: 400 });
  if (!sourcePhotoId) return NextResponse.json({ error: "A room photo is required." }, { status: 400 });

  const supabase = createServerSupabaseClient();
  const { data: room } = await supabase.from("rooms").select("id, test_run_id").eq("id", roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  try {
    const { job, created } = await createOrGetActiveJob({
      roomId,
      // Migration 008 constrains job_type to the established durable kinds.
      // Keep the new operation inside the proven render job lane rather than
      // requiring a production constraint migration before owners can use it.
      jobType: "render",
      requestPayload: { source_photo_id: sourcePhotoId, operation: "first_design", render_mode: mode.data },
      requestedBy: "owner",
      correlationId: await currentCorrelationId(),
      testRunId: room.test_run_id
    });
    if (created) scheduleJob(job.id);
    return NextResponse.json({ job: toOwnerSafeJob(job), created }, { status: created ? 202 : 200 });
  } catch (error) {
    if (error instanceof JobsTableMissingError) return NextResponse.json({ error: error.message, code: "jobs_table_missing" }, { status: 503 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "We couldn't start your room design." }, { status: 500 });
  }
}
