-- P0.0 observability (docs/P0_P1_EXECUTION_PLAN_2026-07-10.md):
-- one correlation ID traces browser action -> route/job -> ai_runs ->
-- artifact or failure, and provider error codes / attempt counts are
-- queryable per run for /debug. Additive only; the app is tolerant of
-- these columns being absent until the migration is applied.

alter table public.ai_runs
  add column if not exists correlation_id text,
  add column if not exists error_code text,
  add column if not exists attempt integer;

create index if not exists ai_runs_correlation_id_idx
  on public.ai_runs (correlation_id)
  where correlation_id is not null;
