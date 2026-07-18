import { autopilotBriefSchema, type AutopilotBrief, type FinishedImageReview } from "@/lib/schemas";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { GenerationJob, Json } from "@/types/database";
import {
  generateAndStoreImage,
  persistRenderAttempt,
  repairFindings,
  reviewAttempt,
  reviewFailed
} from "./first-design";
import { advanceStage, checkpointResult, completeJob, failJob } from "./service";

export async function executeVisualRevision(job: GenerationJob): Promise<GenerationJob> {
  const supabase = createServerSupabaseClient();
  const payload = (job.request_payload as Record<string, unknown>) ?? {};
  const parentRenderId = typeof payload.parent_render_id === "string" ? payload.parent_render_id : null;
  const sourcePhotoId = typeof payload.source_photo_id === "string" ? payload.source_photo_id : null;
  const instructions = typeof payload.instructions === "string" ? payload.instructions.trim() : "";
  const checkpoint = (job.result_refs as Record<string, unknown>) ?? {};

  await advanceStage(job.id, "validating", "checking your requested change");
  const { data: room } = await supabase.from("rooms").select("*").eq("id", job.room_id).maybeSingle();
  if (!room) {
    return failJob(job.id, {
      errorCode: "room_not_found",
      ownerMessage: "We couldn't find this room.",
      retryable: false
    });
  }
  if (!parentRenderId || !sourcePhotoId || !instructions) {
    return failJob(job.id, {
      errorCode: "invalid_revision_request",
      ownerMessage: "That room change is missing its design, photo, or instructions.",
      retryable: false
    });
  }

  const [{ data: parent }, { data: sourcePhoto }] = await Promise.all([
    supabase
      .from("renders")
      .select("*")
      .eq("id", parentRenderId)
      .eq("room_id", room.id)
      .maybeSingle(),
    supabase.from("photos").select("*").eq("id", sourcePhotoId).eq("room_id", room.id).maybeSingle()
  ]);
  const alreadyStarted = [
    "revision_image_url",
    "revision_render_id",
    "revision_repair_image_url",
    "revision_repair_render_id",
    "revision_record_id"
  ].some((key) => checkpoint[key] != null);
  if (
    !parent?.file_url ||
    !sourcePhoto ||
    parent.status === "review_failed" ||
    (!alreadyStarted && parent.status !== "candidate" && parent.status !== "accepted")
  ) {
    return failJob(job.id, {
      errorCode: "revision_parent_not_current",
      ownerMessage: "That design is no longer the current room version. Review the latest design and restate your change.",
      retryable: false
    });
  }

  const parentCritique = asRecord(parent.critique);
  const briefId = typeof parentCritique.brief_id === "string" ? parentCritique.brief_id : null;
  if (!briefId) {
    return failJob(job.id, {
      errorCode: "revision_brief_missing",
      ownerMessage: "This design predates direct revisions. Create a fresh room design before changing it here.",
      retryable: false
    });
  }
  const { data: briefRow } = await supabase
    .from("room_analyses")
    .select("analysis")
    .eq("id", briefId)
    .eq("room_id", room.id)
    .maybeSingle();
  const parsedBrief = autopilotBriefSchema.safeParse(briefRow?.analysis);
  if (!parsedBrief.success) {
    return failJob(job.id, {
      errorCode: "revision_brief_missing",
      ownerMessage: "This design predates direct revisions. Create a fresh room design before changing it here.",
      retryable: false
    });
  }
  const brief = parsedBrief.data;
  const prompt = visualRevisionPrompt(brief, instructions);

  let imageUrl = typeof checkpoint.revision_image_url === "string" ? checkpoint.revision_image_url : null;
  if (!imageUrl) {
    await advanceStage(job.id, "generating", "applying your change to this design");
    try {
      imageUrl = await generateAndStoreImage({
        roomId: room.id,
        sourceImageUrl: parent.file_url,
        prompt,
        serviceName: "Visual Revision Image Generator",
        promptVersion: "visual_revision_v1"
      });
    } catch (error) {
      return failJob(job.id, {
        errorCode: "revision_image_failed",
        ownerMessage: "The image service didn't finish that change. Your request is saved — try again.",
        detail: error instanceof Error ? error.message : String(error)
      });
    }
    await checkpointResult(job.id, { revision_image_url: imageUrl, revision_image_ready: true });
  }

  let review = checkpoint.revision_finished_image_review as FinishedImageReview | undefined;
  if (!review) {
    await advanceStage(job.id, "validating", "reviewing your revision against the original room");
    try {
      review = await reviewAttempt({ room, sourcePhoto, imageUrl, brief, attempt: 1 });
    } catch (error) {
      return failJob(job.id, {
        errorCode: "revision_review_unavailable",
        ownerMessage: "Your revision is saved, but its room check did not finish. Try again to continue the review.",
        detail: error instanceof Error ? error.message : String(error)
      });
    }
    await checkpointResult(job.id, { revision_finished_image_review: review });
  }

  await advanceStage(job.id, "persisting", "saving your revised room design");
  let renderId = typeof checkpoint.revision_render_id === "string" ? checkpoint.revision_render_id : null;
  try {
    renderId = await persistRenderAttempt({
      jobId: job.id,
      checkpointKey: "revision_render_id",
      checkpointRenderId: renderId,
      room,
      sourcePhoto,
      imageUrl,
      prompt,
      brief,
      briefId,
      review,
      attempt: 1,
      ownerInstructions: instructions,
      parentRenderId,
      operation: "visual_revision"
    });
  } catch (error) {
    return failJob(job.id, {
      errorCode: "revision_persist_failed",
      ownerMessage: "The revised design couldn't be saved. Try again.",
      detail: error instanceof Error ? error.message : String(error)
    });
  }

  if (!reviewFailed(review)) {
    return completeRevision({
      job,
      room,
      parent,
      sourcePhoto,
      renderId,
      briefId,
      instructions,
      review,
      attemptRenderIds: [renderId],
      revisionRecordId: typeof checkpoint.revision_record_id === "string" ? checkpoint.revision_record_id : null
    });
  }

  const repairInstructions = repairFindings(review);
  const repairPrompt = visualRevisionRepairPrompt(brief, instructions, repairInstructions);
  let repairImageUrl = typeof checkpoint.revision_repair_image_url === "string" ? checkpoint.revision_repair_image_url : null;
  if (!repairImageUrl) {
    await advanceStage(job.id, "generating", "repairing the revision while preserving your room");
    try {
      repairImageUrl = await generateAndStoreImage({
        roomId: room.id,
        sourceImageUrl: parent.file_url,
        prompt: repairPrompt,
        serviceName: "Visual Revision Image Repair",
        promptVersion: "visual_revision_repair_v1"
      });
    } catch (error) {
      return failJob(job.id, {
        errorCode: "revision_repair_failed",
        ownerMessage: "The first revision was not safe to show, and its one repair did not finish. Your request is saved.",
        detail: error instanceof Error ? error.message : String(error)
      });
    }
    await checkpointResult(job.id, { revision_repair_image_url: repairImageUrl, revision_repair_image_ready: true });
  }

  let repairReview = checkpoint.revision_repair_review as FinishedImageReview | undefined;
  if (!repairReview) {
    await advanceStage(job.id, "validating", "reviewing the repaired revision against the original room");
    try {
      repairReview = await reviewAttempt({ room, sourcePhoto, imageUrl: repairImageUrl, brief, attempt: 2 });
    } catch (error) {
      return failJob(job.id, {
        errorCode: "revision_repair_review_unavailable",
        ownerMessage: "The repaired revision is saved, but its final room check did not finish. Try again to continue.",
        detail: error instanceof Error ? error.message : String(error)
      });
    }
    await checkpointResult(job.id, { revision_repair_review: repairReview });
  }

  await advanceStage(job.id, "persisting", "saving the repaired revision");
  let repairRenderId = typeof checkpoint.revision_repair_render_id === "string" ? checkpoint.revision_repair_render_id : null;
  try {
    repairRenderId = await persistRenderAttempt({
      jobId: job.id,
      checkpointKey: "revision_repair_render_id",
      checkpointRenderId: repairRenderId,
      room,
      sourcePhoto,
      imageUrl: repairImageUrl,
      prompt: repairPrompt,
      brief,
      briefId,
      review: repairReview,
      attempt: 2,
      repairOfRenderId: renderId,
      repairInstructions,
      ownerInstructions: instructions,
      parentRenderId,
      operation: "visual_revision"
    });
  } catch (error) {
    return failJob(job.id, {
      errorCode: "revision_repair_persist_failed",
      ownerMessage: "The repaired revision couldn't be saved. Try again.",
      detail: error instanceof Error ? error.message : String(error)
    });
  }

  if (reviewFailed(repairReview)) {
    return failJob(job.id, {
      errorCode: "visual_revision_repair_failed",
      ownerMessage: "Two revision attempts changed important parts of your room, so neither replaced your current design.",
      detail: repairFindings(repairReview).join(" | "),
      retryable: false
    });
  }

  return completeRevision({
    job,
    room,
    parent,
    sourcePhoto,
    renderId: repairRenderId,
    briefId,
    instructions,
    review: repairReview,
    attemptRenderIds: [renderId, repairRenderId],
    revisionRecordId: typeof checkpoint.revision_record_id === "string" ? checkpoint.revision_record_id : null
  });
}

