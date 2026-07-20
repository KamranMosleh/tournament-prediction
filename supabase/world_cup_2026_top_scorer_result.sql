-- Record the official Golden Boot result for every FIFA World Cup 2026 league.
-- Run once in the Supabase SQL Editor after deploying the matching scoring code.

UPDATE public.leagues
SET official_top_scorer_name = 'Kylian Mbappe'
WHERE tournament_code = 'WC'
  AND tournament_season = 2026
  AND official_top_scorer_name IS DISTINCT FROM 'Kylian Mbappe';
