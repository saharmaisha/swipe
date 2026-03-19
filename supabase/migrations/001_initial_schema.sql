-- Veri: Full initial schema
-- Run against a Supabase Postgres instance

-- Enable required extensions
create extension if not exists "pgcrypto";

-- ============================================================
-- PROFILES
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_profiles_email on public.profiles(email);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- PINTEREST ACCOUNTS
-- ============================================================
create table public.pinterest_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  pinterest_user_id text not null,
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_pinterest_accounts_user on public.pinterest_accounts(user_id);
create index idx_pinterest_accounts_pid on public.pinterest_accounts(pinterest_user_id);

alter table public.pinterest_accounts enable row level security;

create policy "Users manage own pinterest accounts"
  on public.pinterest_accounts for all using (auth.uid() = user_id);

-- ============================================================
-- PINTEREST BOARDS
-- ============================================================
create table public.pinterest_boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  pinterest_board_id text not null,
  name text not null,
  description text,
  image_url text,
  pin_count integer not null default 0,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_boards_user_pid on public.pinterest_boards(user_id, pinterest_board_id);
create index idx_boards_user on public.pinterest_boards(user_id);

alter table public.pinterest_boards enable row level security;

create policy "Users manage own boards"
  on public.pinterest_boards for all using (auth.uid() = user_id);

-- ============================================================
-- PINTEREST PINS
-- ============================================================
create table public.pinterest_pins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  board_id uuid not null references public.pinterest_boards(id) on delete cascade,
  pinterest_pin_id text not null,
  title text,
  description text,
  image_url text not null,
  source_url text,
  raw_payload jsonb,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_pins_user_pid on public.pinterest_pins(user_id, pinterest_pin_id);
create index idx_pins_board on public.pinterest_pins(board_id);
create index idx_pins_user on public.pinterest_pins(user_id);

alter table public.pinterest_pins enable row level security;

create policy "Users manage own pins"
  on public.pinterest_pins for all using (auth.uid() = user_id);

-- ============================================================
-- PIN MEDIA REGIONS
-- ============================================================
create table public.pin_media_regions (
  id uuid primary key default gen_random_uuid(),
  pin_id uuid not null references public.pinterest_pins(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  x real not null,
  y real not null,
  width real not null,
  height real not null,
  label text,
  created_at timestamptz not null default now()
);

create index idx_regions_pin on public.pin_media_regions(pin_id);

alter table public.pin_media_regions enable row level security;

create policy "Users manage own regions"
  on public.pin_media_regions for all using (auth.uid() = user_id);

-- ============================================================
-- PIN ANALYSES
-- ============================================================
create table public.pin_analyses (
  id uuid primary key default gen_random_uuid(),
  pin_id uuid not null references public.pinterest_pins(id) on delete cascade,
  region_id uuid references public.pin_media_regions(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  analysis_mode text not null check (analysis_mode in ('full_pin', 'region')),
  short_description text not null,
  category text not null,
  primary_color text not null,
  secondary_colors jsonb not null default '[]',
  material_or_texture text,
  silhouette text,
  sleeve_length text,
  strap_type text,
  dress_or_skirt_length text,
  neckline text,
  fit text,
  notable_details jsonb not null default '[]',
  occasion text,
  style_keywords jsonb not null default '[]',
  broad_query text not null,
  balanced_query text not null,
  specific_query text not null,
  raw_model_output jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_analyses_pin on public.pin_analyses(pin_id);
create index idx_analyses_user on public.pin_analyses(user_id);

alter table public.pin_analyses enable row level security;

create policy "Users manage own analyses"
  on public.pin_analyses for all using (auth.uid() = user_id);

-- ============================================================
-- SEARCH RUNS
-- ============================================================
create table public.search_runs (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.pin_analyses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('exact', 'vibe')),
  budget_min real,
  budget_max real,
  preferred_retailers jsonb not null default '[]',
  excluded_retailers jsonb not null default '[]',
  provider_summary jsonb,
  created_at timestamptz not null default now()
);

create index idx_search_runs_analysis on public.search_runs(analysis_id);
create index idx_search_runs_user on public.search_runs(user_id);

alter table public.search_runs enable row level security;

create policy "Users manage own search runs"
  on public.search_runs for all using (auth.uid() = user_id);

-- ============================================================
-- PRODUCT RESULTS
-- ============================================================
create table public.product_results (
  id uuid primary key default gen_random_uuid(),
  search_run_id uuid not null references public.search_runs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_provider text not null,
  provider_product_id text,
  title text not null,
  retailer text not null,
  price_text text not null,
  numeric_price real,
  currency text not null default 'USD',
  image_url text not null,
  product_url text not null,
  match_reason text,
  match_score real,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create index idx_products_search_run on public.product_results(search_run_id);
create index idx_products_user on public.product_results(user_id);

alter table public.product_results enable row level security;

create policy "Users manage own product results"
  on public.product_results for all using (auth.uid() = user_id);

-- ============================================================
-- SAVED ITEMS
-- ============================================================
create table public.saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_result_id uuid not null references public.product_results(id) on delete cascade,
  pin_id uuid not null references public.pinterest_pins(id) on delete cascade,
  search_run_id uuid not null references public.search_runs(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index idx_saved_user_product on public.saved_items(user_id, product_result_id);
create index idx_saved_user on public.saved_items(user_id);
create index idx_saved_pin on public.saved_items(pin_id);

alter table public.saved_items enable row level security;

create policy "Users manage own saved items"
  on public.saved_items for all using (auth.uid() = user_id);

-- ============================================================
-- USER PREFERENCES
-- ============================================================
create table public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  default_budget_min real,
  default_budget_max real,
  preferred_retailers jsonb not null default '[]',
  exclude_luxury boolean not null default false,
  country_code text not null default 'US',
  currency_code text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_prefs_user on public.user_preferences(user_id);

alter table public.user_preferences enable row level security;

create policy "Users manage own preferences"
  on public.user_preferences for all using (auth.uid() = user_id);

-- ============================================================
-- PROVIDER LOGS
-- ============================================================
create table public.provider_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  search_run_id uuid not null references public.search_runs(id) on delete cascade,
  provider_name text not null,
  request_summary jsonb not null default '{}',
  response_summary jsonb not null default '{}',
  status text not null,
  created_at timestamptz not null default now()
);

create index idx_provider_logs_run on public.provider_logs(search_run_id);

alter table public.provider_logs enable row level security;

create policy "Users manage own provider logs"
  on public.provider_logs for all using (auth.uid() = user_id);

-- ============================================================
-- Updated-at trigger helper
-- ============================================================
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

create trigger set_pinterest_accounts_updated_at
  before update on public.pinterest_accounts
  for each row execute function public.update_updated_at();

create trigger set_boards_updated_at
  before update on public.pinterest_boards
  for each row execute function public.update_updated_at();

create trigger set_pins_updated_at
  before update on public.pinterest_pins
  for each row execute function public.update_updated_at();

create trigger set_prefs_updated_at
  before update on public.user_preferences
  for each row execute function public.update_updated_at();
