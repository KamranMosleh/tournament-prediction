CREATE TABLE IF NOT EXISTS daily_summaries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id     UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  summary_date  DATE NOT NULL,
  coverage_key  TEXT,
  coverage_label TEXT,
  covered_match_ids UUID[] NOT NULL DEFAULT '{}',
  coverage_fingerprint TEXT,
  match_count INTEGER NOT NULL DEFAULT 0,
  summary_text  TEXT NOT NULL,
  generated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (league_id, summary_date)
);

ALTER TABLE daily_summaries
  ADD COLUMN IF NOT EXISTS coverage_key TEXT,
  ADD COLUMN IF NOT EXISTS coverage_label TEXT,
  ADD COLUMN IF NOT EXISTS covered_match_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS coverage_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS match_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_daily_summaries
  ON daily_summaries(league_id, summary_date);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_summaries_coverage_key
  ON daily_summaries(league_id, coverage_key)
  WHERE coverage_key IS NOT NULL;

ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_summaries_read" ON daily_summaries;
CREATE POLICY "daily_summaries_read" ON daily_summaries
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "daily_summaries_insert" ON daily_summaries;

REVOKE ALL ON daily_summaries FROM anon;
REVOKE INSERT, UPDATE, DELETE ON daily_summaries FROM authenticated;
GRANT SELECT ON daily_summaries TO authenticated;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE daily_summaries;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
