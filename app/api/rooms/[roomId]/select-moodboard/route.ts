import { NextResponse } from "next/server";
import { assessConceptCoherence, coherenceBlockMessage } from "@/lib/ai/concept-coherence";
import { moodBoardSchema } from "@/lib/schemas";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const body = await request.json();
  const moodBoardId = typeof body.mood_board_id === "string" ? body.mood_board_id : null;

  if (!moodBoardId) {
    return NextResponse.json({ error: "Mood board id is required." }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const { data: targetMoodBoard, error: targetError } = await supabase
    .from("mood_boards")
    .select("id, concept_data")
    .eq("id", moodBoardId)
    .eq("room_id", roomId)
    .single();

  if (targetError || !targetMoodBoard) {
    return NextResponse.json({ error: targetError?.message ?? "Mood board was not found for this room." }, { status: 404 });
  }

  // Phase 6 coherence gate: the approved direction is the sole downstream
  // contract, so an internally incoherent concept (garbled finish token,
  // materials/thesis contradiction, degenerate fields) can never reach
  // "Approved." This is the systemic guard against the oceanwash-class bug.
  const parsedConcept = moodBoardSchema.safeParse(targetMoodBoard.concept_data);
  if (!parsedConcept.success) {
    return NextResponse.json(
      { error: "This concept's data is malformed and can't be approved. Re-harmonize it, then approve." },
      { status: 400 }
    );
  }
  const coherence = assessConceptCoherence(parsedConcept.data);
  if (!coherence.coherent) {
    return NextResponse.json({ error: coherenceBlockMessage(coherence), coherence_violations: coherence.violations }, { status: 400 });
  }

  const { error: clearError } = await supabase
    .from("mood_boards")
    .update({ selected: false, status: "stale" })
    .eq("room_id", roomId)
    .eq("selected", true);
  if (clearError) return NextResponse.json({ error: clearError.message }, { status: 500 });

  const { data, error } = await supabase
    .from("mood_boards")
    .update({ selected: true, status: "locked" })
    .eq("id", moodBoardId)
    .eq("room_id", roomId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("products").update({ status: "stale" }).eq("room_id", roomId).neq("status", "rejected");
  await supabase.from("renders").update({ status: "stale" }).eq("room_id", roomId).neq("status", "rejected");
  await supabase
    .from("rooms")
    .update({ selected_mood_board_id: moodBoardId, status: "selected", current_stage: "concept_locked" })
    .eq("id", roomId);
  return NextResponse.json({ mood_board: data });
}
