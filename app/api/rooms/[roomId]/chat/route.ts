import { NextResponse } from "next/server";
import { logAiRun } from "@/lib/ai/logging";
import { revisionAgent } from "@/lib/ai/services";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const body = await request.json();
  const message = typeof body.message === "string" ? body.message : "";

  if (!message.trim()) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const { data: room } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
  const { data: home } = room ? await supabase.from("homes").select("*").eq("id", room.home_id).maybeSingle() : { data: null };
  const { data: latestAnalysis } = await supabase
    .from("room_analyses")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: selectedMoodBoard } = await supabase
    .from("mood_boards")
    .select("*")
    .eq("room_id", roomId)
    .eq("selected", true)
    .maybeSingle();
  const { data: products } = await supabase.from("products").select("*").eq("room_id", roomId).order("created_at", { ascending: true });
  const { data: renders } = await supabase.from("renders").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(5);
  const { data: memories } = await supabase.from("design_memories").select("*").eq("scope_id", roomId).order("created_at", { ascending: false });

  let revision;
  try {
    revision = await revisionAgent({
      message,
      room: room ?? undefined,
      home,
      analysis: latestAnalysis?.analysis,
      selectedMoodBoard,
      products,
      renders,
      memories
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Revision chat failed.";
    await logAiRun({
      roomId,
      serviceName: "Revision Agent",
      promptVersion: "revision_agent_v1",
      inputPayload: { message, room, latest_analysis: latestAnalysis, selected_mood_board: selectedMoodBoard },
      outputPayload: {},
      status: "failed",
      validationErrors: [errorMessage]
    });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }

  const stateBefore = revision.state_before as Json;
  const stateAfter = revision.state_after as Json;
  const revisionPayload = { ...revision, state_before: stateBefore, state_after: stateAfter } as Json;
  const { data, error } = await supabase
    .from("revisions")
    .insert({
      room_id: roomId,
      user_message: revision.user_message,
      assistant_response: revision.assistant_response,
      revision_type: revision.revision_type,
      state_before: stateBefore,
      state_after: stateAfter
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (revision.revision_type === "memory_update") {
    await supabase.from("design_memories").insert({
      scope: "room",
      scope_id: roomId,
      memory_type: "chat_preference",
      content: {
        user_message: revision.user_message,
        assistant_response: revision.assistant_response,
        state_after: revision.state_after
      } as Json
    });
  }

  await logAiRun({
    roomId,
    serviceName: "Revision Agent",
    promptVersion: "revision_agent_v1",
    inputPayload: { message, room, latest_analysis: latestAnalysis, selected_mood_board: selectedMoodBoard },
    outputPayload: revisionPayload,
    qualityScore: 75
  });

  return NextResponse.json({ revision: data });
}


