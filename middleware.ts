import { NextResponse, type NextRequest } from "next/server";

/**
 * P0.0 observability: guarantee every API request has a correlation ID.
 * If the caller (browser fetch, suite script) supplies `x-correlation-id`
 * it is preserved; otherwise one is generated here. The ID is forwarded to
 * the route handler on the request and echoed on the response so the
 * browser action, server logs, ai_runs rows, and resulting artifact all
 * share one traceable ID (see lib/observability.ts).
 *
 * Kept dependency-free and API-scoped: no auth, no rewrites, no secrets.
 */
export function middleware(request: NextRequest) {
  const existing = request.headers.get("x-correlation-id");
  const correlationId =
    existing && existing.length <= 80
      ? existing
      : `co-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-correlation-id", correlationId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-correlation-id", correlationId);
  return response;
}

export const config = {
  matcher: "/api/:path*"
};
