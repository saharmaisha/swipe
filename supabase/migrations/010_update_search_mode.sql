ALTER TABLE search_runs DROP CONSTRAINT IF EXISTS search_runs_mode_check;
ALTER TABLE search_runs ADD CONSTRAINT search_runs_mode_check
  CHECK (mode IN ('exact', 'vibe', 'both', 'similar'));
