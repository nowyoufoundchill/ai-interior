import { NextResponse } from "next/server";
import { moodBoardGenerator } from "@/lib/ai/services";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(_: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const supabase = createServerSupabaseClient();
  const { data: room, error: roomError } = await supabase.from("rooms").select("*").eq("id", roomId).single();

  if (roomError) return NextResponse.json({ error: roomError.message }, { status: 404 });

  const { data: home } = await supabase.from("homes").select("*").eq("id", room.home_id).maybeSingle();

  const { data: latestDiagnosis } = await supabase
    .from("room_analyses")
    .select("*")
    .eq("room_id", roomId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: designPreferences } = home
    ? await supabase.from("design_preferences").select("preference_type, label").eq("home_id", home.id)
    : { data: [] };

  let concepts;
  try {
    concepts = await moodBoardGenerator({
      room,
      home,
      analysis: latestDiagnosis?.analysis,
      designPreferences: designPreferences ?? []
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mood board generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { data: latestVersionRows } = await supabase
    .from("mood_boards")
    .select("version")
    .eq("room_id", roomId)
    .order("version", { ascending: false })
    .limit(1);

  const { data, error } = await supabase
    .from("mood_boards")
    .insert(
      concepts.map((concept, index) => ({
        room_id: roomId,
        concept_name: concept.concept_name,
        concept_data: concept,
        version: (latestVersionRows?.[0]?.version ?? 0) + index + 1,
        origin: "generated",
        status: "draft",
        selected: false,
        quality_score: concept.quality_score,
        test_run_id: room.test_run_id
      }))
    )
    .select("*");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("rooms").update({ status: "concepts", current_stage: "concepts", selected_mood_board_id: null }).eq("id", roomId);

  return NextResponse.json({ mood_boards: data });
}
