import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Read-only state snapshot for a room, used by the Integrity suite (PRD v3
 * §12.1 Suite 1) to assert the §4 invalidation table without scraping the
 * DOM: perform an upstream change through the UI/API, then GET this route
 * and assert the exact downstream effect (new version, correct stale flags,
 * nothing deleted, locked boards uneditable).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const supabase = createServerSupabaseClient();

  const [room, diagnoses, moodBoards, products, renders, chatMessages, jobs] = await Promise.all([
    supabase.from("rooms").select("*").eq("id", roomId).maybeSingle(),
    supabase
      .from("room_analyses")
      .select("id, version, status, created_at")
      .eq("room_id", roomId)
      .order("version", { ascending: true }),
    supabase
      .from("mood_boards")
      .select("id, version, parent_version, origin, status, concept_name, concept_data, created_at")
      .eq("room_id", roomId)
      .order("version", { ascending: true }),
    supabase
      .from("products")
      .select("id, status, mood_board_version, image_url, cached_image_path, created_at")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true }),
    supabase
      .from("renders")
      .select("id, status, mood_board_version, source_photo_id, preservation_constraints, negative_instructions, render_prompt, critique, quality_score, created_at")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true }),
    supabase
      .from("chat_messages")
      .select("id, role, classified_intent, created_at")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true }),
    // P0.1 durable jobs (tolerant of the table being absent pre-migration 008).
    supabase
      .from("generation_jobs")
      .select("id, job_type, status, stage, attempt_count, max_attempts, idempotency_key, progress_current, progress_total, result_refs, error_code, correlation_id, created_at")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
  ]);

  // P0.4 action proposals (tolerant of the table being absent pre-migration 009).
  const proposals = await supabase
    .from("action_proposals")
    .select(
      "id, chat_message_id, result_message_id, intent_type, status, scope, scope_photo_ids, normalized_instructions, expected_invalidations, confidence, job_id, proposal_version, created_at"
    )
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });

  if (room.error) {
    return NextResponse.json({ error: room.error.message }, { status: 500 });
  }
  if (!room.data) {
    return NextResponse.json({ error: `Room ${roomId} not found` }, { status: 404 });
  }

  const lockedBoard = (moodBoards.data ?? []).find((board) => board.status === "locked") ?? null;

  return NextResponse.json({
    room: {
      id: room.data.id,
      current_stage: room.data.current_stage,
      status: room.data.status,
      selected_mood_board_id: room.data.selected_mood_board_id
    },
    diagnoses: diagnoses.data ?? [],
    mood_boards: moodBoards.data ?? [],
    products: products.data ?? [],
    renders: renders.data ?? [],
    chat_messages: chatMessages.data ?? [],
    generation_jobs: jobs.error ? [] : (jobs.data ?? []),
    action_proposals: proposals.error ? [] : (proposals.data ?? []),
    derived: {
      current_diagnosis_version: (diagnoses.data ?? []).find((d) => d.status === "current")?.version ?? null,
      stale_diagnosis_count: (diagnoses.data ?? []).filter((d) => d.status === "stale").length,
      locked_mood_board_version: lockedBoard?.version ?? null,
      stale_mood_board_count: (moodBoards.data ?? []).filter((b) => b.status === "stale").length,
      stale_product_count: (products.data ?? []).filter((p) => p.status === "stale").length,
      stale_render_count: (renders.data ?? []).filter((r) => r.status === "stale").length,
      products_match_locked_version: lockedBoard
        ? (products.data ?? [])
            .filter((p) => p.status !== "stale" && p.status !== "rejected")
            .every((p) => p.mood_board_version === lockedBoard.version)
        : true,
      renders_match_locked_version: lockedBoard
        ? (renders.data ?? [])
            .filter((r) => r.status === "current")
            .every((r) => r.mood_board_version === lockedBoard.version)
        : true
    }
  });
}
