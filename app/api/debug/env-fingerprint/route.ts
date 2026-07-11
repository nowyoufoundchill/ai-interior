import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * P0.0 test-isolation preflight. Mutation-capable suites drive this running
 * server, so knowing which Supabase project THE SERVER writes to (not which
 * one the suite script loaded) is what actually prevents automated writes to
 * production. Returns a non-reversible fingerprint of the Supabase project
 * ref plus the active AI mode — never URLs, keys, or refs themselves.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  let ref: string | null = null;
  try {
    ref = new URL(url).hostname.split(".")[0] || null;
  } catch {
    ref = null;
  }

  const fingerprint = ref
    ? createHash("sha256").update(ref).digest("hex").slice(0, 12)
    : null;

  return NextResponse.json({
    supabase_project_fingerprint: fingerprint,
    ai_mode: process.env.AI_MODE ?? "unset"
  });
}
