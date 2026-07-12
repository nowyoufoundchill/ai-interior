-- P0.4 Confirmed Chat-to-Action Execution (docs/P0_P1_EXECUTION_PLAN_2026-07-10.md §P0.4).
--
-- A design-chat turn no longer either does nothing or silently mutates state.
-- When the owner asks for a change ("replace the ocean artwork with a sky
-- painting"), the designer's interpretation is persisted here as a structured,
-- versioned ActionProposal referenced from the assistant chat message. The
-- proposal is inert until the owner explicitly confirms it; confirmation creates
-- exactly one durable `chat_action` generation_job (§4 state machine) and can
-- never be replayed by a refresh. See lib/ai/proposals.ts + lib/data/proposals.ts.
--
-- Additive only. The app tolerates this table being absent until the migration
-- is applied: chat still returns its advisory reply (no proposal card), and the
-- proposal/confirm routes fail closed with a clear "table missing" message.
--
-- Security (§4): service-role only, exactly like generation_jobs. anon/
-- authenticated are already revoked app-wide (migrations 002/004) and all access
-- is through server routes using the service role, which bypasses RLS. RLS is
-- enabled with no browser-role policies so the table is server-only by
-- construction — no SECURITY DEFINER workaround. A proposal may only reference
-- artifacts belonging to its room; that scoping is enforced in the app layer.

create table if not exists public.action_proposals (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  -- The assistant chat message that surfaced this proposal, and (once applied)
  -- the assistant message that reports the result back into the same thread.
  chat_message_id uuid references public.chat_messages(id) on delete set null,
  result_message_id uuid references public.chat_messages(id) on delete set null,
  proposal_version integer not null default 1,
  intent_type text not null
    check (intent_type in ('render_revision', 'concept_revision', 'product_revision', 'preference_update', 'clarification', 'question')),
  status text not null default 'proposed'
    check (status in ('proposed', 'confirmed', 'executing', 'applied', 'rejected', 'failed')),
  -- Owner-facing summary of the proposed change, and the normalized instruction
  -- string shown to the owner AND handed verbatim to the durable job.
  summary text not null,
  normalized_instructions text,
  scope text not null default 'all_perspectives'
    check (scope in ('one_perspective', 'selected_perspectives', 'all_perspectives', 'concept', 'products', 'preferences', 'none')),
  scope_photo_ids jsonb not null default '[]'::jsonb,
  target_artifact_ids jsonb not null default '[]'::jsonb,
  -- The stale/invalidation consequences previewed before confirmation. Must match
  -- the executable §4 integrity table (the durable job produces exactly these).
  expected_invalidations jsonb not null default '[]'::jsonb,
  confidence text not null default 'high' check (confidence in ('high', 'medium', 'low')),
  clarifying_question text,
  -- The single durable job created on confirmation (idempotency key carries the
  -- proposal id, so a re-confirm/refresh resolves to the same job, never a new one).
  job_id uuid references public.generation_jobs(id) on delete set null,
  test_run_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists action_proposals_room_id_idx on public.action_proposals (room_id, created_at desc);
create index if not exists action_proposals_status_idx on public.action_proposals (room_id, status, created_at desc);
create index if not exists action_proposals_chat_message_idx on public.action_proposals (chat_message_id) where chat_message_id is not null;
create index if not exists action_proposals_test_run_id_idx on public.action_proposals (test_run_id) where test_run_id is not null;

drop trigger if exists touch_action_proposals_updated_at on public.action_proposals;
create trigger touch_action_proposals_updated_at
before update on public.action_proposals
for each row execute function public.touch_updated_at();

-- Server-only by construction. No policies for anon/authenticated; the service
-- role bypasses RLS. Matches migrations 002/004's private-household model.
alter table public.action_proposals enable row level security;
revoke all on public.action_proposals from anon, authenticated;
