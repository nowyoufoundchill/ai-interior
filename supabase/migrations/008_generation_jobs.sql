-- P0.1 Durable Generation Jobs (docs/P0_P1_EXECUTION_PLAN_2026-07-10.md §4).
--
-- Removes long-running AI work from the lifecycle of a single browser request:
-- the durable state of a diagnosis / render / batch / chat-action lives in this
-- table, not in an open request or in-process memory, so status survives
-- refresh, navigation, and client disconnect. Additive only; the app tolerates
-- this table being absent until the migration is applied (the durable-job routes
-- fail closed with a clear message, and the legacy synchronous paths keep
-- working). See lib/ai/jobs/*.
--
-- Security (§4): service-role only. The whole app already revokes anon/
-- authenticated (migrations 002/004) and reaches data through server routes
-- using the service role, which bypasses RLS. We still enable RLS with no
-- browser-role policies so this table is server-only by construction and no
-- SECURITY DEFINER workaround is needed. Requests may only reference artifacts
-- belonging to the target room; that scoping is enforced in the job service.

create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  job_type text not null
    check (job_type in ('diagnosis', 'moodboards', 'render', 'batch_render', 'chat_action', 'products')),
  status text not null default 'queued'
    check (status in ('queued', 'planning', 'validating', 'generating', 'persisting', 'completed', 'retryable_failed', 'terminal_failed', 'cancelled')),
  stage text,
  requested_by text,
  request_payload jsonb not null default '{}'::jsonb,
  result_refs jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  progress_current integer not null default 0,
  progress_total integer not null default 1,
  correlation_id text,
  error_code text,
  error_message text,
  error_detail text,
  started_at timestamptz,
  heartbeat_at timestamptz,
  completed_at timestamptz,
  test_run_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Idempotency contract (§4): a repeated submission of the same owner action
-- returns the SAME active job instead of creating a duplicate. Only one
-- non-terminal job per logical action key can exist at a time; once a job
-- reaches a terminal status the key frees up for a genuinely new action.
create unique index if not exists generation_jobs_active_idempotency_idx
  on public.generation_jobs (idempotency_key)
  where status in ('queued', 'planning', 'validating', 'generating', 'persisting');

create index if not exists generation_jobs_room_id_idx on public.generation_jobs (room_id);
create index if not exists generation_jobs_room_status_idx on public.generation_jobs (room_id, status, created_at desc);
create index if not exists generation_jobs_test_run_id_idx on public.generation_jobs (test_run_id) where test_run_id is not null;
create index if not exists generation_jobs_correlation_id_idx on public.generation_jobs (correlation_id) where correlation_id is not null;

drop trigger if exists touch_generation_jobs_updated_at on public.generation_jobs;
create trigger touch_generation_jobs_updated_at
before update on public.generation_jobs
for each row execute function public.touch_updated_at();

-- Server-only by construction. No policies for anon/authenticated; the service
-- role bypasses RLS. Matches migrations 002/004's private-household model.
alter table public.generation_jobs enable row level security;
revoke all on public.generation_jobs from anon, authenticated;
