import { NextResponse } from "next/server";
import { generateImageEdit, resolveAiMode } from "@/lib/ai/gateway";
import { isOpenAiConfigured } from "@/lib/ai/openai";
import { renderPromptDirector } from "@/lib/ai/services";
import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const body = await request.json().catch(() => ({}));
  const supabase = createServerSupabaseClient();
  const { data: room, error: roomError } = await supabase.from("rooms").select("*").eq("id", roomId).single();

  if (roomError) return NextResponse.json({ error: roomError.message }, { status: 404 });

  const { data: selectedMoodBoard } = await supabase
    .from("mood_boards")
    .select("*")
    .eq("room_id", roomId)
    .eq("status", "locked")
    .maybeSingle();

  if (!selectedMoodBoard) {
    return NextResponse.json({ error: "Lock a concept before editing a room photo." }, { status: 400 });
  }

  if (typeof body.source_photo_id !== "string") {
    return NextResponse.json({ error: "Select a source photo before editing it." }, { status: 400 });
  }

  const { data: sourcePhoto } = await supabase.from("photos").select("*").eq("id", body.source_photo_id).eq("room_id", roomId).maybeSingle();

  if (!sourcePhoto) {
    return NextResponse.json({ error: "The selected source photo was not found for this room." }, { status: 400 });
  }

  const { data: latestDiagnosis } = await supabase
    .from("room_analyses")
    .select("*")
    .eq("room_id", roomId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  let plan;
  try {
    plan = await renderPromptDirector({
      roomId,
      sourcePhotoId: body.source_photo_id,
      moodBoardId: selectedMoodBoard.id,
      room,
      analysis: latestDiagnosis?.analysis,
      selectedMoodBoard,
      sourcePhoto,
      userInstructions: typeof body.instructions === "string" ? body.instructions : undefined
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Photo edit planning failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  let fileUrl: string | null = null;
  // A null image is expected whenever AI_MODE=mock (the gateway short-circuits
  // to a mocked plan with no image) — that must fall through to the "edit plan
  // saved" placeholder, not be treated as a live OpenAI failure. Only a live
  // call that returns no image is a real, user-facing error.
  const isLiveImageEdit = isOpenAiConfigured() && resolveAiMode() !== "mock";

  try {
    const imageBase64 = await generateImageEdit({
      roomId,
      serviceName: "Render Image Generator",
      promptVersion: "render_image_v1",
      prompt: plan.render_prompt,
      sourceImageUrl: sourcePhoto.file_url
    });

    if (isLiveImageEdit && !imageBase64) {
      throw new Error("OpenAI image generation returned no image output.");
    }

    if (imageBase64) {
      const serviceSupabase = createServiceSupabaseClient();
      const storagePath = `${roomId}/renders/${crypto.randomUUID()}.png`;
      const imageBytes = Uint8Array.from(atob(imageBase64), (char) => char.charCodeAt(0));
      const { error: uploadError } = await serviceSupabase.storage.from("room-photos").upload(storagePath, imageBytes, {
        contentType: "image/png",
        cacheControl: "3600",
        upsert: false
      });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = serviceSupabase.storage.from("room-photos").getPublicUrl(storagePath);
      fileUrl = publicUrlData.publicUrl;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Render image generation failed.";
    if (isLiveImageEdit) {
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  await supabase
    .from("renders")
    .update({ status: "stale" })
    .eq("room_id", roomId)
    .eq("source_photo_id", body.source_photo_id)
    .eq("status", "current");

  const { data, error } = await supabase
    .from("renders")
    .insert({
      room_id: roomId,
      mood_board_id: selectedMoodBoard.id,
      mood_board_version: selectedMoodBoard.version ?? null,
      source_photo_id: body.source_photo_id,
      file_url: fileUrl,
      prompt: plan.render_prompt,
      render_prompt: plan.render_prompt,
      preservation_constraints: plan.preservation_constraints,
      transformation_instructions: plan.transformation_instructions,
      negative_instructions: plan.negative_instructions,
      user_regeneration_instructions: typeof body.instructions === "string" ? body.instructions : null,
      generated_image_path: fileUrl,
      status: "current",
      critique: plan.critique,
      quality_score: plan.quality_score,
      test_run_id: room.test_run_id
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("rooms").update({ status: "renders", current_stage: "executing" }).eq("id", roomId);

  return NextResponse.json({ render: data });
}
