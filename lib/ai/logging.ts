import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export async function logAiRun(input: {
  roomId?: string;
  serviceName: string;
  promptVersion: string;
  provider?: string;
  inputPayload: Json;
  outputPayload: Json;
  rawInput?: string;
  rawOutput?: string;
  qualityScore?: number;
  status?: string;
  validationErrors?: Json;
  modelName?: string;
  tokenEstimate?: number;
  costEstimate?: number;
  latencyMs?: number;
}) {
  const supabase = createServerSupabaseClient();

  // ai_runs has no direct signal of which test cycle produced it, but the
  // room it's logged against does (rooms.test_run_id, set at seed:test time).
  // Looking it up here — rather than requiring every AI service/route to
  // thread a testRunId parameter through — is what makes the PRD v3 §12.2
  // residue check ("zero rows/objects with any test_run_id in production")
  // actually true for ai_runs instead of silently passing because the column
  // was never populated.
  let testRunId: string | null = null;
  if (input.roomId) {
    const { data } = await supabase.from("rooms").select("test_run_id").eq("id", input.roomId).maybeSingle();
    testRunId = data?.test_run_id ?? null;
  }

  const { error } = await supabase.from("ai_runs").insert({
    room_id: input.roomId,
    test_run_id: testRunId,
    service_name: input.serviceName,
    prompt_version: input.promptVersion,
    provider: input.provider ?? "unknown",
    model_name: input.modelName ?? "unknown",
    status: input.status ?? "completed",
    input_payload: input.inputPayload,
    output_payload: input.outputPayload,
    raw_input: truncateText(input.rawInput),
    raw_output: truncateText(input.rawOutput),
    validation_errors: input.validationErrors ?? [],
    quality_score: input.qualityScore,
    token_estimate: input.tokenEstimate ?? estimateTokens(input.inputPayload, input.outputPayload),
    cost_estimate: input.costEstimate,
    latency_ms: input.latencyMs
  });

  if (error) {
    console.error("Failed to log AI run", error);
  }
}

function estimateTokens(inputPayload: Json, outputPayload: Json) {
  const serialized = `${JSON.stringify(inputPayload)} ${JSON.stringify(outputPayload)}`;
  return Math.ceil(serialized.length / 4);
}

function truncateText(value?: string) {
  if (!value) return null;
  return value.length > 12000 ? `${value.slice(0, 12000)}...[truncated]` : value;
}
