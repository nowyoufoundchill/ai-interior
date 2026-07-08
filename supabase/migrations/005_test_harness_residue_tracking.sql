-- PRD v3 test harness: every automated-flow row carries a nullable
-- test_run_id so a single query can prove "no test residue in production"
-- (PRD v3 §3 testability conventions, §12.2 residue rule). Additive only.

alter table public.users add column if not exists test_run_id text;
alter table public.homes add column if not exists test_run_id text;
alter table public.rooms add column if not exists test_run_id text;
alter table public.photos add column if not exists test_run_id text;
alter table public.room_analyses add column if not exists test_run_id text;
alter table public.mood_boards add column if not exists test_run_id text;
alter table public.products add column if not exists test_run_id text;
alter table public.renders add column if not exists test_run_id text;
alter table public.revisions add column if not exists test_run_id text;
alter table public.design_memories add column if not exists test_run_id text;
alter table public.ai_runs add column if not exists test_run_id text;
alter table public.design_preferences add column if not exists test_run_id text;
alter table public.chat_messages add column if not exists test_run_id text;

create index if not exists homes_test_run_id_idx on public.homes(test_run_id) where test_run_id is not null;
create index if not exists rooms_test_run_id_idx on public.rooms(test_run_id) where test_run_id is not null;
create index if not exists photos_test_run_id_idx on public.photos(test_run_id) where test_run_id is not null;
create index if not exists room_analyses_test_run_id_idx on public.room_analyses(test_run_id) where test_run_id is not null;
create index if not exists mood_boards_test_run_id_idx on public.mood_boards(test_run_id) where test_run_id is not null;
create index if not exists products_test_run_id_idx on public.products(test_run_id) where test_run_id is not null;
create index if not exists renders_test_run_id_idx on public.renders(test_run_id) where test_run_id is not null;
create index if not exists revisions_test_run_id_idx on public.revisions(test_run_id) where test_run_id is not null;
create index if not exists design_memories_test_run_id_idx on public.design_memories(test_run_id) where test_run_id is not null;
create index if not exists ai_runs_test_run_id_idx on public.ai_runs(test_run_id) where test_run_id is not null;
create index if not exists design_preferences_test_run_id_idx on public.design_preferences(test_run_id) where test_run_id is not null;
create index if not exists chat_messages_test_run_id_idx on public.chat_messages(test_run_id) where test_run_id is not null;
