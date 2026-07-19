import { reviewFinishedImage } from "@/lib/ai/critic";
import { generateImageEdit, resolveAiMode } from "@/lib/ai/gateway";
import { firstDesignBriefCompiler } from "@/lib/ai/services";
import { buildWholeHomeMemory } from "@/lib/ai/context-brain/whole-home-memory";
import type { AutopilotBrief, FinishedImageReview } from "@/lib/schemas";
import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";
import type { GenerationJob, Json, Photo, Room } from "@/types/database";
import { advanceStage, checkpointResult, completeJob, failJob } from "./service";

type RoomRow = Room & {
  dimensions: Json;
  constraints: Json;
  existing_items: Json;
  design_brief: string | null;
  test_run_id: string | null;
};

export async function executeFirstDesign(job: GenerationJob): Promise<GenerationJob> {
  const supabase = createServerSupabaseClient();
  const payload = (job.request_payload as Record<string, unknown>) ?? {};
  const sourcePhotoId = typeof payload.source_photo_id === "string" ? payload.source_photo_id : null;
  const checkpoint = (job.result_refs as Record<string, unknown>) ?? {};

  await advanceStage(job.id, "validating", "checking your room photo");
  const { data: room, error: roomError } = await supabase.from("rooms").select("*").eq("id", job.room_id).single();
  if (roomError || !room) {
    return failJob(job.id, {
      errorCode: "room_not_found",
      ownerMessage: "We couldn't find this room.",
      detail: roomError?.message,
      retryable: false
    });
  }
  if (!sourcePhotoId) {
    return failJob(job.id, {
      errorCode: "missing_source_photo",
      ownerMessage: "Add a room photo before designing it.",
      detail: "source_photo_id missing",
      retryable: false
    });
  }
  const { data: sourcePhoto } = await supabase
    .from("photos")
    .select("*")
    .eq("id", sourcePhotoId)
    .eq("room_id", room.id)
    .maybeSingle();
  if (!sourcePhoto) {
    return failJob(job.id, {
      errorCode: "source_photo_not_found",
      ownerMessage: "We couldn't find the room photo for this design.",
      detail: sourcePhotoId,
      retryable: false
    });
  }
  const { data: home } = await supabase.from("homes").select("*").eq("id", room.home_id).maybeSingle();
  const { data: preferences } = home
    ? await supabase
        .from("design_preferences")
        .select("preference_type, label")
        .eq("home_id", home.id)
        .order("created_at", { ascending: true })
    : { data: [] };

  let brief = checkpoint.autopilot_brief as AutopilotBrief | undefined;
  let briefId = typeof checkpoint.brief_id === "string" ? checkpoint.brief_id : null;
  if (!brief) {
    await advanceStage(job.id, "planning", "composing your room direction");
    try {
      brief = await firstDesignBriefCompiler({
        room,
        home,
        sourcePhoto,
        wholeHomeMemory: home
          ? buildWholeHomeMemory({ home, room, preferences: preferences ?? [] })
          : undefined
      });
    } catch (error) {
      return failJob(job.id, {
        errorCode: "brief_compile_failed",
        ownerMessage: "We couldn't finish the room direction. Your request is saved — try again.",
        detail: error instanceof Error ? error.message : String(error)
      });
    }
    if (brief.blocking_questions.length) {
      return failJob(job.id, {
        errorCode: "brief_needs_information",
        ownerMessage: brief.blocking_questions.join(" "),
        detail: "compiler returned blocking_questions",
        retryable: false
      });
    }
    const { data: latest } = await supabase
      .from("room_analyses")
      .select("version")
      .eq("room_id", room.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: storedBrief, error: briefError } = await supabase
      .from("room_analyses")
      .insert({
        room_id: room.id,
        analysis: brief,
        version: (latest?.version ?? 0) + 1,
        status: "compiled",
        source_photo_ids: [sourcePhoto.id],
        brief_snapshot: {
          outcome: room.design_brief,
          purpose: room.purpose,
          provenance: "first_design_compiler_v1"
        },
        quality_score: Math.round(brief.confidence * 100),
        test_run_id: room.test_run_id
      })
      .select("id")
      .single();
    if (briefError || !storedBrief) {
      return failJob(job.id, {
        errorCode: "brief_persist_failed",
        ownerMessage: "We couldn't save the room direction. Your request is saved — try again.",
        detail: briefError?.message
      });
    }
    briefId = storedBrief.id;
    await checkpointResult(job.id, { autopilot_brief: brief, brief_id: briefId });
  }

  const basePrompt = renderPromptFromBrief(brief, room.design_brief);
  let imageUrl = typeof checkpoint.image_url === "string" ? checkpoint.image_url : null;
  if (!imageUrl) {
    await advanceStage(job.id, "generating", "creating your room design");
    try {
      imageUrl = await generateAndStoreImage({
        roomId: room.id,
        sourceImageUrl: sourcePhoto.file_url,
        prompt: basePrompt,
        serviceName: "First Design Image Generator",
        promptVersion: "first_design_v1"
      });
    } catch (error) {
      return failJob(job.id, {
        errorCode: "image_generation_failed",
        ownerMessage: "The image service didn't respond. Your room direction is saved — try again.",
        detail: error instanceof Error ? error.message : String(error)
      });
    }
    await checkpointResult(job.id, { image_url: imageUrl, image_ready: true });
  }

  let firstReview = checkpoint.finished_image_review as FinishedImageReview | undefined;
  if (!firstReview) {
    await advanceStage(job.id, "validating", "reviewing the finished room against your photo");
    try {
      firstReview = await reviewAttempt({ room, sourcePhoto, imageUrl, brief, attempt: 1 });
    } catch (error) {
      return failJob(job.id, {
        errorCode: "finished_review_unavailable",
        ownerMessage: "Your image is saved, but its final room check did not finish. Try again to continue the review.",
        detail: error instanceof Error ? error.message : String(error)
      });
    }
    await checkpointResult(job.id, { finished_image_review: firstReview });
  }

  await advanceStage(job.id, "persisting", "saving your room design");
  let firstRenderId = typeof checkpoint.render_id === "string" ? checkpoint.render_id : null;
  try {
    firstRenderId = await persistRenderAttempt({
      jobId: job.id,
      checkpointKey: "render_id",
      checkpointRenderId: firstRenderId,
      room,
      sourcePhoto,
      imageUrl,
      prompt: basePrompt,
      brief,
      briefId,
      review: firstReview,
      attempt: 1
    });
  } catch (error) {
    return failJob(job.id, {
      errorCode: "render_persist_failed",
      ownerMessage: "The finished design couldn't be saved. Try again.",
      detail: error instanceof Error ? error.message : String(error)
    });
  }

  if (!reviewFailed(firstReview)) {
    return finishWithCandidate({ job, room, sourcePhoto, renderId: firstRenderId, briefId, attemptRenderIds: [firstRenderId] });
  }

  const repairPrompt = renderRepairPromptFromReview(brief, room.design_brief, firstReview);
  let repairImageUrl = typeof checkpoint.repair_image_url === "string" ? checkpoint.repair_image_url : null;
  if (!repairImageUrl) {
    await advanceStage(job.id, "generating", "repairing the room while preserving its architecture");
    try {
      repairImageUrl = await generateAndStoreImage({
        roomId: room.id,
        sourceImageUrl: sourcePhoto.file_url,
        prompt: repairPrompt,
        serviceName: "First Design Image Repair",
        promptVersion: "first_design_repair_v1"
      });
    } catch (error) {
      return failJob(job.id, {
        errorCode: "image_repair_failed",
        ownerMessage: "The first attempt was not safe to show, and its one repair did not finish. Your work is saved — try again.",
        detail: error instanceof Error ? error.message : String(error)
      });
    }
    await checkpointResult(job.id, { repair_image_url: repairImageUrl, repair_image_ready: true });
  }

  let repairReview = checkpoint.repair_finished_image_review as FinishedImageReview | undefined;
  if (!repairReview) {
    await advanceStage(job.id, "validating", "reviewing the repaired room against your photo");
    try {
      repairReview = await reviewAttempt({ room, sourcePhoto, imageUrl: repairImageUrl, brief, attempt: 2 });
    } catch (error) {
      return failJob(job.id, {
        errorCode: "repair_review_unavailable",
        ownerMessage: "The repaired image is saved, but its final room check did not finish. Try again to continue the review.",
        detail: error instanceof Error ? error.message : String(error)
      });
    }
    await checkpointResult(job.id, { repair_finished_image_review: repairReview });
  }

  await advanceStage(job.id, "persisting", "saving the repaired room design");
  let repairRenderId = typeof checkpoint.repair_render_id === "string" ? checkpoint.repair_render_id : null;
  try {
    repairRenderId = await persistRenderAttempt({
      jobId: job.id,
      checkpointKey: "repair_render_id",
      checkpointRenderId: repairRenderId,
      room,
      sourcePhoto,
      imageUrl: repairImageUrl,
      prompt: repairPrompt,
      brief,
      briefId,
      review: repairReview,
      attempt: 2,
      repairOfRenderId: firstRenderId,
      repairInstructions: repairFindings(firstReview)
    });
  } catch (error) {
    return failJob(job.id, {
      errorCode: "repair_persist_failed",
      ownerMessage: "The repaired design couldn't be saved. Try again.",
      detail: error instanceof Error ? error.message : String(error)
    });
  }

  if (reviewFailed(repairReview)) {
    return failJob(job.id, {
      errorCode: "finished_image_repair_failed",
      ownerMessage: "Two attempts changed important parts of your room, so both were saved but neither was presented as ready.",
      detail: repairFindings(repairReview).join(" | "),
      retryable: false
    });
  }

  return finishWithCandidate({
    job,
    room,
    sourcePhoto,
    renderId: repairRenderId,
    briefId,
    attemptRenderIds: [firstRenderId, repairRenderId]
  });
}

