import type { ZodType } from "zod";
import { logAiRun } from "@/lib/ai/logging";
import { runAnthropicStructuredResponse, isAnthropicConfigured } from "@/lib/ai/anthropic";
import { runOpenAiImageGeneration, runOpenAiStructuredResponse, isOpenAiConfigured } from "@/lib/ai/openai";
import { loadPrompt } from "@/lib/ai/prompts";
import type { Json } from "@/types/database";

export type GatewayProvider = "openai" | "anthropic" | "mock";

export async function runStructuredTask<T>(input: {
  roomId?: string;
  serviceName: string;
  provider?: GatewayProvider;
  promptPath: string;
  schemaName: string;
  schema: unknown;
  zodSchema: ZodType<T>;
  taskInput: unknown;
  maxTokens?: number;
  images?: { url: string; detail?: "low" | "high" | "original" | "auto" }[];
  tools?: unknown[];
  mock?: () => T;
}) {
  const provider = input.provider ?? "openai";
  const prompt = await loadPrompt(input.promptPath);

  const inputPayload = toJsonValue(input.taskInput);

  if (provider === "anthropic" && isAnthropicConfigured()) {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const startedAt = Date.now();

      try {
        const result = await runAnthropicStructuredResponse({
          schema: input.schema,
          instructions: prompt.body,
          text: JSON.stringify(input.taskInput),
          model: resolveProviderModel("anthropic", prompt.model),
          maxTokens: input.maxTokens,
          images: input.images,
          tools: input.tools
        });

        const parsed = input.zodSchema.parse(JSON.parse(result.outputText));

        await logAiRun({
          roomId: input.roomId,
          serviceName: input.serviceName,
          promptVersion: prompt.version,
          provider: "anthropic",
          modelName: result.modelName,
          status: "completed",
          inputPayload,
          outputPayload: parsed as Json,
          rawInput: JSON.stringify(result.requestBody),
          rawOutput: JSON.stringify(result.responsePayload),
          tokenEstimate: (result.usage?.input_tokens ?? 0) + (result.usage?.output_tokens ?? 0),
          latencyMs: Date.now() - startedAt
        });

        return parsed;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Gateway structured task failed.");

        if (attempt === 2) {
          await logAiRun({
            roomId: input.roomId,
            serviceName: input.serviceName,
            promptVersion: prompt.version,
            provider: "anthropic",
            modelName: prompt.model,
            status: "failed",
            inputPayload,
            outputPayload: {},
            validationErrors: [lastError.message],
            latencyMs: Date.now() - startedAt
          });
        }
      }
    }

    throw lastError ?? new Error("Gateway structured task failed.");
  }

  if (provider === "openai" && isOpenAiConfigured()) {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const startedAt = Date.now();

      try {
        const result = await runOpenAiStructuredResponse({
          schemaName: input.schemaName,
          schema: input.schema,
          instructions: prompt.body,
          text: JSON.stringify(input.taskInput),
          model: resolveProviderModel("openai", prompt.model),
          images: input.images,
          tools: input.tools
        });

        const parsed = input.zodSchema.parse(JSON.parse(result.outputText));

        await logAiRun({
          roomId: input.roomId,
          serviceName: input.serviceName,
          promptVersion: prompt.version,
          provider: "openai",
          modelName: result.modelName,
          status: "completed",
          inputPayload,
          outputPayload: parsed as Json,
          rawInput: JSON.stringify(result.requestBody),
          rawOutput: JSON.stringify(result.responsePayload),
          latencyMs: Date.now() - startedAt
        });

        return parsed;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Gateway structured task failed.");

        if (attempt === 2) {
          await logAiRun({
            roomId: input.roomId,
            serviceName: input.serviceName,
            promptVersion: prompt.version,
            provider: "openai",
            modelName: prompt.model,
            status: "failed",
            inputPayload,
            outputPayload: {},
            validationErrors: [lastError.message],
            latencyMs: Date.now() - startedAt
          });
        }
      }
    }

    throw lastError ?? new Error("Gateway structured task failed.");
  }

  if (!input.mock) {
    throw new Error(`Provider ${provider} is unavailable for ${input.serviceName}.`);
  }

  const mocked = input.mock();
  await logAiRun({
    roomId: input.roomId,
    serviceName: input.serviceName,
    promptVersion: prompt.version,
    provider: "mock",
    modelName: "mock",
    status: "mocked",
    inputPayload,
    outputPayload: mocked as Json
  });
  return mocked;
}

export async function generateImageEdit(input: {
  roomId?: string;
  serviceName: string;
  promptVersion: string;
  prompt: string;
  sourceImageUrl?: string;
}) {
  if (!isOpenAiConfigured()) {
    await logAiRun({
      roomId: input.roomId,
      serviceName: input.serviceName,
      promptVersion: input.promptVersion,
      provider: "mock",
      modelName: "mock",
      status: "mocked",
      inputPayload: {
        prompt: input.prompt,
        source_image_url: input.sourceImageUrl ?? null
      },
      outputPayload: { image_generated: false }
    });
    return null;
  }

  const startedAt = Date.now();

  try {
    const result = await runOpenAiImageGeneration({
      prompt: input.prompt,
      sourceImageUrl: input.sourceImageUrl
    });

    await logAiRun({
      roomId: input.roomId,
      serviceName: input.serviceName,
      promptVersion: input.promptVersion,
      provider: "openai",
      modelName: result?.modelName ?? "unknown",
      status: "completed",
      inputPayload: {
        prompt: input.prompt,
        source_image_url: input.sourceImageUrl ?? null
      },
      outputPayload: { image_generated: Boolean(result?.imageBase64) },
      rawInput: JSON.stringify(result?.requestBody ?? {}),
      rawOutput: JSON.stringify(result?.responsePayload ?? {}),
      latencyMs: Date.now() - startedAt
    });

    return result?.imageBase64 ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image edit generation failed.";
    await logAiRun({
      roomId: input.roomId,
      serviceName: input.serviceName,
      promptVersion: input.promptVersion,
      provider: "openai",
      modelName: process.env.OPENAI_MODEL,
      status: "failed",
      inputPayload: {
        prompt: input.prompt,
        source_image_url: input.sourceImageUrl ?? null
      },
      outputPayload: {},
      validationErrors: [message],
      latencyMs: Date.now() - startedAt
    });
    throw error;
  }
}

function toJsonValue(value: unknown): Json {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonValue(item));
  }

  if (typeof value === "object") {
    const result: Record<string, Json | undefined> = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = item === undefined ? undefined : toJsonValue(item);
    }
    return result;
  }

  return String(value);
}

function resolveProviderModel(provider: GatewayProvider, promptModel?: string) {
  if (!promptModel) return undefined;

  if (provider === "anthropic") {
    return promptModel.startsWith("claude") ? promptModel : undefined;
  }

  if (provider === "openai") {
    return promptModel.startsWith("gpt") || promptModel.startsWith("o") ? promptModel : undefined;
  }

  return promptModel;
}
