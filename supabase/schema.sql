-- ============================================================
-- Tournament Predictor — Supabase Schema
-- Run in SQL Editor on a fresh project.
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS leagues (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL CHECK (char_length(name) BETWEEN 3 AND 40),
  invite_code       TEXT NOT NULL UNIQUE,
  tournament        TEXT NOT NULL DEFAULT 'FIFA World Cup 2026',
  tournament_code   TEXT NOT NULL DEFAULT 'WC',
  tournament_season INTEGER NOT NULL DEFAULT 2026,
  created_by        UUID,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sync_source       TEXT NOT NULL DEFAULT 'api'
                      CHECK (sync_source IN ('api', 'manual')),
  scoring_mode      TEXT NOT NULL DEFAULT 'multiplied'
                      CHECK (scoring_mode IN ('multiplied', 'flat')),
  -- Optional Telegram group invite link set by admin
  telegram_url      TEXT,
  official_top_scorer_name TEXT,
  archived_at       TIMESTAMPTZ,
  archived_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS players (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id         UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name      TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 20),
  -- Compatibility only. Application identity is exclusively auth.users.
  session_token     UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  is_admin          BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at         TIMESTAMPTZ DEFAULT NOW(),
  joined_match_day  INTEGER,
  UNIQUE (league_id, display_name)
);

CREATE TABLE IF NOT EXISTS profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Existing projects: safe compatibility columns for account-backed memberships.
ALTER TABLE leagues
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE leagues
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE leagues
  ADD COLUMN IF NOT EXISTS archived_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE leagues
  ADD COLUMN IF NOT EXISTS official_top_scorer_name TEXT;

DO $$ 
BEGIN
  ALTER TABLE leagues
    ADD CONSTRAINT leagues_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES players(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS matches (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_code   TEXT NOT NULL DEFAULT 'WC',
  tournament_season INTEGER NOT NULL DEFAULT 2026,
  external_match_id INTEGER UNIQUE,
  stage             TEXT NOT NULL CHECK (stage IN (
                      'group','round_of_16','quarter_final',
                      'semi_final','third_place','final'
                    )),
  group_name        TEXT,
  home_team         TEXT NOT NULL DEFAULT 'TBD',
  away_team         TEXT NOT NULL DEFAULT 'TBD',
  kickoff_time      TIMESTAMPTZ NOT NULL,
  status            TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','locked','finished')),
  home_score        INTEGER CHECK (home_score >= 0),
  away_score        INTEGER CHECK (away_score >= 0),
  result_winner_team TEXT,
  match_day         INTEGER,
  venue             TEXT,
  last_synced_at    TIMESTAMPTZ,
  -- AI-generated content (cached, generated once per match)
  ai_insight        TEXT,
  ai_insight_generated_at TIMESTAMPTZ,
  ai_difficulty     TEXT CHECK (ai_difficulty IN ('Easy', 'Tricky', 'Unpredictable')),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS result_winner_team TEXT;

CREATE TABLE IF NOT EXISTS match_predictions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id    UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  match_id     UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  home_score   INTEGER NOT NULL CHECK (home_score >= 0 AND home_score <= 20),
  away_score   INTEGER NOT NULL CHECK (away_score >= 0 AND away_score <= 20),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (player_id, match_id)
);

CREATE TABLE IF NOT EXISTS tournament_predictions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id        UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  league_id        UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  winner_team      TEXT NOT NULL DEFAULT '',
  top_scorer_name  TEXT NOT NULL DEFAULT '',
  submitted_at     TIMESTAMPTZ DEFAULT NOW(),
  winner_submitted_at TIMESTAMPTZ,
  top_scorer_submitted_at TIMESTAMPTZ,
  UNIQUE (player_id, league_id)
);

-- Existing projects: safe compatibility migration for per-pick deadlines/weights
ALTER TABLE tournament_predictions
  ADD COLUMN IF NOT EXISTS winner_submitted_at TIMESTAMPTZ;

ALTER TABLE tournament_predictions
  ADD COLUMN IF NOT EXISTS top_scorer_submitted_at TIMESTAMPTZ;

ALTER TABLE tournament_predictions
  ALTER COLUMN winner_team SET DEFAULT '';

ALTER TABLE tournament_predictions
  ALTER COLUMN top_scorer_name SET DEFAULT '';

CREATE TABLE IF NOT EXISTS sync_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_code   TEXT NOT NULL,
  tournament_season INTEGER NOT NULL,
  synced_at         TIMESTAMPTZ DEFAULT NOW(),
  matches_updated   INTEGER DEFAULT 0,
  matches_locked    INTEGER DEFAULT 0,
  matches_finished  INTEGER DEFAULT 0,
  error             TEXT,
  duration_ms       INTEGER
);

