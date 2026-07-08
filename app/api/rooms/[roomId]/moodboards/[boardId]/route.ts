import { NextResponse } from "next/server";
import { refineConcept } from "@/lib/ai/services";
import { moodBoardSchema, type MoodBoardConcept } from "@/lib/schemas";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Fields an owner may edit directly on a concept. Palette and quality_score are
// intentionally excluded from free-form editing to keep the concept structure
// coherent; palette shifts should go through re-harmonize instead.
const EDITABLE_STRING_FIELDS = [
  "concept_name",
  "design_thesis",
  "furniture_direction",
  "layout_direction",
  "lighting_direction",
  "art_direction",
  "decor_direction",
  "plant_direction",
  "budget_strategy",
  "why_it_works",
  "why_user_may_reject_it"
] as const;

const EDITABLE_STRING_ARRAY_FIELDS = ["style_keywords", "materials", "risk_profile"] as const;

type Action = "unlock" | "edit" | "reharmonize";

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.filter((item): item is string => typeof item === "string");
  return items.length ? items : null;
}

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string; boardId: string }> }) {
  const { roomId, boardId } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body.action as Action | undefined;

  if (action !== "unlock" && action !== "edit" && action !== "reharmonize") {
    return NextResponse.json({ error: "Unknown concept action." }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const { data: board, error: boardError } = await supabase
    .from("mood_boards")
    .select("*")
    .eq("id", boardId)
    .eq("room_id", roomId)
    .single();

  if (boardError || !board) {
    return NextResponse.json({ error: boardError?.message ?? "Concept was not found for this room." }, { status: 404 });
  }

  const { data: roomMeta } = await supabase.from("rooms").select("test_run_id").eq("id", roomId).maybeSingle();

  if (action === "unlock") {
    if (board.status !== "locked") {
      return NextResponse.json({ error: "Only a locked concept can be unlocked." }, { status: 400 });
    }

    const { data: updated, error: updateError } = await supabase
      .from("mood_boards")
      .update({ status: "unlocked", selected: false })
      .eq("id", boardId)
      .eq("room_id", roomId)
      .select("*")
      .single();

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    // Unlocking removes the design contract, so downstream products/renders are
    // no longer valid immediately (not only after a future re-lock). Mark them
    // stale now and drop the room back to the concepts stage without a locked
    // concept.
    await supabase.from("products").update({ status: "stale" }).eq("room_id", roomId).neq("status", "rejected");
    await supabase.from("renders").update({ status: "stale" }).eq("room_id", roomId).neq("status", "rejected");
    await supabase
      .from("rooms")
      .update({ selected_mood_board_id: null, status: "concepts", current_stage: "concepts" })
      .eq("id", roomId);

    return NextResponse.json({ mood_board: updated, downstream_invalidated: true });
  }

  // §4 invalidation table: "Mood board edit while locked | Not possible.
  // Editing requires explicit unlock." Re-harmonize is not restricted here —
  // the table names only direct field edits.
  if (action === "edit" && board.status === "locked") {
    return NextResponse.json(
      { error: "This concept is locked. Unlock it first, then edit." },
      { status: 400 }
    );
  }

  // Both edit and reharmonize are append-only: they create a new concept
  // version and mark the source concept stale, never mutating history.
  const baseConcept = moodBoardSchema.parse(board.concept_data);
  let nextConcept: MoodBoardConcept;
  let origin: string;

  if (action === "edit") {
    const updates = (body.updates ?? {}) as Record<string, unknown>;
    const merged: MoodBoardConcept = { ...baseConcept };

    for (const field of EDITABLE_STRING_FIELDS) {
      const value = updates[field];
      if (typeof value === "string" && value.trim()) {
        merged[field] = value.trim();
      }
    }
    for (const field of EDITABLE_STRING_ARRAY_FIELDS) {
      const value = asStringArray(updates[field]);
      if (value) {
        merged[field] = value;
      }
    }

    nextConcept = moodBoardSchema.parse(merged);
    origin = "edited";
  } else {
    // reharmonize: regenerate one refined concept via the AI service.
    const { data: room, error: roomError } = await supabase.from("rooms").select("*").eq("id", roomId).single();
    if (roomError || !room) {
      return NextResponse.json({ error: roomError?.message ?? "Room was not found." }, { status: 404 });
    }
    const { data: home } = await supabase.from("homes").select("*").eq("id", room.home_id).maybeSingle();
    const { data: latestDiagnosis } = await supabase
      .from("room_analyses")
      .select("*")
      .eq("room_id", roomId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    try {
      nextConcept = await refineConcept({
        room,
        home,
        analysis: latestDiagnosis?.analysis,
        baseConcept,
        instructions: typeof body.instructions === "string" ? body.instructions : undefined
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Concept re-harmonize failed.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
    origin = "reharmonized";
  }

  const { data: latestVersionRows } = await supabase
    .from("mood_boards")
    .select("version")
    .eq("room_id", roomId)
    .order("version", { ascending: false })
    .limit(1);

  const { data: inserted, error: insertError } = await supabase
    .from("mood_boards")
    .insert({
      room_id: roomId,
      concept_name: nextConcept.concept_name,
      concept_data: nextConcept,
      version: (latestVersionRows?.[0]?.version ?? 0) + 1,
      parent_version: board.version ?? null,
      origin,
      status: "draft",
      selected: false,
      quality_score: nextConcept.quality_score,
      test_run_id: roomMeta?.test_run_id ?? null
    })
    .select("*")
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // Retire the source concept. If it was the locked contract, drop the room
  // lock so downstream generation can only resume after an explicit re-lock.
  await supabase.from("mood_boards").update({ status: "stale", selected: false }).eq("id", boardId).eq("room_id", roomId);

  if (board.status === "locked") {
    await supabase.from("products").update({ status: "stale" }).eq("room_id", roomId).neq("status", "rejected");
    await supabase.from("renders").update({ status: "stale" }).eq("room_id", roomId).neq("status", "rejected");
    await supabase
      .from("rooms")
      .update({ selected_mood_board_id: null, status: "concepts", current_stage: "concepts" })
      .eq("id", roomId);
  }

  return NextResponse.json({ mood_board: inserted });
}
