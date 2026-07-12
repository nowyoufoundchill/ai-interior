import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ActionProposal, Database, Json } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * P0.4 action-proposal persistence (docs/P0_P1_EXECUTION_PLAN_2026-07-10.md §P0.4).
 *
 * Server-only. A proposal is the durable, structured record of a design-chat
 * interpretation the owner can confirm. This module is the single writer/reader,
 * and it degrades gracefully when migration 009 has not been applied yet: chat
 * keeps returning its advisory reply (no card) and the confirm route fails closed
 * with a clear message, so the code can land before the migration.
 */

type Supabase = SupabaseClient<Database>;

export class ProposalsTableMissingError extends Error {
  constructor() {
    super("action_proposals table is not present. Apply migration 009_action_proposals.sql.");
    this.name = "ProposalsTableMissingError";
  }
}

export function isMissingProposalsTable(message: string | undefined): boolean {
  return Boolean(
    message && /action_proposals/.test(message) && /(does not exist|schema cache|relation)/i.test(message)
  );
}

export interface InsertProposalInput {
  roomId: string;
  chatMessageId: string | null;
  intentType: string;
  scope: string;
  scopePhotoIds: string[];
  summary: string;
  normalizedInstructions: string | null;
  expectedInvalidations: string[];
  confidence: string;
  clarifyingQuestion: string | null;
  targetArtifactIds?: string[];
  proposalVersion: number;
  testRunId?: string | null;
}

/**
 * Persist a proposal. Returns null (never throws) when the table is absent, so a
 * chat turn still succeeds pre-migration — the caller simply surfaces no card.
 */
export async function insertProposal(input: InsertProposalInput, client?: Supabase): Promise<ActionProposal | null> {
  const supabase = client ?? createServerSupabaseClient();
  const row: Database["public"]["Tables"]["action_proposals"]["Insert"] = {
    room_id: input.roomId,
    chat_message_id: input.chatMessageId,
    proposal_version: input.proposalVersion,
    intent_type: input.intentType,
    status: "proposed",
    summary: input.summary,
    normalized_instructions: input.normalizedInstructions,
    scope: input.scope,
    scope_photo_ids: (input.scopePhotoIds ?? []) as Json,
    target_artifact_ids: (input.targetArtifactIds ?? []) as Json,
    expected_invalidations: (input.expectedInvalidations ?? []) as Json,
    confidence: input.confidence,
    clarifying_question: input.clarifyingQuestion,
    test_run_id: input.testRunId ?? null
  };
  const { data, error } = await supabase.from("action_proposals").insert(row).select("*").single();
  if (error) {
    if (isMissingProposalsTable(error.message)) return null;
    throw new Error(error.message);
  }
  return data as ActionProposal;
}

export async function getProposal(
  proposalId: string,
  roomId: string,
  client?: Supabase
): Promise<ActionProposal | null> {
  const supabase = client ?? createServerSupabaseClient();
  const { data, error } = await supabase
    .from("action_proposals")
    .select("*")
    .eq("id", proposalId)
    .eq("room_id", roomId)
    .maybeSingle();
  if (error) {
    if (isMissingProposalsTable(error.message)) throw new ProposalsTableMissingError();
    throw new Error(error.message);
  }
  return (data as ActionProposal | null) ?? null;
}

export async function listProposals(roomId: string, client?: Supabase): Promise<ActionProposal[]> {
  const supabase = client ?? createServerSupabaseClient();
  const { data, error } = await supabase
    .from("action_proposals")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });
  if (error) {
    // Absent table (pre-migration) is not an error for a read — no proposals yet.
    if (isMissingProposalsTable(error.message)) return [];
    throw new Error(error.message);
  }
  return (data as ActionProposal[]) ?? [];
}

export async function updateProposal(
  proposalId: string,
  patch: Database["public"]["Tables"]["action_proposals"]["Update"],
  client?: Supabase
): Promise<ActionProposal | null> {
  const supabase = client ?? createServerSupabaseClient();
  const { data, error } = await supabase
    .from("action_proposals")
    .update(patch)
    .eq("id", proposalId)
    .select("*")
    .maybeSingle();
  if (error) {
    if (isMissingProposalsTable(error.message)) throw new ProposalsTableMissingError();
    throw new Error(error.message);
  }
  return (data as ActionProposal | null) ?? null;
}
