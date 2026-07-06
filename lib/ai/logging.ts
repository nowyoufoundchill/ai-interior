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

  const { error } = await supabase.from("ai_runs").insert({
    room_id: input.roomId,
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
