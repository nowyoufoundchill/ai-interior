import { NextResponse } from "next/server";
import { revisionAgent } from "@/lib/ai/services";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buildProposalDraft, PROPOSAL_VERSION } from "@/lib/ai/proposals";
import { insertProposal } from "@/lib/data/proposals";
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
  const { data: latestDiagnosis } = await supabase
    .from("room_analyses")
    .select("*")
    .eq("room_id", roomId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: selectedMoodBoard } = await supabase
    .from("mood_boards")
    .select("*")
    .eq("room_id", roomId)
    .eq("status", "locked")
    .maybeSingle();
  const { data: products } = await supabase.from("products").select("*").eq("room_id", roomId).order("created_at", { ascending: true });
  const { data: renders } = await supabase.from("renders").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(5);
  const currentRender = renders?.find((render) => render.status !== "stale") ?? renders?.[0] ?? null;
  const { data: chatThread } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .limit(20);
  const lastRequestedChange = [...(chatThread ?? [])].reverse().find((entry) => entry.role === "user")?.content ?? null;
  const { data: memories } = await supabase.from("design_memories").select("*").eq("scope_id", roomId).order("created_at", { ascending: false });

  let revision;
  try {
    revision = await revisionAgent({
      message,
      room: room ?? undefined,
      home,
      analysis: latestDiagnosis?.analysis,
      selectedMoodBoard,
      products,
      renders,
      currentRender,
      chatThread,
      lastRequestedChange,
      memories
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Revision chat failed.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }

  const assistantResponse = revision.assistant_response?.trim()
    ? revision.assistant_response
    : "I have the request, but I could not form a reliable design recommendation from the saved room context. Nothing has been changed; try asking for one specific render, product, or concept adjustment.";
  const stateBefore = revision.state_before as Json;
  const stateAfter = revision.state_after as Json;
  const { data, error } = await supabase
    .from("revisions")
    .insert({
      room_id: roomId,
      user_message: revision.user_message,
      assistant_response: assistantResponse,
      revision_type: revision.revision_type,
      state_before: stateBefore,
      state_after: stateAfter,
      test_run_id: room?.test_run_id ?? null
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const referencedArtifactIds = [
    selectedMoodBoard?.id,
    currentRender?.id
  ].filter((id): id is string => Boolean(id));

  const { data: messages, error: messageError } = await supabase.from("chat_messages").insert([
    {
      room_id: roomId,
      role: "user",
      content: revision.user_message,
      classified_intent: revision.revision_type,
      referenced_artifact_ids: referencedArtifactIds,
      test_run_id: room?.test_run_id ?? null
    },
    {
      room_id: roomId,
      role: "assistant",
      content: assistantResponse,
      classified_intent: revision.revision_type,
      referenced_artifact_ids: referencedArtifactIds,
      test_run_id: room?.test_run_id ?? null
    }
  ]).select("*");

  if (messageError) return NextResponse.json({ error: messageError.message }, { status: 500 });

  // Chat NEVER mutates a design artifact here (§P0.4: "No chat message mutates an
  // artifact before explicit confirmation"). Instead, when the turn asks for a
  // change, we persist a structured ActionProposal linked to the assistant
  // message. It is inert until the owner confirms it, at which point exactly one
  // durable `chat_action` job runs the change. A pure question persists no
  // proposal (a question stays a question); a vague change becomes a
  // clarification card with no Apply control. Preferences still route through
  // this proposal → confirmation path rather than being written silently.
  const assistantMessage = (messages ?? []).find((entry) => entry.role === "assistant") ?? null;
  const draft = buildProposalDraft(revision.user_message, revision.revision_type, {
    currentRenderPhotoId: currentRender?.source_photo_id ?? null,
    hasLockedConcept: Boolean(selectedMoodBoard),
    hasRenders: Boolean(renders?.length),
    hasProducts: Boolean(products?.length)
  });

  let proposal = null;
  if (draft.persist) {
    try {
      proposal = await insertProposal({
        roomId,
        chatMessageId: assistantMessage?.id ?? null,
        intentType: draft.intent_type,
        scope: draft.scope,
        scopePhotoIds: draft.scope_photo_ids,
        summary: draft.summary,
        normalizedInstructions: draft.normalized_instructions,
        expectedInvalidations: draft.expected_invalidations,
        confidence: draft.confidence,
        clarifyingQuestion: draft.clarifying_question,
        proposalVersion: PROPOSAL_VERSION,
        testRunId: room?.test_run_id ?? null
      });
    } catch {
      // A proposal-persistence hiccup must not fail the advisory reply; the owner
      // still gets the designer's answer, just without a card this turn.
      proposal = null;
    }
  }

  return NextResponse.json({ revision: data, messages, proposal });
}
