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
          WHEN (mp.home_score - mp.away_score) = (m.home_score - m.away_score) THEN 2
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
      WHEN (mp.home_score - mp.away_score) = (m.home_score - m.away_score) THEN 2
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
          WHEN (mp.home_score - mp.away_score) = (m.home_score - m.away_score) THEN 2
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