async function completeRevision(input: {
  job: GenerationJob;
  room: { id: string; test_run_id: string | null };
  parent: { id: string; status: string };
  sourcePhoto: { id: string };
  renderId: string;
  briefId: string;
  instructions: string;
  review: FinishedImageReview;
  attemptRenderIds: string[];
  revisionRecordId: string | null;
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

  const revisionId = input.revisionRecordId ?? crypto.randomUUID();
  if (!input.revisionRecordId) await checkpointResult(input.job.id, { revision_record_id: revisionId });
  const { data: existingRevision } = await supabase
    .from("revisions")
    .select("id")
    .eq("id", revisionId)
    .eq("room_id", input.room.id)
    .maybeSingle();
  if (existingRevision) {
    return completeJob(input.job.id, {
      render_id: input.renderId,
      revision_id: existingRevision.id,
      parent_render_id: input.parent.id,
      attempt_render_ids: input.attemptRenderIds
    });
  }
  const { data: revision, error } = await supabase
    .from("revisions")
    .insert({
      id: revisionId,
      room_id: input.room.id,
      user_message: input.instructions,
      assistant_response: "Your requested visual change is ready and has been checked against the original room.",
      revision_type: "render_revision",
      state_before: { render_id: input.parent.id, status: input.parent.status },
      state_after: { render_id: input.renderId, verdict: input.review.verdict, brief_id: input.briefId },
      test_run_id: input.room.test_run_id
    })
    .select("id")
    .single();
  if (error || !revision) {
    return failJob(input.job.id, {
      errorCode: "revision_record_persist_failed",
      ownerMessage: "The new design is saved, but its revision note could not be linked. Try again.",
      detail: error?.message
    });
  }

  return completeJob(input.job.id, {
    render_id: input.renderId,
    revision_id: revision.id,
    parent_render_id: input.parent.id,
    attempt_render_ids: input.attemptRenderIds
  });
}

function visualRevisionPrompt(brief: AutopilotBrief, instructions: string) {
  return [
    "Edit this current room design in place. Apply only the owner's requested visual change.",
    `Owner revision: ${instructions}`,
    `Keep the established design direction: ${brief.design_direction}`,
    `Preserve all unrelated furniture, materials, lighting, styling, and required zones: ${brief.functions_and_zones.join("; ")}`,
    `Preserve the original room architecture and camera exactly: ${brief.preservation_constraints.join("; ")}`,
    `Do not: ${brief.negative_instructions.join("; ")}`
  ].join("\n");
}

function visualRevisionRepairPrompt(brief: AutopilotBrief, instructions: string, findings: string[]) {
  return [
    visualRevisionPrompt(brief, instructions),
    "This is the one permitted repair. Start again from the previously current design.",
    `Correct every final-review failure: ${findings.join("; ")}`,
    "Do not repeat, conceal, crop around, or compensate for an architectural, access, safety, or required-zone failure."
  ].join("\n");
}

function asRecord(value: Json): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
