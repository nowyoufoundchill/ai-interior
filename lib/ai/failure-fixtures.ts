import { headers } from "next/headers";

/**
 * P0.0 deterministic failure fixtures (docs/P0_P1_EXECUTION_PLAN_2026-07-10.md).
 *
 * Every named generation-failure class is triggerable without a paid provider
 * call: a test sends the `x-test-failure-fixture` header with one of the
 * values below, and the mock provider path (AI_MODE=mock only — the header is
 * completely inert in live mode and in production) simulates that exact
 * failure at the boundary where the real failure would occur.
 *
 * `slow_generation` is the client-disconnect/reload fixture: it does not
 * fail, it stretches mock generation long enough for a test to close or
 * reload the page mid-flight (optionally tuned with
 * `x-test-fixture-delay-ms`, capped at 30s).
 */
export const FAILURE_FIXTURES = [
  "provider_timeout",
  "provider_rate_limit",
  "provider_server_error",
  "critic_rejection",
  "critic_timeout",
  "finished_image_critical",
  "image_no_image",
  "storage_upload_failure",
  "db_persist_failure",
  "slow_generation"
] as const;

export type FailureFixture = (typeof FAILURE_FIXTURES)[number];

export const FIXTURE_HEADER = "x-test-failure-fixture";
export const FIXTURE_DELAY_HEADER = "x-test-fixture-delay-ms";
const DEFAULT_SLOW_MS = 15000;
const MAX_SLOW_MS = 30000;

/** Simulated failure with a machine-readable code for ai_runs/debug. */
export class FixtureFailureError extends Error {
  readonly fixture: FailureFixture;
  readonly errorCode: string;

  constructor(fixture: FailureFixture, message: string) {
    super(message);
    this.name = "FixtureFailureError";
    this.fixture = fixture;
    this.errorCode = fixture;
  }
}

/**
 * The active fixture for the current request, or null. Only ever non-null
 * when AI_MODE=mock AND the request carries a recognized fixture header.
 * Safe to call from any server context — outside a request scope (scripts,
 * background work) it returns null.
 */
export async function activeFailureFixture(): Promise<FailureFixture | null> {
  if (process.env.AI_MODE !== "mock") return null;
  try {
    const requestHeaders = await headers();
    const value = requestHeaders.get(FIXTURE_HEADER);
    if (value && (FAILURE_FIXTURES as readonly string[]).includes(value)) {
      return value as FailureFixture;
    }
    return null;
  } catch {
    return null;
  }
}

export async function fixtureSlowDelayMs(): Promise<number> {
  try {
    const requestHeaders = await headers();
    const raw = Number(requestHeaders.get(FIXTURE_DELAY_HEADER));
    if (Number.isFinite(raw) && raw > 0) return Math.min(raw, MAX_SLOW_MS);
  } catch {
    // outside request scope — fall through to default
  }
  return DEFAULT_SLOW_MS;
}

/**
 * Provider-boundary simulation, called from the gateway's mock path.
 * Throws for the provider failure classes, delays for slow_generation,
 * and no-ops for fixtures that belong to other boundaries (critic,
 * storage, persistence, image).
 */
export async function simulateProviderFixture(fixture: FailureFixture | null): Promise<void> {
  if (!fixture) return;

  switch (fixture) {
    case "provider_timeout":
      throw new FixtureFailureError(
        "provider_timeout",
        "Simulated provider timeout: request exceeded its time budget (fixture)."
      );
    case "provider_rate_limit":
      throw new FixtureFailureError(
        "provider_rate_limit",
        "Simulated provider 429: rate limit exceeded (fixture)."
      );
    case "provider_server_error":
      throw new FixtureFailureError(
        "provider_server_error",
        "Simulated provider 503: upstream server error (fixture)."
      );
    case "slow_generation": {
      const delayMs = await fixtureSlowDelayMs();
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return;
    }
    default:
      return;
  }
}