CREATE TABLE IF NOT EXISTS matchday_summaries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id     UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  match_day     INTEGER NOT NULL,
  summary_text  TEXT NOT NULL,
  generated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (league_id, match_day)
);

CREATE TABLE IF NOT EXISTS match_recaps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id     UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  match_id      UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  headline      TEXT NOT NULL,
  roasts        JSONB NOT NULL DEFAULT '[]',
  generated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (league_id, match_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_players_league       ON players(league_id);
CREATE INDEX IF NOT EXISTS idx_players_token        ON players(session_token);
CREATE INDEX IF NOT EXISTS idx_players_user         ON players(user_id);
CREATE INDEX IF NOT EXISTS idx_leagues_archived_at  ON leagues(archived_at);
CREATE INDEX IF NOT EXISTS idx_predictions_player   ON match_predictions(player_id);
CREATE INDEX IF NOT EXISTS idx_predictions_match    ON match_predictions(match_id);
CREATE INDEX IF NOT EXISTS idx_matches_tournament   ON matches(tournament_code, tournament_season);
CREATE INDEX IF NOT EXISTS idx_matches_status       ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_kickoff      ON matches(kickoff_time);
CREATE INDEX IF NOT EXISTS idx_matches_external_id  ON matches(external_match_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_tournament  ON sync_log(tournament_code, synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_matchday_summaries   ON matchday_summaries(league_id, match_day);
CREATE INDEX IF NOT EXISTS idx_match_recaps         ON match_recaps(league_id, match_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_players_league_display_name_ci
  ON players(league_id, lower(btrim(display_name)));

CREATE UNIQUE INDEX IF NOT EXISTS idx_players_league_user
  ON players(league_id, user_id)
  WHERE user_id IS NOT NULL;

-- ============================================================
-- SCORING VIEW (multiplied + flat, late-joiner form %)
-- ============================================================

CREATE OR REPLACE VIEW v_match_scores AS
SELECT
  p.id               AS player_id,
  p.league_id,
  p.display_name,
  p.joined_match_day,
  COUNT(mp.id)        AS predictions_submitted,
  -- Multiplied scoring (default)
  SUM(
    CASE
      WHEN m.status <> 'finished' OR mp.id IS NULL THEN 0
      ELSE
        CASE m.stage
          WHEN 'group'         THEN 1
          WHEN 'round_of_16'   THEN 2
          WHEN 'quarter_final' THEN 3
          WHEN 'semi_final'    THEN 4
          WHEN 'third_place'   THEN 4
          WHEN 'final'         THEN 5
          ELSE 1
        END *
        CASE
          WHEN mp.home_score = m.home_score AND mp.away_score = m.away_score THEN 3
          WHEN SIGN(mp.home_score - mp.away_score) = SIGN(m.home_score - m.away_score) THEN 1
          ELSE 0
        END
    END
  ) AS match_points,
  -- Flat scoring (always computed for leagues using scoring_mode='flat')
  SUM(
    CASE
      WHEN m.status <> 'finished' OR mp.id IS NULL THEN 0
      WHEN mp.home_score = m.home_score AND mp.away_score = m.away_score THEN 3
      WHEN SIGN(mp.home_score - mp.away_score) = SIGN(m.home_score - m.away_score) THEN 1
      ELSE 0
    END
  ) AS match_points_flat,
  -- Exact score count (tie-break)
  SUM(
    CASE
      WHEN m.status = 'finished' AND mp.home_score = m.home_score
       AND mp.away_score = m.away_score THEN 1
      ELSE 0
    END
  ) AS exact_scores,
  -- Form points (only matches since the player joined)
  SUM(
    CASE
      WHEN m.status <> 'finished' OR mp.id IS NULL THEN 0
      WHEN p.joined_match_day IS NOT NULL AND m.match_day < p.joined_match_day THEN 0
      ELSE
        CASE m.stage
          WHEN 'group' THEN 1 WHEN 'round_of_16' THEN 2
          WHEN 'quarter_final' THEN 3 WHEN 'semi_final' THEN 4
          WHEN 'third_place' THEN 4 WHEN 'final' THEN 5 ELSE 1
        END *
        CASE
          WHEN mp.home_score = m.home_score AND mp.away_score = m.away_score THEN 3
          WHEN SIGN(mp.home_score - mp.away_score) = SIGN(m.home_score - m.away_score) THEN 1
          ELSE 0
        END
    END
  ) AS form_points,
  -- Max possible form points (denominator for form %)
  SUM(
    CASE
      WHEN m.status <> 'finished' THEN 0
      WHEN p.joined_match_day IS NOT NULL AND m.match_day < p.joined_match_day THEN 0
      ELSE
        CASE m.stage
          WHEN 'group' THEN 3 WHEN 'round_of_16' THEN 6
          WHEN 'quarter_final' THEN 9 WHEN 'semi_final' THEN 12
          WHEN 'third_place' THEN 12 WHEN 'final' THEN 15 ELSE 3
        END
    END
  ) AS form_max_points
FROM players p
LEFT JOIN match_predictions mp ON mp.player_id = p.id
LEFT JOIN matches m ON m.id = mp.match_id
  AND m.tournament_code = (SELECT tournament_code FROM leagues WHERE id = p.league_id)
  AND m.tournament_season = (SELECT tournament_season FROM leagues WHERE id = p.league_id)
GROUP BY p.id, p.league_id, p.display_name, p.joined_match_day;

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================

ALTER TABLE leagues                ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE players                ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches                ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_predictions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log               ENABLE ROW LEVEL SECURITY;

-- Account profiles remain self-managed.
DO $$ BEGIN
  CREATE POLICY "profiles_self_read" ON profiles FOR SELECT USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "profiles_self_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "profiles_self_update" ON profiles FOR UPDATE USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE matchday_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_recaps ENABLE ROW LEVEL SECURITY;

-- Gameplay data is readable only after Supabase Auth. All writes go through
-- server API routes using the service role client.
DROP POLICY IF EXISTS "leagues_read" ON leagues;
DROP POLICY IF EXISTS "matches_read" ON matches;
DROP POLICY IF EXISTS "players_read" ON players;
DROP POLICY IF EXISTS "preds_read" ON match_predictions;
DROP POLICY IF EXISTS "tourney_read" ON tournament_predictions;
DROP POLICY IF EXISTS "sync_read" ON sync_log;
DROP POLICY IF EXISTS "summaries_read" ON matchday_summaries;
DROP POLICY IF EXISTS "recaps_read" ON match_recaps;

CREATE POLICY "leagues_read" ON leagues
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "matches_read" ON matches
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "players_read" ON players
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "preds_read" ON match_predictions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "tourney_read" ON tournament_predictions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "sync_read" ON sync_log
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "summaries_read" ON matchday_summaries
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "recaps_read" ON match_recaps
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "leagues_write" ON leagues;
DROP POLICY IF EXISTS "players_write" ON players;
DROP POLICY IF EXISTS "players_update" ON players;
DROP POLICY IF EXISTS "preds_insert" ON match_predictions;
DROP POLICY IF EXISTS "preds_update" ON match_predictions;
DROP POLICY IF EXISTS "tourney_insert" ON tournament_predictions;
DROP POLICY IF EXISTS "tourney_update" ON tournament_predictions;
DROP POLICY IF EXISTS "matches_insert" ON matches;
DROP POLICY IF EXISTS "matches_update" ON matches;
DROP POLICY IF EXISTS "sync_insert" ON sync_log;
DROP POLICY IF EXISTS "summaries_insert" ON matchday_summaries;
DROP POLICY IF EXISTS "recaps_insert" ON match_recaps;

REVOKE ALL ON leagues, players, matches, match_predictions,
  tournament_predictions, matchday_summaries, match_recaps, sync_log
  FROM anon;

REVOKE INSERT, UPDATE, DELETE ON leagues, players, matches, match_predictions,
  tournament_predictions, matchday_summaries, match_recaps, sync_log
  FROM authenticated;

GRANT SELECT ON leagues, matches, match_predictions, tournament_predictions,
  matchday_summaries, match_recaps, sync_log
  TO authenticated;

REVOKE SELECT ON players FROM authenticated;
GRANT SELECT (
  id, league_id, display_name, is_admin, joined_at, joined_match_day
) ON players TO authenticated;

-- ============================================================
-- CRON: lock matches at kick-off (runs every minute)
-- ============================================================

DO $$ BEGIN
  PERFORM cron.schedule(
    'lock-started-matches',
    '* * * * *',
    $sql$
      UPDATE matches
      SET status = 'locked'
      WHERE status = 'open' AND kickoff_time <= NOW();
    $sql$
  );
EXCEPTION WHEN others THEN NULL;
END $$;

-- ============================================================
-- REALTIME
-- ============================================================

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE match_predictions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE matches;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE tournament_predictions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE matchday_summaries;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
