const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-5";
const DEFAULT_TIMEOUT_MS = 120000;

type AnthropicContentBlock =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "image";
      source: {
        type: "url";
        url: string;
      };
    };

type AnthropicMessageResponse = {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
  model?: string;
  stop_reason?: string | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
};

export function isAnthropicConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function getAnthropicModel(override?: string) {
  return override || process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
}

export async function runAnthropicStructuredResponse(input: {
  schema: unknown;
  instructions: string;
  text: string;
  model?: string;
  images?: { url: string }[];
  tools?: unknown[];
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }

  const content: AnthropicContentBlock[] = [];
  for (const image of input.images ?? []) {
    content.push({
      type: "image",
      source: {
        type: "url",
        url: image.url
      }
    });
  }

  content.push({
    type: "text",
    text: input.text
  });

  const requestBody: Record<string, unknown> = {
    model: getAnthropicModel(input.model),
    max_tokens: Number(process.env.ANTHROPIC_MAX_TOKENS ?? 4096),
    system: input.instructions,
    messages: [
      {
        role: "user",
        content
      }
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: sanitizeAnthropicSchema(input.schema)
      }
    }
  };

  if (input.tools?.length) {
    requestBody.tools = input.tools;
  }

  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(Number(process.env.ANTHROPIC_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS))
  });

  const payload = (await response.json().catch(() => null)) as AnthropicMessageResponse | null;

  if (!response.ok) {
    const message =
      typeof (payload as { error?: { message?: string } } | null)?.error?.message === "string"
        ? (payload as { error: { message: string } }).error.message
        : "Anthropic request failed.";
    throw new Error(message);
  }

  if (payload?.stop_reason === "max_tokens") {
    throw new Error("Anthropic response reached max_tokens before completing structured output.");
  }

  if (payload?.stop_reason === "refusal") {
    throw new Error("Anthropic refused the structured request.");
  }

  const outputText = payload?.content?.find((item) => item.type === "text" && typeof item.text === "string")?.text;
  if (!outputText) {
    throw new Error("Anthropic response did not include structured output text.");
  }

  return {
    outputText,
    modelName: payload?.model ?? getAnthropicModel(input.model),
    requestBody,
    responsePayload: payload,
    usage: payload?.usage
  };
}

function sanitizeAnthropicSchema(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAnthropicSchema(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(record)) {
    if (
      key === "minItems" ||
      key === "maxItems" ||
      key === "minLength" ||
      key === "maxLength" ||
      key === "minimum" ||
      key === "maximum" ||
      key === "exclusiveMinimum" ||
      key === "exclusiveMaximum" ||
      key === "multipleOf" ||
      key === "pattern"
    ) {
      continue;
    }

    result[key] = sanitizeAnthropicSchema(item);
  }

  return result;
}
