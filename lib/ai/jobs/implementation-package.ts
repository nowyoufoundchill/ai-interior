import { autopilotBriefSchema, implementationPackageSchema } from "@/lib/schemas";
import { auditImplementationPackage, compileImplementationPackage, normalizeImplementationPackage } from "@/lib/ai/implementation-package";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { GenerationJob, Json } from "@/types/database";
import { advanceStage, checkpointResult, completeJob, failJob } from "./service";

export async function executeImplementationPackage(job: GenerationJob): Promise<GenerationJob> {
  const supabase = createServerSupabaseClient();
  const payload = asRecord(job.request_payload);
  const acceptedRenderId = typeof payload.accepted_render_id === "string" ? payload.accepted_render_id : null;
  if (!acceptedRenderId) {
    return failJob(job.id, { errorCode: "accepted_design_required", ownerMessage: "Keep a room design before creating its plan.", retryable: false });
  }

  await advanceStage(job.id, "validating", "checking the accepted design and room facts");
  const [{ data: room }, { data: acceptedRender }, { data: existingCurrent }] = await Promise.all([
    supabase.from("rooms").select("*").eq("id", job.room_id).maybeSingle(),
    supabase.from("renders").select("*").eq("id", acceptedRenderId).eq("room_id", job.room_id).eq("status", "accepted").maybeSingle(),
    supabase.from("implementation_packages").select("*").eq("room_id", job.room_id).eq("status", "current").maybeSingle()
  ]);
  if (!room || !acceptedRender) {
    return failJob(job.id, { errorCode: "accepted_design_required", ownerMessage: "That accepted design is no longer current. Keep the design you want to implement, then try again.", retryable: false });
  }
  if (existingCurrent?.accepted_render_id === acceptedRenderId) {
    return completeJob(job.id, { implementation_package_id: existingCurrent.id, accepted_render_id: acceptedRenderId });
  }

  const critique = asRecord(acceptedRender.critique);
  const briefId = typeof critique.brief_id === "string" ? critique.brief_id : null;
  const [{ data: home }, { data: sourcePhoto }, { data: briefRow }, { data: products }, { data: latestPackage }] = await Promise.all([
    supabase.from("homes").select("*").eq("id", room.home_id).maybeSingle(),
    acceptedRender.source_photo_id
      ? supabase.from("photos").select("*").eq("id", acceptedRender.source_photo_id).eq("room_id", room.id).maybeSingle()
      : Promise.resolve({ data: null }),
    briefId
      ? supabase.from("room_analyses").select("analysis").eq("id", briefId).eq("room_id", room.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("products").select("*").eq("room_id", room.id).in("status", ["suggested", "approved"]),
    supabase.from("implementation_packages").select("version").eq("room_id", room.id).order("version", { ascending: false }).limit(1).maybeSingle()
  ]);
  const parsedBrief = autopilotBriefSchema.safeParse(briefRow?.analysis);
  if (!parsedBrief.success) {
    return failJob(job.id, { errorCode: "implementation_brief_missing", ownerMessage: "This design predates the implementation planner. Create and keep a fresh design before building its room plan.", retryable: false });
  }

  await advanceStage(job.id, "generating", "creating placement, buying, and measurement guidance");
  let plan;
  try {
    plan = await compileImplementationPackage({
      roomId: room.id,
      room,
      home,
      acceptedRender,
      sourcePhoto,
      brief: parsedBrief.data,
      existingProducts: products ?? []
    });
  } catch (error) {
    return failJob(job.id, { errorCode: "implementation_compile_failed", ownerMessage: "The room plan did not finish. Your accepted design is safe — try again.", detail: error instanceof Error ? error.message : String(error) });
  }
  const requiredCoverageLabels = [
    ...arrayOfStrings(room.existing_items),
    ...parsedBrief.data.keep_or_remove
  ];
  let parsedPlan = implementationPackageSchema.safeParse(plan);
  if (parsedPlan.success) {
    plan = normalizeImplementationPackage(parsedPlan.data);
    parsedPlan = implementationPackageSchema.safeParse(plan);
  }
  let auditIssues = parsedPlan.success ? auditImplementationPackage(parsedPlan.data, requiredCoverageLabels) : ["The package did not match its structured contract."];
  if (parsedPlan.success && auditIssues.length) {
    await advanceStage(job.id, "generating", "repairing unsupported claims and package consistency");
    try {
      plan = await compileImplementationPackage({
        roomId: room.id,
        room,
        home,
        acceptedRender,
        sourcePhoto,
        brief: parsedBrief.data,
        existingProducts: products ?? [],
        repair: { previousPlan: parsedPlan.data, issues: auditIssues }
      });
      parsedPlan = implementationPackageSchema.safeParse(plan);
      if (parsedPlan.success) {
        plan = normalizeImplementationPackage(parsedPlan.data);
        parsedPlan = implementationPackageSchema.safeParse(plan);
      }
      auditIssues = parsedPlan.success ? auditImplementationPackage(parsedPlan.data, requiredCoverageLabels) : ["The corrected package did not match its structured contract."];
    } catch (error) {
      return failJob(job.id, { errorCode: "implementation_compile_failed", ownerMessage: "The room plan did not finish. Your accepted design is safe — try again.", detail: error instanceof Error ? error.message : String(error) });
    }
  }
  if (!parsedPlan.success || auditIssues.length) {
    return failJob(job.id, { errorCode: "implementation_package_invalid", ownerMessage: "The room plan made claims it could not support, so it was not presented. Try again.", detail: auditIssues.join(" | "), retryable: false });
  }

  await advanceStage(job.id, "persisting", "saving the implementation package");
  const checkpoint = asRecord(job.result_refs);
  const packageId = typeof checkpoint.implementation_package_id === "string" ? checkpoint.implementation_package_id : crypto.randomUUID();
  if (!checkpoint.implementation_package_id) await checkpointResult(job.id, { implementation_package_id: packageId });
  const { data: existingArtifact } = await supabase.from("implementation_packages").select("id").eq("id", packageId).maybeSingle();
  if (!existingArtifact) {
    const { error: insertError } = await supabase.from("implementation_packages").insert({
      id: packageId,
      room_id: room.id,
      accepted_render_id: acceptedRenderId,
      version: (latestPackage?.version ?? 0) + 1,
      status: "stale",
      package: parsedPlan.data as Json,
      test_run_id: room.test_run_id
    });
    if (insertError) {
      return failJob(job.id, { errorCode: "implementation_persist_failed", ownerMessage: "The room plan could not be saved. Try again.", detail: insertError.message });
    }
  }
  const { error: staleError } = await supabase.from("implementation_packages").update({ status: "stale" }).eq("room_id", room.id).eq("status", "current").neq("id", packageId);
  const { error: currentError } = await supabase.from("implementation_packages").update({ status: "current" }).eq("id", packageId).eq("room_id", room.id);
  if (staleError || currentError) {
    return failJob(job.id, { errorCode: "implementation_activate_failed", ownerMessage: "The room plan is saved but could not become current. Try again.", detail: staleError?.message ?? currentError?.message });
  }
  await supabase.from("rooms").update({ status: "implementation_ready", current_stage: "implementation_ready" }).eq("id", room.id);
  return completeJob(job.id, { implementation_package_id: packageId, accepted_render_id: acceptedRenderId });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function arrayOfStrings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