export async function generateAndStoreImage(input: {
  roomId: string;
  sourceImageUrl: string;
  prompt: string;
  serviceName: string;
  promptVersion: string;
}) {
  if (resolveAiMode() === "mock") return input.sourceImageUrl;

  const imageBase64 = await generateImageEdit({
    roomId: input.roomId,
    serviceName: input.serviceName,
    promptVersion: input.promptVersion,
    prompt: input.prompt,
    sourceImageUrl: input.sourceImageUrl
  });
  if (!imageBase64) throw new Error("No image returned.");

  const bytes = Uint8Array.from(atob(imageBase64), (char) => char.charCodeAt(0));
  const storagePath = `${input.roomId}/renders/${crypto.randomUUID()}.png`;
  const serviceSupabase = createServiceSupabaseClient();
  const { error: uploadError } = await serviceSupabase.storage
    .from("room-photos")
    .upload(storagePath, bytes, { contentType: "image/png", cacheControl: "3600", upsert: false });
  if (uploadError) throw uploadError;
  return serviceSupabase.storage.from("room-photos").getPublicUrl(storagePath).data.publicUrl;
}

export async function reviewAttempt(input: {
  room: RoomRow;
  sourcePhoto: Photo;
  imageUrl: string;
  brief: AutopilotBrief;
  attempt: 1 | 2;
}) {
  return reviewFinishedImage({
    roomId: input.room.id,
    sourceImageUrl: input.sourcePhoto.file_url,
    finishedImageUrl: input.imageUrl,
    brief: input.brief,
    typedFacts: {
      dimensions: input.room.dimensions,
      constraints: input.room.constraints,
      existing_items: input.room.existing_items
    },
    attempt: input.attempt
  });
}

