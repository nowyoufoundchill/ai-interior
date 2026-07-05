import { NextResponse } from "next/server";
import { logAiRun } from "@/lib/ai/logging";
import { roomVisionAnalyst } from "@/lib/ai/services";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(_: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const supabase = createServerSupabaseClient();
  const { data: room, error: roomError } = await supabase.from("rooms").select("*").eq("id", roomId).single();

  if (roomError) return NextResponse.json({ error: roomError.message }, { status: 404 });

  const { data: home } = await supabase.from("homes").select("*").eq("id", room.home_id).maybeSingle();

  const { data: photos, error: photoError } = await supabase
    .from("photos")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });

  if (photoError) return NextResponse.json({ error: photoError.message }, { status: 500 });

  let analysis;
  try {
    analysis = await roomVisionAnalyst({
      room,
      home,
      photoCount: photos?.length ?? 0,
      photos: photos ?? []
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Room analysis failed.";
    await logAiRun({
      roomId,
      serviceName: "Room Vision Analyst",
      promptVersion: "room_analysis_v1",
      inputPayload: { room, photos: photos ?? [] },
      outputPayload: {},
      status: "failed",
      validationErrors: [message]
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("room_analyses")
    .insert({ room_id: roomId, analysis, quality_score: 82 })
    .select("*")
    .single();

  if (error) {
    await logAiRun({
      roomId,
      serviceName: "Room Vision Analyst",
      promptVersion: "room_analysis_v1",
      inputPayload: { room, photos: photos ?? [] },
      outputPayload: analysis,
      status: "failed",
      validationErrors: [error.message]
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("rooms").update({ status: "analyzed" }).eq("id", roomId);
  await logAiRun({
    roomId,
    serviceName: "Room Vision Analyst",
    promptVersion: "room_analysis_v1",
    inputPayload: { room, photos: photos ?? [] },
    outputPayload: analysis,
    qualityScore: 82
  });

  return NextResponse.json({ analysis: data });
}
