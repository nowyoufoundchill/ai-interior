import { headers } from "next/headers";

/**
 * P0.0 correlation contract: one ID traces browser action → route/job →
 * ai_runs → artifact or failure.
 *
 * `middleware.ts` guarantees every /api request carries an
 * `x-correlation-id` request header (caller-supplied or generated) and
 * echoes it on the response, so the browser network tab, server logs,
 * `ai_runs.correlation_id`, and route responses all share one ID without
 * any route needing to thread it manually.
 */
export const CORRELATION_HEADER = "x-correlation-id";

export function newCorrelationId(): string {
  return `co-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * The current request's correlation ID, or null outside a request scope
 * (scripts, background execution — background jobs carry their own copy on
 * the job row instead, from P0.1 on).
 */
export async function currentCorrelationId(): Promise<string | null> {
  try {
    const requestHeaders = await headers();
    return requestHeaders.get(CORRELATION_HEADER);
  } catch {
    return null;
  }
}

/**
 * One structured log line per boundary event (UI request, provider run,
 * persisted artifact, failure), keyed by correlation ID. Values must never
 * include provider secrets or raw prompt bodies.
 */
export function logStructured(event: string, fields: Record<string, unknown>): void {
  console.log(
    JSON.stringify({
      evt: event,
      at: new Date().toISOString(),
      ...fields
    })
  );
}
