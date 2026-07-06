import { NextResponse } from "next/server";
import { logAiRun } from "@/lib/ai/logging";
import { moodBoardGenerator } from "@/lib/ai/services";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(_: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const supabase = createServerSupabaseClient();
  const { data: room, error: roomError } = await supabase.from("rooms").select("*").eq("id", roomId).single();

  if (roomError) return NextResponse.json({ error: roomError.message }, { status: 404 });

  const { data: home } = await supabase.from("homes").select("*").eq("id", room.home_id).maybeSingle();

  const { data: latestAnalysis } = await supabase
    .from("room_analyses")
    .select("*")
    .eq("room_id", roomId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  let concepts;
  try {
    concepts = await moodBoardGenerator({
      room,
      home,
      analysis: latestAnalysis?.analysis
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mood board generation failed.";
    await logAiRun({
      roomId,
      serviceName: "Mood Board Generator",
      promptVersion: "moodboard_generator_v1",
      inputPayload: { room, analysis: latestAnalysis?.analysis ?? null },
      outputPayload: {},
      status: "failed",
      validationErrors: [message]
    });
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
        quality_score: concept.quality_score
      }))
    )
    .select("*");

  if (error) {
    await logAiRun({
      roomId,
      serviceName: "Mood Board Generator",
      promptVersion: "moodboard_generator_v1",
      inputPayload: { room, analysis: latestAnalysis?.analysis ?? null },
      outputPayload: { concepts },
      status: "failed",
      validationErrors: [error.message]
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("rooms").update({ status: "concepts", current_stage: "concepts", selected_mood_board_id: null }).eq("id", roomId);
  await logAiRun({
    roomId,
    serviceName: "Mood Board Generator",
    promptVersion: "moodboard_generator_v1",
    inputPayload: { room, analysis: latestAnalysis?.analysis ?? null },
    outputPayload: { concepts },
    qualityScore: Math.round(concepts.reduce((sum, item) => sum + item.quality_score, 0) / concepts.length)
  });

  return NextResponse.json({ mood_boards: data });
}
