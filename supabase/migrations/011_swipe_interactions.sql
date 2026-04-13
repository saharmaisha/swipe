-- Swipe Interactions for Weight Optimization
-- Tracks save/skip actions with feature vectors for training ranking weights

create table public.swipe_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_result_id uuid not null references public.product_results(id) on delete cascade,
  search_run_id uuid not null references public.search_runs(id) on delete cascade,
  action text not null check (action in ('save', 'skip')),
  -- Feature vectors at interaction time for gradient descent training
  product_features jsonb not null default '[]',
  preference_features jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index idx_swipe_interactions_user on public.swipe_interactions(user_id);
create index idx_swipe_interactions_search_run on public.swipe_interactions(search_run_id);
create index idx_swipe_interactions_created_at on public.swipe_interactions(created_at desc);
create index idx_swipe_interactions_action on public.swipe_interactions(action);

alter table public.swipe_interactions enable row level security;

create policy "Users manage own swipe interactions"
  on public.swipe_interactions for all using (auth.uid() = user_id);

-- Add learned_weights column to user_preferences for storing optimized weights
alter table public.user_preferences
  add column if not exists learned_weights jsonb default null,
  add column if not exists weights_updated_at timestamptz default null;
