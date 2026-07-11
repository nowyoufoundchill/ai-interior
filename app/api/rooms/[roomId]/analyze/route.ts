import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { currentCorrelationId } from "@/lib/observability";
import { createOrGetActiveJob, getJob, JobsTableMissingError } from "@/lib/ai/jobs/service";
import { runJobInline } from "@/lib/ai/jobs/runtime";

/**
 * Diagnosis route — now a durable-job compatibility layer (P0.1).
 *
 * The diagnosis is executed through the shared generation-job service and
 * runner (create-or-return-active idempotency, staged transitions, atomic
 * artifact/completion coordination), so the synchronous path exercises the same
 * durable contract as the async `/jobs` path. For existing consumers (frontend
 * combined concept flow, integrity/e2e suites) this route still runs the job
 * inline and returns the diagnosis in the response, unchanged in shape. The
 * async, disconnect-surviving path is `POST /api/rooms/[roomId]/jobs`.
 */
export async function POST(_: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const supabase = createServerSupabaseClient();

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, test_run_id")
    .eq("id", roomId)
    .maybeSingle();
  if (roomError || !room) {
    return NextResponse.json({ error: roomError?.message ?? "Room not found." }, { status: 404 });
  }

  const correlationId = await currentCorrelationId();

  try {
    const { job } = await createOrGetActiveJob({
      roomId,
      jobType: "diagnosis",
      requestedBy: "owner",
      correlationId,
      testRunId: room.test_run_id
    });

    // Synchronous compatibility: drive the job to completion within this
    // request so callers still receive the artifact in the response body.
    await runJobInline(job.id);
    const settled = await getJob(job.id, roomId);

    if (!settled || settled.status !== "completed") {
      const message = settled?.error_message ?? "Room diagnosis failed.";
      const status = settled?.status === "terminal_failed" ? 500 : 502;
      return NextResponse.json({ error: message, job_id: settled?.id ?? job.id }, { status });
    }

    const analysisId = (settled.result_refs as { analysis_id?: string })?.analysis_id;
    const { data: analysis, error: analysisError } = await supabase
      .from("room_analyses")
      .select("*")
      .eq("id", analysisId ?? "")
      .single();
    if (analysisError || !analysis) {
      return NextResponse.json({ error: "Diagnosis saved but could not be read back." }, { status: 500 });
    }

    return NextResponse.json({ diagnosis: analysis, analysis, job_id: settled.id });
  } catch (error) {
    if (error instanceof JobsTableMissingError) {
      // Table not yet migrated: fall back so diagnosis still works in prod
      // until 008 is applied. Behaviour matches the pre-P0.1 route.
      return legacyAnalyze(roomId, supabase);
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Room diagnosis failed." }, { status: 500 });
  }
}

/**
 * Pre-P0.1 synchronous diagnosis, kept as a fallback only for the window
 * before migration 008 is applied. Identical persistence + invalidation to the
 * durable runner.
 */
async function legacyAnalyze(roomId: string, supabase: ReturnType<typeof createServerSupabaseClient>) {
  const { roomVisionAnalyst } = await import("@/lib/ai/services");

  const { data: room, error: roomError } = await supabase.from("rooms").select("*").eq("id", roomId).single();
  if (roomError) return NextResponse.json({ error: roomError.message }, { status: 404 });

  const { data: home } = await supabase.from("homes").select("*").eq("id", room.home_id).maybeSingle();
  const { data: photos, error: photoError } = await supabase
    .from("photos")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });
  if (photoError) return NextResponse.json({ error: photoError.message }, { status: 500 });

  const { data: existingAnalyses } = await supabase
    .from("room_analyses")
    .select("version")
    .eq("room_id", roomId)
    .order("version", { ascending: false })
    .limit(1);

  let diagnosis;
  try {
    diagnosis = await roomVisionAnalyst({ room, home, photoCount: photos?.length ?? 0, photos: photos ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Room diagnosis failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  await supabase.from("room_analyses").update({ status: "stale" }).eq("room_id", roomId).eq("status", "current");

  const { data, error } = await supabase
    .from("room_analyses")
    .insert({
      room_id: roomId,
      analysis: diagnosis,
      version: (existingAnalyses?.[0]?.version ?? 0) + 1,
      status: "current",
      source_photo_ids: (photos ?? []).map((photo) => photo.id),
      brief_snapshot: { design_brief: room.design_brief, dimensions: room.dimensions },
      quality_score: 82,
      test_run_id: room.test_run_id
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase
    .from("mood_boards")
    .update({ status: "stale", selected: false })
    .eq("room_id", roomId)
    .in("status", ["draft", "locked", "unlocked"]);
  await supabase
    .from("rooms")
    .update({ status: "analyzed", current_stage: "diagnosed", selected_mood_board_id: null })
    .eq("id", roomId);

  return NextResponse.json({ diagnosis: data, analysis: data });
}
