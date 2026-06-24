ALTER TABLE daily_summaries
  ADD COLUMN IF NOT EXISTS coverage_key TEXT,
  ADD COLUMN IF NOT EXISTS coverage_label TEXT,
  ADD COLUMN IF NOT EXISTS covered_match_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS coverage_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS match_count INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_summaries_coverage_key
  ON daily_summaries(league_id, coverage_key)
  WHERE coverage_key IS NOT NULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE daily_summaries;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
