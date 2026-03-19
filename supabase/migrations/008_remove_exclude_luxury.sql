-- Remove exclude_luxury column from user_preferences
-- This preference is no longer used as affordability is assumed via budget constraints

alter table public.user_preferences drop column if exists exclude_luxury;
