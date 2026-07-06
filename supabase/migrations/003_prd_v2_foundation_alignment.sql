alter table public.rooms
  add column if not exists current_stage text not null default 'empty';

update public.rooms
set current_stage = case
  when status in ('renders', 'products') then 'executing'
  when status in ('selected') then 'concept_locked'
  when status in ('concepts') then 'concepts'
  when status in ('analyzed') then 'diagnosed'
  when status in ('photos') then 'photos'
  else 'empty'
end
where current_stage = 'empty';

alter table public.room_analyses
  add column if not exists version integer,
  add column if not exists status text not null default 'current',
  add column if not exists source_photo_ids jsonb not null default '[]'::jsonb,
  add column if not exists brief_snapshot jsonb not null default '{}'::jsonb;

with ordered as (
  select
    id,
    row_number() over (partition by room_id order by created_at asc, id asc) as version_number,
    max(created_at) over (partition by room_id) as latest_created_at
  from public.room_analyses
)
update public.room_analyses analyses
set
  version = ordered.version_number,
  status = case when analyses.created_at = ordered.latest_created_at then 'current' else 'stale' end
from ordered
where analyses.id = ordered.id
  and analyses.version is null;

alter table public.mood_boards
  add column if not exists version integer,
  add column if not exists parent_version integer,
  add column if not exists origin text not null default 'generated',
  add column if not exists status text not null default 'draft',
  add column if not exists locked_fields jsonb not null default '[]'::jsonb;

with ordered as (
  select
    id,
    row_number() over (partition by room_id order by created_at asc, id asc) as version_number
  from public.mood_boards
)
update public.mood_boards boards
set version = ordered.version_number
from ordered
where boards.id = ordered.id
  and boards.version is null;

update public.mood_boards
set status = case
  when selected then 'locked'
  else 'draft'
end
where status = 'draft';

alter table public.products
  add column if not exists mood_board_version integer,
  add column if not exists cached_image_path text;

update public.products products
set mood_board_version = boards.version
from public.mood_boards boards
where products.mood_board_id = boards.id
  and products.mood_board_version is null;

update public.products
set status = 'suggested'
where status = 'candidate';

alter table public.renders
  add column if not exists mood_board_version integer,
  add column if not exists render_prompt text,
  add column if not exists user_regeneration_instructions text,
  add column if not exists generated_image_path text,
  add column if not exists status text not null default 'current';

update public.renders renders
set
  mood_board_version = boards.version,
  render_prompt = coalesce(renders.render_prompt, renders.prompt),
  generated_image_path = coalesce(renders.generated_image_path, renders.file_url)
from public.mood_boards boards
where renders.mood_board_id = boards.id
  and renders.mood_board_version is null;

alter table public.ai_runs
  add column if not exists provider text,
  add column if not exists raw_input text,
  add column if not exists raw_output text,
  add column if not exists latency_ms integer;

update public.ai_runs
set provider = coalesce(provider, 'openai')
where provider is null;

create table if not exists public.design_preferences (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes(id) on delete cascade,
  preference_type text not null,
  label text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  classified_intent text,
  referenced_artifact_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

drop trigger if exists touch_design_preferences_updated_at on public.design_preferences;
create trigger touch_design_preferences_updated_at
before update on public.design_preferences
for each row execute function public.touch_updated_at();

create index if not exists room_analyses_room_id_version_idx on public.room_analyses(room_id, version desc);
create index if not exists mood_boards_room_id_status_idx on public.mood_boards(room_id, status, version desc);
create index if not exists products_room_id_status_idx on public.products(room_id, status, created_at desc);
create index if not exists renders_room_id_status_idx on public.renders(room_id, status, created_at desc);
create index if not exists design_preferences_home_id_idx on public.design_preferences(home_id);
create index if not exists chat_messages_room_id_idx on public.chat_messages(room_id, created_at desc);
