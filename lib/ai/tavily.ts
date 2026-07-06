const TAVILY_SEARCH_URL = "https://api.tavily.com/search";
const TAVILY_EXTRACT_URL = "https://api.tavily.com/extract";
const DEFAULT_TIMEOUT_MS = 45000;

type TavilySearchResult = {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
  raw_content?: string | null;
  images?: Array<{
    url?: string;
    description?: string;
  }>;
};

type TavilySearchResponse = {
  query?: string;
  answer?: string;
  images?: Array<{
    url?: string;
    description?: string;
  }>;
  results?: TavilySearchResult[];
  response_time?: number | string;
  usage?: {
    credits?: number;
  };
  request_id?: string;
};

type TavilyExtractResponse = {
  results?: Array<{
    url?: string;
    raw_content?: string;
    images?: Array<{
      url?: string;
      description?: string;
    }>;
    favicon?: string;
  }>;
  failed_results?: unknown[];
  response_time?: number | string;
  usage?: {
    credits?: number;
  };
  request_id?: string;
};

export function isTavilyConfigured() {
  return Boolean(process.env.TAVILY_API_KEY);
}

export async function searchTavily(input: {
  query: string;
  maxResults?: number;
  includeRawContent?: boolean;
  includeImages?: boolean;
}) {
  return callTavily<TavilySearchResponse>(TAVILY_SEARCH_URL, {
    query: input.query,
    search_depth: "advanced",
    max_results: input.maxResults ?? 5,
    include_answer: "advanced",
    include_raw_content: input.includeRawContent ? "markdown" : false,
    include_images: input.includeImages ?? true,
    include_image_descriptions: input.includeImages ?? true,
    include_usage: true,
    country: "united states",
    topic: "general"
  });
}

export async function extractTavily(input: {
  urls: string[];
  query?: string;
}) {
  return callTavily<TavilyExtractResponse>(TAVILY_EXTRACT_URL, {
    urls: input.urls,
    query: input.query,
    chunks_per_source: input.query ? 3 : undefined,
    extract_depth: "advanced",
    include_images: true,
    format: "markdown"
  });
}

async function callTavily<T>(url: string, body: Record<string, unknown>) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY is not configured.");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(Number(process.env.TAVILY_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS))
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof (payload as { detail?: string; error?: string } | null)?.detail === "string"
        ? (payload as { detail: string }).detail
        : typeof (payload as { error?: string } | null)?.error === "string"
          ? (payload as { error: string }).error
          : "Tavily request failed.";
    throw new Error(message);
  }

  return payload as T;
}
