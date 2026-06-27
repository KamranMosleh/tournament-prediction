-- Add World Cup 2026 Round of 32 stage support.

ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_stage_check;

ALTER TABLE public.matches
  ADD CONSTRAINT matches_stage_check
  CHECK (stage IN (
    'group',
    'round_of_32',
    'round_of_16',
    'quarter_final',
    'semi_final',
    'third_place',
    'final'
  ));

-- Correct already-synced football-data.org LAST_32 fixtures for WC 2026.
UPDATE public.matches
SET stage = 'round_of_32'
WHERE tournament_code = 'WC'
  AND tournament_season = 2026
  AND external_match_id IN (
    537415, 537416, 537417, 537418,
    537419, 537420, 537421, 537422,
    537423, 537424, 537425, 537426,
    537427, 537428, 537429, 537430
  );

CREATE OR REPLACE VIEW public.v_match_scores AS
SELECT
  p.id               AS player_id,
  p.league_id,
  p.display_name,
  p.joined_match_day,
  COUNT(mp.id)        AS predictions_submitted,
  -- Multiplied scoring (default), including a fixed +2 shootout bonus.
  SUM(
    CASE
      WHEN m.status <> 'finished' OR mp.id IS NULL THEN 0
      ELSE
        CASE m.stage
          WHEN 'group'         THEN 1
          WHEN 'round_of_32'   THEN 2
          WHEN 'round_of_16'   THEN 2
          WHEN 'quarter_final' THEN 3
          WHEN 'semi_final'    THEN 4
          WHEN 'third_place'   THEN 4
          WHEN 'final'         THEN 5
          ELSE 1
        END *
        CASE
          WHEN mp.home_score = m.home_score AND mp.away_score = m.away_score THEN 3
          WHEN (mp.home_score - mp.away_score) = (m.home_score - m.away_score) THEN 2
          WHEN SIGN(mp.home_score - mp.away_score) = SIGN(m.home_score - m.away_score) THEN 1
          ELSE 0
        END
        +
        CASE
          WHEN m.stage <> 'group'
           AND m.went_to_penalties IS TRUE
           AND mp.home_score = mp.away_score
           AND mp.penalty_winner_team = m.result_winner_team THEN 2
          ELSE 0
        END
    END
  ) AS match_points,
  -- Flat scoring, including a fixed +1 shootout bonus.
  SUM(
    CASE
      WHEN m.status <> 'finished' OR mp.id IS NULL THEN 0
      ELSE
        CASE
          WHEN mp.home_score = m.home_score AND mp.away_score = m.away_score THEN 3
          WHEN (mp.home_score - mp.away_score) = (m.home_score - m.away_score) THEN 2
          WHEN SIGN(mp.home_score - mp.away_score) = SIGN(m.home_score - m.away_score) THEN 1
          ELSE 0
        END
        +
        CASE
          WHEN m.stage <> 'group'
           AND m.went_to_penalties IS TRUE
           AND mp.home_score = mp.away_score
           AND mp.penalty_winner_team = m.result_winner_team THEN 1
          ELSE 0
        END
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
          WHEN 'group' THEN 1 WHEN 'round_of_32' THEN 2 WHEN 'round_of_16' THEN 2
          WHEN 'quarter_final' THEN 3 WHEN 'semi_final' THEN 4
          WHEN 'third_place' THEN 4 WHEN 'final' THEN 5 ELSE 1
        END *
        CASE
          WHEN mp.home_score = m.home_score AND mp.away_score = m.away_score THEN 3
          WHEN (mp.home_score - mp.away_score) = (m.home_score - m.away_score) THEN 2
          WHEN SIGN(mp.home_score - mp.away_score) = SIGN(m.home_score - m.away_score) THEN 1
          ELSE 0
        END
        +
        CASE
          WHEN m.stage <> 'group'
           AND m.went_to_penalties IS TRUE
           AND mp.home_score = mp.away_score
           AND mp.penalty_winner_team = m.result_winner_team THEN 2
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
          WHEN 'group' THEN 3 WHEN 'round_of_32' THEN 6 WHEN 'round_of_16' THEN 6
          WHEN 'quarter_final' THEN 9 WHEN 'semi_final' THEN 12
          WHEN 'third_place' THEN 12 WHEN 'final' THEN 15 ELSE 3
        END
        +
        CASE
          WHEN m.stage <> 'group' AND m.went_to_penalties IS TRUE THEN 2
          ELSE 0
        END
    END
  ) AS form_max_points
FROM public.players p
LEFT JOIN public.match_predictions mp ON mp.player_id = p.id
LEFT JOIN public.matches m ON m.id = mp.match_id
  AND m.tournament_code = (SELECT tournament_code FROM public.leagues WHERE id = p.league_id)
  AND m.tournament_season = (SELECT tournament_season FROM public.leagues WHERE id = p.league_id)
GROUP BY p.id, p.league_id, p.display_name, p.joined_match_day;
