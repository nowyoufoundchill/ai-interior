-- P1.4 implementation-ready room package.
-- Append-only, accepted-render-bound artifact. Browser roles retain no table
-- access; the private app reaches it only through service-role server routes.

create table public.implementation_packages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  accepted_render_id uuid not null references public.renders(id) on delete cascade,
  version integer not null check (version > 0),
  status text not null default 'current' check (status in ('current', 'stale')),
  package jsonb not null,
  test_run_id text,
  created_at timestamptz not null default now(),
  unique (room_id, version)
);

create unique index implementation_packages_one_current_per_room_idx
  on public.implementation_packages (room_id)
  where status = 'current';
create index implementation_packages_room_status_version_idx
  on public.implementation_packages (room_id, status, version desc);
create index implementation_packages_accepted_render_id_idx
  on public.implementation_packages (accepted_render_id);
create index implementation_packages_test_run_id_idx
  on public.implementation_packages (test_run_id)
  where test_run_id is not null;

alter table public.implementation_packages enable row level security;
revoke all on public.implementation_packages from anon, authenticated;
