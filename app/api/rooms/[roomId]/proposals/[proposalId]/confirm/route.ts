import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { currentCorrelationId } from "@/lib/observability";
import { createOrGetActiveJob, JobsTableMissingError, toOwnerSafeJob } from "@/lib/ai/jobs/service";
import { scheduleJob } from "@/lib/ai/jobs/runtime";
import { getProposal, updateProposal, ProposalsTableMissingError } from "@/lib/data/proposals";

/**
 * P0.4 proposal confirmation (docs/P0_P1_EXECUTION_PLAN_2026-07-10.md §P0.4).
 *
 * The ONLY path that turns a design-chat proposal into a real change. It creates
 * exactly one durable `chat_action` job carrying the normalized instructions the
 * owner already saw, and can never be replayed:
 *
 *  - a `proposed` proposal → confirm once, create the job, mark it `confirmed`;
 *  - a proposal already `confirmed`/`executing`/`applied` → return its EXISTING
 *    job (created:false), so a double-click or a refresh-replay is a no-op;
 *  - a `rejected` proposal → 409 (restate it to try again);
 *  - a `question`/`clarification` → 400 (not an actionable mutation).
 *
 * The job's idempotency key carries the proposal id, so even a race resolves to
 * one job. Body may carry `{ test_force_failure_photo_ids }` (mock-only) so the
 * "confirm → provider failure → retry" scenario is deterministic.
 */
export async function POST(request: Request, { params }: { params: Promise<{ roomId: string; proposalId: string }> }) {
  const { roomId, proposalId } = await params;
  const body = await request.json().catch(() => ({}) as Record<string, unknown>);

  const supabase = createServerSupabaseClient();
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, test_run_id")
    .eq("id", roomId)
    .maybeSingle();
  if (roomError || !room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  let proposal;
  try {
    proposal = await getProposal(proposalId, roomId);
  } catch (error) {
    if (error instanceof ProposalsTableMissingError) {
      return NextResponse.json({ error: error.message, code: "proposals_table_missing" }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to read proposal." }, { status: 500 });
  }
  if (!proposal) {
    return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
  }

  if (proposal.intent_type === "question" || proposal.intent_type === "clarification") {
    return NextResponse.json(
      { error: "This message is a question, not a change to apply. Restate the specific change you want." },
      { status: 400 }
    );
  }

  // Replay guard. A proposal already confirmed/executing/applied resolves to its
  // existing job; a dismissed one cannot be confirmed.
  if (proposal.status === "rejected") {
    return NextResponse.json(
      { error: "This proposal was dismissed. Restate the change to propose it again." },
      { status: 409 }
    );
  }
  if (proposal.status !== "proposed" && proposal.job_id) {
    const { data: existing } = await supabase
      .from("generation_jobs")
      .select("*")
      .eq("id", proposal.job_id)
      .eq("room_id", roomId)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ job: toOwnerSafeJob(existing), proposal, created: false }, { status: 200 });
    }
  }

  const requestPayload: Record<string, unknown> = {
    action: proposal.intent_type,
    proposal_id: proposal.id,
    instructions: proposal.normalized_instructions ?? "",
    scope: proposal.scope,
    photo_ids: Array.isArray(proposal.scope_photo_ids) ? proposal.scope_photo_ids : []
  };
  if (Array.isArray(body.test_force_failure_photo_ids)) {
    requestPayload.test_force_failure_photo_ids = (body.test_force_failure_photo_ids as unknown[]).map(String);
  }

  const correlationId = await currentCorrelationId();

  try {
    const { job, created } = await createOrGetActiveJob({
      roomId,
      jobType: "chat_action",
      requestPayload,
      requestedBy: "owner",
      correlationId,
      testRunId: room.test_run_id
    });

    // Bind the job to the proposal and mark it confirmed. Safe to re-run: an
    // already-bound proposal is simply re-stamped with the same job id.
    const updated = await updateProposal(proposal.id, { status: "confirmed", job_id: job.id });

    if (created) scheduleJob(job.id);

    return NextResponse.json(
      { job: toOwnerSafeJob(job), proposal: updated ?? proposal, created },
      { status: created ? 202 : 200 }
    );
  } catch (error) {
    if (error instanceof JobsTableMissingError) {
      return NextResponse.json({ error: error.message, code: "jobs_table_missing" }, { status: 503 });
    }
    if (error instanceof ProposalsTableMissingError) {
      return NextResponse.json({ error: error.message, code: "proposals_table_missing" }, { status: 503 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to confirm the proposal." },
      { status: 500 }
    );
  }
}
