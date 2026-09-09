import { ARCHITECTURE_LOCK, type RenderMode } from "./render-contract";

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
const DEFAULT_MODEL = "gpt-5.6-sol";
export const DESIGN_MODEL = "gpt-5.6-sol";
export const DEFAULT_IMAGE_MODEL = "gpt-image-2.5-sunburst-2026-09-08";
const DEFAULT_TIMEOUT_MS = 120000;

export function isOpenAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getOpenAiModel(override?: string) {
  return override || process.env.OPENAI_MODEL || DEFAULT_MODEL;
}

export function getOpenAiImageModel(mode: RenderMode = "designer") {
  return mode === "concept"
    ? process.env.OPENAI_CONCEPT_IMAGE_MODEL || "gpt-image-2.5-flare"
    : process.env.OPENAI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL;
}

export function imageFailureMessage(error: unknown, fallback: string) {
  if (error instanceof Error && /organization.*verif/i.test(error.message)) {
    return "Image rendering requires OpenAI organization verification. Your room direction is saved. Verify the organization in OpenAI settings, then try again.";
  }
  return fallback;
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
  sourceImageUrl?: string;
  architectureImageUrl?: string;
  renderMode?: RenderMode;
}) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  // This boundary only edits real rooms. Never silently generate a replacement room.
  if (!input.sourceImageUrl) throw new Error("A source room image is required for image editing.");
  const modelName = getOpenAiImageModel(input.renderMode);
  const quality = process.env.OPENAI_IMAGE_QUALITY || "high";
  if (!["low", "medium", "high", "xhigh", "max", "auto"].includes(quality)) {
    throw new Error("OPENAI_IMAGE_QUALITY must be low, medium, high, xhigh, max, or auto.");
  }
  const sourceUrls = [...new Set([input.sourceImageUrl, input.architectureImageUrl].filter((url): url is string => Boolean(url)))];
  const prompt = [
    ARCHITECTURE_LOCK,
    sourceUrls.length > 1
      ? "Image 1 is the current design to edit. Image 2 is the original room photograph: use it only as the architectural source of truth. Preserve unrelated design choices in image 1."
      : "Image 1 is the room photograph to edit in place.",
    input.prompt
  ].join("\n\n");
  const requestBody = {
    model: modelName, prompt, quality, size: "auto", output_format: "png", n: 1,
    source_image_urls: sourceUrls
  };
  const form = new FormData();
  form.set("model", modelName);
  form.set("prompt", prompt);
  form.set("quality", quality);
  form.set("size", "auto");
  form.set("output_format", "png");
  form.set("n", "1");
  for (const [index, url] of sourceUrls.entries()) {
    const imageResponse = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!imageResponse.ok) throw new Error(`Source room image could not be loaded (${imageResponse.status}).`);
    const blob = await imageResponse.blob();
    const extension = ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as Record<string, string>)[blob.type];
    if (!extension || !blob.size || blob.size > 50 * 1024 * 1024) {
      throw new Error("Source room image must be a non-empty PNG, JPEG, or WebP under 50 MB.");
    }
    form.append("image[]", blob, `room-${index + 1}.${extension}`);
  }
  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(Number(process.env.OPENAI_IMAGE_TIMEOUT_MS ?? 240000))
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = typeof payload?.error?.message === "string" ? payload.error.message : "OpenAI image generation failed.";
    throw new Error(message);
  }

  const imageBase64 = payload?.data?.[0]?.b64_json;
  if (typeof imageBase64 !== "string" || !imageBase64) throw new Error("OpenAI image edit returned no image.");
  return {
    imageBase64,
    modelName,
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
