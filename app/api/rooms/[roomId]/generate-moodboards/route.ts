import { NextResponse } from "next/server";
import { moodBoardGenerator } from "@/lib/ai/services";
import { overallScore } from "@/lib/ai/critic";
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
    .eq("status", "current")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: designPreferences } = home
    ? await supabase.from("design_preferences").select("preference_type, label").eq("home_id", home.id)
    : { data: [] };

  const { data: latestVersionRows } = await supabase
    .from("mood_boards")
    .select("version")
    .eq("room_id", roomId)
    .order("version", { ascending: false })
    .limit(1);

  let nextVersion = (latestVersionRows?.[0]?.version ?? 0) + 1;
  // Tracks the board rows saved for the batch currently in flight, keyed by
  // concept_name, so a later critique or a governance regeneration can find
  // and update/retire the right rows without holding the whole batch in
  // memory until the request finishes.
  let currentBatchBoardIds = new Map<string, string>();

  try {
    await moodBoardGenerator({
      room,
      home,
      analysis: latestDiagnosis?.analysis,
      designPreferences: designPreferences ?? [],
      onConceptGenerated: async (concept) => {
        const { data: saved, error } = await supabase
          .from("mood_boards")
          .insert({
            room_id: roomId,
            concept_name: concept.concept_name,
            concept_data: concept,
            version: nextVersion++,
            origin: "generated",
            status: "draft",
            selected: false,
            quality_score: concept.quality_score,
            test_run_id: room.test_run_id
          })
          .select("id, concept_name")
          .single();

        if (error) throw new Error(`Failed to save concept "${concept.concept_name}": ${error.message}`);
        currentBatchBoardIds.set(saved.concept_name, saved.id);
      },
      onRegenerating: async () => {
        // Governance rejected this batch; retire it (not delete — keeps the
        // append-only history other flows rely on) and start tracking the
        // replacement batch fresh.
        const staleIds = [...currentBatchBoardIds.values()];
        if (staleIds.length) {
          await supabase.from("mood_boards").update({ status: "stale" }).in("id", staleIds);
        }
        currentBatchBoardIds = new Map();
      },
      onCritiqued: async (concepts, critique) => {
        // Replace the model's self-reported quality_score with the critic's
        // calibrated score on the rows already saved for this batch.
        for (const concept of concepts) {
          const boardId = currentBatchBoardIds.get(concept.concept_name);
          const match = critique.per_concept.find((entry) => entry.concept_name === concept.concept_name);
          if (!boardId || !match) continue;
          await supabase.from("mood_boards").update({ quality_score: overallScore(match.scores) }).eq("id", boardId);
        }
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mood board generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("mood_boards")
    .select("*")
    .in("id", [...currentBatchBoardIds.values()]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("rooms").update({ status: "concepts", current_stage: "concepts", selected_mood_board_id: null }).eq("id", roomId);

  return NextResponse.json({ mood_boards: data });
}
