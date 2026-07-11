-- P0.3 All-Perspective Render Batches (docs/P0_P1_EXECUTION_PLAN_2026-07-10.md
-- §P0.3). A batch is a parent `batch_render` job with one child `render` job per
-- eligible photo. The child link is an additive, self-referential FK on
-- generation_jobs so per-photo items reuse the P0.2 render runner unchanged
-- (each child is an ordinary durable, checkpoint-resumable render). Additive
-- only; the app tolerates this column being absent until applied.

alter table public.generation_jobs
  add column if not exists parent_job_id uuid references public.generation_jobs(id) on delete cascade;

create index if not exists generation_jobs_parent_job_id_idx
  on public.generation_jobs (parent_job_id)
  where parent_job_id is not null;
