import { NextResponse } from "next/server";
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
    .select("id")
    .eq("id", moodBoardId)
    .eq("room_id", roomId)
    .single();

  if (targetError || !targetMoodBoard) {
    return NextResponse.json({ error: targetError?.message ?? "Mood board was not found for this room." }, { status: 404 });
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
