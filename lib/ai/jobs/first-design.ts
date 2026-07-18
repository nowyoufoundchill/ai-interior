import { firstDesignBriefCompiler } from "@/lib/ai/services";
import type { AutopilotBrief } from "@/lib/schemas";
import { generateImageEdit, resolveAiMode } from "@/lib/ai/gateway";
import { reviewFinishedImage } from "@/lib/ai/critic";
import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";
import { advanceStage, checkpointResult, completeJob, failJob } from "./service";
import type { GenerationJob } from "@/types/database";

export async function executeFirstDesign(job: GenerationJob): Promise<GenerationJob> {
  const supabase = createServerSupabaseClient();
  const payload = (job.request_payload as Record<string, unknown>) ?? {};
  const sourcePhotoId = typeof payload.source_photo_id === "string" ? payload.source_photo_id : null;
  const checkpoint = (job.result_refs as Record<string, unknown>) ?? {};

  await advanceStage(job.id, "validating", "checking your room photo");
  const { data: room, error: roomError } = await supabase.from("rooms").select("*").eq("id", job.room_id).single();
  if (roomError || !room) {
    return failJob(job.id, { errorCode: "room_not_found", ownerMessage: "We couldn't find this room.", detail: roomError?.message, retryable: false });
  }
  if (!sourcePhotoId) {
    return failJob(job.id, { errorCode: "missing_source_photo", ownerMessage: "Add a room photo before designing it.", detail: "source_photo_id missing", retryable: false });
  }
  const { data: sourcePhoto } = await supabase.from("photos").select("*").eq("id", sourcePhotoId).eq("room_id", room.id).maybeSingle();
  if (!sourcePhoto) {
    return failJob(job.id, { errorCode: "source_photo_not_found", ownerMessage: "We couldn't find the room photo for this design.", detail: sourcePhotoId, retryable: false });
  }
  const { data: home } = await supabase.from("homes").select("*").eq("id", room.home_id).maybeSingle();

  let brief = checkpoint.autopilot_brief as AutopilotBrief | undefined;
  let briefId = typeof checkpoint.brief_id === "string" ? checkpoint.brief_id : null;
  if (!brief) {
    await advanceStage(job.id, "planning", "composing your room direction");
    try {
      brief = await firstDesignBriefCompiler({ room, home, sourcePhoto });
    } catch (error) {
      return failJob(job.id, { errorCode: "brief_compile_failed", ownerMessage: "We couldn't finish the room direction. Your request is saved — try again.", detail: error instanceof Error ? error.message : String(error) });
    }
    if (brief.blocking_questions.length) {
      return failJob(job.id, {
        errorCode: "brief_needs_information",
        ownerMessage: brief.blocking_questions.join(" "),
        detail: "compiler returned blocking_questions",
        retryable: false
      });
    }
    const { data: latest } = await supabase.from("room_analyses").select("version").eq("room_id", room.id).order("version", { ascending: false }).limit(1).maybeSingle();
    const { data: storedBrief, error: briefError } = await supabase
      .from("room_analyses")
      .insert({
        room_id: room.id,
        analysis: brief,
        version: (latest?.version ?? 0) + 1,
        status: "compiled",
        source_photo_ids: [sourcePhoto.id],
        brief_snapshot: { outcome: room.design_brief, purpose: room.purpose, provenance: "first_design_compiler_v1" },
        quality_score: Math.round(brief.confidence * 100),
        test_run_id: room.test_run_id
      })
      .select("id")
      .single();
    if (briefError || !storedBrief) {
      return failJob(job.id, { errorCode: "brief_persist_failed", ownerMessage: "We couldn't save the room direction. Your request is saved — try again.", detail: briefError?.message });
    }
    briefId = storedBrief.id;
    await checkpointResult(job.id, { autopilot_brief: brief, brief_id: briefId });
  }

  let imageUrl = typeof checkpoint.image_url === "string" ? checkpoint.image_url : null;
  if (!imageUrl) {
    await advanceStage(job.id, "generating", "creating your room design");
    const prompt = renderPromptFromBrief(brief, room.design_brief);
    if (resolveAiMode() === "mock") {
      imageUrl = sourcePhoto.file_url;
    } else {
      try {
        const imageBase64 = await generateImageEdit({ roomId: room.id, serviceName: "First Design Image Generator", promptVersion: "first_design_v1", prompt, sourceImageUrl: sourcePhoto.file_url });
        if (!imageBase64) throw new Error("No image returned.");
        const bytes = Uint8Array.from(atob(imageBase64), (char) => char.charCodeAt(0));
        const storagePath = `${room.id}/renders/${crypto.randomUUID()}.png`;
        const serviceSupabase = createServiceSupabaseClient();
        const { error: uploadError } = await serviceSupabase.storage.from("room-photos").upload(storagePath, bytes, { contentType: "image/png", cacheControl: "3600", upsert: false });
        if (uploadError) throw uploadError;
        imageUrl = serviceSupabase.storage.from("room-photos").getPublicUrl(storagePath).data.publicUrl;
      } catch (error) {
        return failJob(job.id, { errorCode: "image_generation_failed", ownerMessage: "The image service didn't respond. Your room direction is saved — try again.", detail: error instanceof Error ? error.message : String(error) });
      }
    }
    await checkpointResult(job.id, { image_url: imageUrl, image_ready: true });
  }

  let finishedReview = checkpoint.finished_image_review as Awaited<ReturnType<typeof reviewFinishedImage>> | undefined;
  if (!finishedReview) {
    await advanceStage(job.id, "validating", "reviewing the finished room against your photo");
    try {
      finishedReview = await reviewFinishedImage({
        roomId: room.id,
        sourceImageUrl: sourcePhoto.file_url,
        finishedImageUrl: imageUrl,
        brief,
        typedFacts: {
          dimensions: room.dimensions,
          constraints: room.constraints,
          existing_items: room.existing_items
        }
      });
    } catch (error) {
      return failJob(job.id, {
        errorCode: "finished_review_unavailable",
        ownerMessage: "Your image is saved, but its final room check did not finish. Try again to continue the review.",
        detail: error instanceof Error ? error.message : String(error)
      });
    }
    await checkpointResult(job.id, { finished_image_review: finishedReview });
  }

  await advanceStage(job.id, "persisting", "saving your room design");
  let renderId = typeof checkpoint.render_id === "string" ? checkpoint.render_id : null;
  const reviewFailed = finishedReview.verdict === "failure" || finishedReview.critical_violations.length > 0;
  if (!renderId) {
    const { data: render, error: renderError } = await supabase
      .from("renders")
      .insert({
        room_id: room.id,
        source_photo_id: sourcePhoto.id,
        file_url: imageUrl,
        prompt: renderPromptFromBrief(brief, room.design_brief),
        render_prompt: renderPromptFromBrief(brief, room.design_brief),
        preservation_constraints: brief.preservation_constraints,
        transformation_instructions: [...brief.functions_and_zones, ...brief.palette_materials_lighting],
        negative_instructions: brief.negative_instructions,
        generated_image_path: imageUrl,
        status: reviewFailed ? "review_failed" : "candidate",
        critique: { brief_id: briefId, finished_image_review: finishedReview },
        quality_score: Math.round(
          (finishedReview.architecture_preservation_score +
            finishedReview.program_fulfillment_score +
            finishedReview.access_and_safety_score +
            finishedReview.realism_score) /
            4
        ),
        test_run_id: room.test_run_id
      })
      .select("id")
      .single();
    if (renderError || !render) return failJob(job.id, { errorCode: "render_persist_failed", ownerMessage: "The finished design couldn't be saved. Try again.", detail: renderError?.message });
    renderId = render.id;
    await checkpointResult(job.id, { render_id: renderId });
  }
  if (reviewFailed) {
    return failJob(job.id, {
      errorCode: "finished_image_critical_violation",
      ownerMessage: "This attempt changed an important part of your room, so it was saved but not presented as ready.",
      detail: finishedReview.critical_violations.join(" | "),
      retryable: false
    });
  }
  await supabase.from("renders").update({ status: "historical" }).eq("room_id", room.id).eq("source_photo_id", sourcePhoto.id).eq("status", "candidate").neq("id", renderId);
  await supabase.from("rooms").update({ status: "design_ready", current_stage: "design_ready" }).eq("id", room.id);
  return completeJob(job.id, { render_id: renderId, brief_id: briefId ?? "" });
}

function renderPromptFromBrief(brief: AutopilotBrief, outcome: string | null) {
  return [
    "Edit this real room photo in place. Preserve the walls, openings, windows, floor plane, ceiling, and camera angle exactly.",
    `Owner outcome: ${outcome ?? brief.room_summary}`,
    `Design direction: ${brief.design_direction}`,
    `Functions and zones: ${brief.functions_and_zones.join("; ")}`,
    `Materials, palette, and lighting: ${brief.palette_materials_lighting.join("; ")}`,
    `Preservation constraints: ${brief.preservation_constraints.join("; ")}`,
    `Do not: ${brief.negative_instructions.join("; ")}`
  ].join("\n");
}
