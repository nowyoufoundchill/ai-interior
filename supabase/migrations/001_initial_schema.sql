create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.users (id, email, name)
values ('00000000-0000-0000-0000-000000000001', 'private-household@example.local', 'Private Household')
on conflict (id) do nothing;

create table if not exists public.homes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) default '00000000-0000-0000-0000-000000000001',
  name text not null,
  region text,
  home_type text,
  style_notes text,
  whole_home_palette jsonb not null default '[]'::jsonb,
  whole_home_constraints jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes(id) on delete cascade,
  name text not null,
  room_type text,
  purpose text,
  dimensions jsonb not null default '{}'::jsonb,
  ceiling_height numeric,
  budget_range text,
  style_preferences jsonb not null default '[]'::jsonb,
  color_preferences jsonb not null default '[]'::jsonb,
  constraints jsonb not null default '[]'::jsonb,
  existing_items jsonb not null default '[]'::jsonb,
  design_brief text,
  status text not null default 'intake',
  selected_mood_board_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  file_url text not null,
  storage_path text not null,
  label text,
  angle_type text,
  ai_caption text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.room_analyses (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  analysis jsonb not null,
  quality_score numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.mood_boards (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  concept_name text not null,
  concept_data jsonb not null,
  selected boolean not null default false,
  quality_score numeric,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rooms_selected_mood_board_id_fkey'
      and conrelid = 'public.rooms'::regclass
  ) then
    alter table public.rooms
      add constraint rooms_selected_mood_board_id_fkey
      foreign key (selected_mood_board_id)
      references public.mood_boards(id)
      on delete set null;
  end if;
end
$$;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  mood_board_id uuid references public.mood_boards(id) on delete set null,
  category text not null,
  name text not null,
  retailer text,
  url text,
  image_url text,
  price numeric,
  dimensions jsonb not null default '{}'::jsonb,
  material text,
  finish text,
  scores jsonb not null default '{}'::jsonb,
  reason_selected text,
  risks jsonb not null default '[]'::jsonb,
  alternatives jsonb not null default '[]'::jsonb,
  status text not null default 'candidate',
  created_at timestamptz not null default now()
);

create table if not exists public.renders (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  mood_board_id uuid references public.mood_boards(id) on delete set null,
  source_photo_id uuid references public.photos(id) on delete set null,
  file_url text,
  prompt text not null,
  preservation_constraints jsonb not null default '[]'::jsonb,
  transformation_instructions jsonb not null default '[]'::jsonb,
  negative_instructions jsonb not null default '[]'::jsonb,
  critique jsonb not null default '{}'::jsonb,
  quality_score numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.revisions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_message text not null,
  assistant_response text not null,
  revision_type text not null,
  state_before jsonb not null default '{}'::jsonb,
  state_after jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.design_memories (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('user', 'home', 'room')),
  scope_id uuid not null,
  memory_type text not null,
  content jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete set null,
  service_name text not null,
  prompt_version text not null,
  model_name text,
  status text not null default 'mocked',
  input_payload jsonb not null default '{}'::jsonb,
  output_payload jsonb not null default '{}'::jsonb,
  validation_errors jsonb not null default '[]'::jsonb,
  quality_score numeric,
  token_estimate integer,
  cost_estimate numeric,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_users_updated_at on public.users;
create trigger touch_users_updated_at
before update on public.users
for each row execute function public.touch_updated_at();

drop trigger if exists touch_homes_updated_at on public.homes;
create trigger touch_homes_updated_at
before update on public.homes
for each row execute function public.touch_updated_at();

drop trigger if exists touch_rooms_updated_at on public.rooms;
create trigger touch_rooms_updated_at
before update on public.rooms
for each row execute function public.touch_updated_at();

drop trigger if exists touch_design_memories_updated_at on public.design_memories;
create trigger touch_design_memories_updated_at
before update on public.design_memories
for each row execute function public.touch_updated_at();

create index if not exists homes_user_id_idx on public.homes(user_id);
create index if not exists rooms_home_id_idx on public.rooms(home_id);
create index if not exists photos_room_id_idx on public.photos(room_id);
create index if not exists mood_boards_room_id_idx on public.mood_boards(room_id);
create index if not exists products_room_id_idx on public.products(room_id);
create index if not exists renders_room_id_idx on public.renders(room_id);
create index if not exists revisions_room_id_idx on public.revisions(room_id);
create index if not exists ai_runs_room_id_idx on public.ai_runs(room_id);

grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all routines in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;

insert into storage.buckets (id, name, public)
values ('room-photos', 'room-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "Allow private household uploads" on storage.objects;
create policy "Allow private household uploads"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'room-photos');

drop policy if exists "Allow private household photo reads" on storage.objects;
create policy "Allow private household photo reads"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'room-photos');

drop policy if exists "Allow private household photo updates" on storage.objects;
create policy "Allow private household photo updates"
on storage.objects for update
to anon, authenticated
using (bucket_id = 'room-photos')
with check (bucket_id = 'room-photos');

drop policy if exists "Allow private household photo deletes" on storage.objects;
create policy "Allow private household photo deletes"
on storage.objects for delete
to anon, authenticated
using (bucket_id = 'room-photos');
