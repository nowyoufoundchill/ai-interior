import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { currentCorrelationId } from "@/lib/observability";
import { createOrGetActiveJob, getJob, JobsTableMissingError } from "@/lib/ai/jobs/service";
import { runJobInline } from "@/lib/ai/jobs/runtime";

/**
 * Single-photo render route — durable-job compatibility layer (P0.2).
 *
 * The render now runs through the shared generation-job service and the staged,
 * checkpoint-resumable render runner (validate → plan+critic → generate →
 * upload → persist → atomic current/stale), so status survives disconnect and a
 * persistence failure never triggers a second paid image call. For existing
 * consumers (frontend, integrity/failure suites) this route still runs the job
 * inline and returns `{ render }` synchronously. The async, disconnect-surviving
 * entry point is `POST /api/rooms/[roomId]/jobs` with `job_type: "render"`.
 */

// Runner error_code → HTTP status for the synchronous compatibility response.
const STATUS_BY_CODE: Record<string, number> = {
  render_no_locked_concept: 400,
  render_no_source_photo: 400,
  render_source_photo_not_found: 400,
  render_design_violation: 422,
  image_no_image: 502,
  storage_upload_failure: 502,
  db_persist_failure: 500
};

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const supabase = createServerSupabaseClient();

  const { data: room, error: roomError } = await supabase.from("rooms").select("id, test_run_id").eq("id", roomId).maybeSingle();
  if (roomError || !room) {
    return NextResponse.json({ error: roomError?.message ?? "Room not found." }, { status: 404 });
  }

  const correlationId = await currentCorrelationId();

  try {
    const { job } = await createOrGetActiveJob({
      roomId,
      jobType: "render",
      requestPayload: {
        source_photo_id: typeof body.source_photo_id === "string" ? body.source_photo_id : undefined,
        instructions: typeof body.instructions === "string" ? body.instructions : undefined
      },
      requestedBy: "owner",
      correlationId,
      testRunId: room.test_run_id
    });

    await runJobInline(job.id);
    const settled = await getJob(job.id, roomId);

    if (!settled || settled.status !== "completed") {
      const code = settled?.error_code ?? "render_failed";
      const status = STATUS_BY_CODE[code] ?? (settled?.status === "terminal_failed" ? 500 : 502);
      return NextResponse.json({ error: settled?.error_message ?? "Render failed.", error_code: code, job_id: settled?.id ?? job.id }, { status });
    }

    const renderId = (settled.result_refs as { render_id?: string })?.render_id;
    const { data: render, error: renderError } = await supabase.from("renders").select("*").eq("id", renderId ?? "").single();
    if (renderError || !render) {
      return NextResponse.json({ error: "Render saved but could not be read back." }, { status: 500 });
    }

    return NextResponse.json({ render, job_id: settled.id });
  } catch (error) {
    if (error instanceof JobsTableMissingError) {
      return NextResponse.json(
        { error: "Durable rendering is not available yet (apply migration 008)." , code: "jobs_table_missing" },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Render failed." }, { status: 500 });
  }
}
