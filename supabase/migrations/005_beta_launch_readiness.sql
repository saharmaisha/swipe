alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

alter table public.search_runs
  drop constraint if exists search_runs_mode_check;

alter table public.search_runs
  add constraint search_runs_mode_check
  check (mode in ('exact', 'vibe', 'both'));

alter table public.search_runs
  add column if not exists search_scope text
    check (search_scope in ('single_pin', 'selected_pins', 'all_board')),
  add column if not exists board_id uuid references public.pinterest_boards(id) on delete set null,
  add column if not exists board_name text,
  add column if not exists selected_pin_ids uuid[] default '{}',
  add column if not exists selected_pin_count integer;

create index if not exists idx_search_runs_board on public.search_runs(board_id);

alter table public.product_results
  add column if not exists board_id uuid references public.pinterest_boards(id) on delete set null,
  add column if not exists board_name text,
  add column if not exists source_pin_id uuid references public.pinterest_pins(id) on delete set null,
  add column if not exists source_pin_title text,
  add column if not exists source_pin_image_url text,
  add column if not exists balanced_query text;

create index if not exists idx_product_results_board on public.product_results(board_id);
create index if not exists idx_product_results_source_pin on public.product_results(source_pin_id);

create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  path text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_app_events_user_created_at
  on public.app_events(user_id, created_at desc);

create index if not exists idx_app_events_type_created_at
  on public.app_events(event_type, created_at desc);

alter table public.app_events enable row level security;

drop policy if exists "Users manage own app events" on public.app_events;

create policy "Users manage own app events"
  on public.app_events for all using (auth.uid() = user_id);
