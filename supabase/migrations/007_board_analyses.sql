-- Board Style Analyses
-- Stores aggregated style profiles for Pinterest boards

create table public.board_analyses (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.pinterest_boards(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  style_profile jsonb not null,
  analyzed_pin_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_board_analyses_board on public.board_analyses(board_id);
create index idx_board_analyses_user on public.board_analyses(user_id);
create index idx_board_analyses_created on public.board_analyses(created_at desc);

alter table public.board_analyses enable row level security;

create policy "Users manage own board analyses"
  on public.board_analyses for all using (auth.uid() = user_id);
