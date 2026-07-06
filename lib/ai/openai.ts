type InputContent =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail?: "low" | "high" | "original" | "auto" };

type ResponseItem = {
  type?: string;
  result?: string;
  content?: {
    type?: string;
    text?: string;
  }[];
};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5.5";
const DEFAULT_TIMEOUT_MS = 120000;

export function isOpenAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getOpenAiModel(override?: string) {
  return override || process.env.OPENAI_MODEL || DEFAULT_MODEL;
}

export async function runOpenAiStructuredResponse(input: {
  schemaName: string;
  schema: unknown;
  instructions: string;
  text: string;
  model?: string;
  images?: { url: string; detail?: "low" | "high" | "original" | "auto" }[];
  tools?: unknown[];
}) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const content: InputContent[] = [{ type: "input_text", text: input.text }];
  for (const image of input.images ?? []) {
    content.push({
      type: "input_image",
      image_url: image.url,
      detail: image.detail ?? "high"
    });
  }

  const requestBody: Record<string, unknown> = {
    model: getOpenAiModel(input.model),
    instructions: input.instructions,
    input: [{ role: "user", content }],
    text: {
      format: {
        type: "json_schema",
        name: input.schemaName,
        strict: true,
        schema: input.schema
      },
      verbosity: "low"
    },
    reasoning: { effort: process.env.OPENAI_REASONING_EFFORT || "low" },
    store: false
  };

  if (input.tools?.length) {
    requestBody.tools = input.tools;
  }

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(Number(process.env.OPENAI_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS))
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = typeof payload?.error?.message === "string" ? payload.error.message : "OpenAI request failed.";
    throw new Error(message);
  }

  const outputText = extractOutputText(payload);
  if (!outputText) {
    throw new Error("OpenAI response did not include output text.");
  }

  return {
    outputText,
    modelName: getOpenAiModel(input.model),
    requestBody,
    responsePayload: payload
  };
}

export async function runOpenAiImageGeneration(input: {
  prompt: string;
  model?: string;
  sourceImageUrl?: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  const content: InputContent[] = [{ type: "input_text", text: input.prompt }];
  if (input.sourceImageUrl) {
    content.push({ type: "input_image", image_url: input.sourceImageUrl, detail: "high" });
  }

  const requestBody = {
    model: getOpenAiModel(input.model),
    input: [{ role: "user", content }],
    tools: [{ type: "image_generation" }],
    store: false
  };

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(Number(process.env.OPENAI_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS))
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = typeof payload?.error?.message === "string" ? payload.error.message : "OpenAI image generation failed.";
    throw new Error(message);
  }

  if (typeof payload !== "object" || payload === null || !Array.isArray((payload as { output?: unknown }).output)) {
    return {
      imageBase64: null,
      modelName: getOpenAiModel(input.model),
      requestBody,
      responsePayload: payload
    };
  }

  const output = (payload as { output: ResponseItem[] }).output.find((item) => item.type === "image_generation_call" && typeof item.result === "string");
  return {
    imageBase64: output?.result ?? null,
    modelName: getOpenAiModel(input.model),
    requestBody,
    responsePayload: payload
  };
}

function extractOutputText(payload: unknown) {
  if (typeof payload !== "object" || payload === null) return null;
  const record = payload as { output_text?: unknown; output?: unknown };

  if (typeof record.output_text === "string") {
    return record.output_text;
  }

  if (!Array.isArray(record.output)) return null;

  for (const item of record.output as ResponseItem[]) {
    const text = item.content?.find((content) => content.type === "output_text" && typeof content.text === "string")?.text;
    if (text) return text;
  }

  return null;
}
