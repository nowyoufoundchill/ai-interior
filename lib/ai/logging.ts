import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOpenAiModel, isOpenAiConfigured } from "@/lib/ai/openai";
import type { Json } from "@/types/database";

export async function logAiRun(input: {
  roomId?: string;
  serviceName: string;
  promptVersion: string;
  inputPayload: Json;
  outputPayload: Json;
  qualityScore?: number;
  status?: string;
  validationErrors?: Json;
  modelName?: string;
  tokenEstimate?: number;
}) {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase.from("ai_runs").insert({
    room_id: input.roomId,
    service_name: input.serviceName,
    prompt_version: input.promptVersion,
    model_name: input.modelName ?? (isOpenAiConfigured() ? getOpenAiModel() : "mock"),
    status: input.status ?? (isOpenAiConfigured() ? "completed" : "mocked"),
    input_payload: input.inputPayload,
    output_payload: input.outputPayload,
    validation_errors: input.validationErrors ?? [],
    quality_score: input.qualityScore,
    token_estimate: input.tokenEstimate ?? estimateTokens(input.inputPayload, input.outputPayload)
  });

  if (error) {
    console.error("Failed to log AI run", error);
  }
}

function estimateTokens(inputPayload: Json, outputPayload: Json) {
  const serialized = `${JSON.stringify(inputPayload)} ${JSON.stringify(outputPayload)}`;
  return Math.ceil(serialized.length / 4);
}
