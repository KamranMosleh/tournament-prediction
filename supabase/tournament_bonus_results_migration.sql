-- Run once in the Supabase SQL Editor for existing installations.
-- Fresh installations receive these columns from schema.sql.

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS result_winner_team TEXT;

ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS official_top_scorer_name TEXT;
