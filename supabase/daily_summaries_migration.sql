CREATE TABLE IF NOT EXISTS daily_summaries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id     UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  summary_date  DATE NOT NULL,
  summary_text  TEXT NOT NULL,
  generated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (league_id, summary_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_summaries
  ON daily_summaries(league_id, summary_date);

ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_summaries_read" ON daily_summaries;
CREATE POLICY "daily_summaries_read" ON daily_summaries
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "daily_summaries_insert" ON daily_summaries;

REVOKE ALL ON daily_summaries FROM anon;
REVOKE INSERT, UPDATE, DELETE ON daily_summaries FROM authenticated;
GRANT SELECT ON daily_summaries TO authenticated;