export async function persistRenderAttempt(input: {
  jobId: string;
  checkpointKey: "render_id" | "repair_render_id" | "revision_render_id" | "revision_repair_render_id";
  checkpointRenderId: string | null;
  room: RoomRow;
  sourcePhoto: Photo;
  imageUrl: string;
  prompt: string;
  brief: AutopilotBrief;
  briefId: string | null;
  review: FinishedImageReview;
  attempt: 1 | 2;
  repairOfRenderId?: string;
  repairInstructions?: string[];
  ownerInstructions?: string;
  parentRenderId?: string;
  operation?: "first_design" | "visual_revision";
}) {
  const supabase = createServerSupabaseClient();
  const renderId = input.checkpointRenderId ?? crypto.randomUUID();
  if (!input.checkpointRenderId) await checkpointResult(input.jobId, { [input.checkpointKey]: renderId });

  const { data: existing, error: existingError } = await supabase
    .from("renders")
    .select("id")
    .eq("id", renderId)
    .eq("room_id", input.room.id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing.id;

  const { data: render, error: renderError } = await supabase
    .from("renders")
    .insert({
      id: renderId,
      room_id: input.room.id,
      source_photo_id: input.sourcePhoto.id,
      file_url: input.imageUrl,
      prompt: input.prompt,
      render_prompt: input.prompt,
      preservation_constraints: input.brief.preservation_constraints,
      transformation_instructions: [...input.brief.functions_and_zones, ...input.brief.palette_materials_lighting],
      negative_instructions: input.brief.negative_instructions,
      user_regeneration_instructions: input.ownerInstructions ?? null,
      generated_image_path: input.imageUrl,
      status: reviewFailed(input.review) ? "review_failed" : "candidate",
      critique: {
        brief_id: input.briefId,
        generation_job_id: input.jobId,
        operation: input.operation ?? "first_design",
        parent_render_id: input.parentRenderId ?? null,
        review_attempt: input.attempt,
        repair_of_render_id: input.repairOfRenderId ?? null,
        repair_instructions: input.repairInstructions ?? [],
        finished_image_review: input.review
      },
      quality_score: reviewScore(input.review),
      test_run_id: input.room.test_run_id
    })
    .select("id")
    .single();
  if (renderError || !render) throw renderError ?? new Error("Render insert returned no row.");
  return render.id;
}

async function finishWithCandidate(input: {
  job: GenerationJob;
  room: RoomRow;
  sourcePhoto: Photo;
  renderId: string;
  briefId: string | null;
  attemptRenderIds: string[];
}) {
  const supabase = createServerSupabaseClient();
  await supabase
    .from("renders")
    .update({ status: "historical" })
    .eq("room_id", input.room.id)
    .eq("source_photo_id", input.sourcePhoto.id)
    .eq("status", "candidate")
    .neq("id", input.renderId);
  await supabase.from("rooms").update({ status: "design_ready", current_stage: "design_ready" }).eq("id", input.room.id);
  return completeJob(input.job.id, {
    render_id: input.renderId,
    brief_id: input.briefId ?? "",
    attempt_render_ids: input.attemptRenderIds
  });
}

export function reviewFailed(review: FinishedImageReview) {
  return review.verdict === "failure" || review.critical_violations.length > 0;
}

function reviewScore(review: FinishedImageReview) {
  return Math.round(
    (review.architecture_preservation_score +
      review.program_fulfillment_score +
      review.access_and_safety_score +
      review.realism_score) /
      4
  );
}

export function repairFindings(review: FinishedImageReview) {
  if (review.critical_violations.length) return review.critical_violations;
  if (review.warnings.length) return review.warnings;
  return [review.summary];
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

function renderRepairPromptFromReview(
  brief: AutopilotBrief,
  outcome: string | null,
  review: FinishedImageReview
) {
  return [
    renderPromptFromBrief(brief, outcome),
    "This is the one permitted repair. Create a fresh edit from the original source photograph.",
    "Correct every final-review failure below while keeping the intended design direction and all unrelated source architecture unchanged.",
    `Final-review failures: ${repairFindings(review).join("; ")}`,
    "Do not repeat, conceal, crop around, or compensate for a failed architectural or access condition."
  ].join("\n");
}
