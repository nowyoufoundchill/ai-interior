import { NextResponse } from "next/server";
import { getProposal, updateProposal, ProposalsTableMissingError } from "@/lib/data/proposals";

/**
 * P0.4 proposal dismissal (docs/P0_P1_EXECUTION_PLAN_2026-07-10.md §P0.4:
 * "dismiss and later restate a proposal"). A `proposed`/`clarification` card the
 * owner declines becomes `rejected` (kept in history, never executed). Dismissing
 * an already-resolved proposal is a no-op that returns its current state.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ roomId: string; proposalId: string }> }) {
  const { roomId, proposalId } = await params;

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

  // Only an un-actioned proposal can be dismissed; once confirmed/executing/
  // applied it has a durable job and is no longer dismissable from here.
  if (proposal.status !== "proposed") {
    return NextResponse.json({ proposal, dismissed: proposal.status === "rejected" }, { status: 200 });
  }

  try {
    const updated = await updateProposal(proposal.id, { status: "rejected" });
    return NextResponse.json({ proposal: updated ?? proposal, dismissed: true });
  } catch (error) {
    if (error instanceof ProposalsTableMissingError) {
      return NextResponse.json({ error: error.message, code: "proposals_table_missing" }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to dismiss the proposal." }, { status: 500 });
  }
}
