-- Deploy the account-first application before running this migration.

begin;

alter table public.leagues
  add column if not exists archived_at timestamptz;

alter table public.leagues
  add column if not exists archived_by_user_id uuid
  references auth.users(id) on delete set null;

create index if not exists idx_leagues_archived_at
  on public.leagues(archived_at);

alter table public.leagues enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.match_predictions enable row level security;
alter table public.tournament_predictions enable row level security;
alter table public.matchday_summaries enable row level security;
alter table public.match_recaps enable row level security;
alter table public.sync_log enable row level security;

drop policy if exists "leagues_read" on public.leagues;
drop policy if exists "matches_read" on public.matches;
drop policy if exists "players_read" on public.players;
drop policy if exists "preds_read" on public.match_predictions;
drop policy if exists "tourney_read" on public.tournament_predictions;
drop policy if exists "sync_read" on public.sync_log;
drop policy if exists "summaries_read" on public.matchday_summaries;
drop policy if exists "recaps_read" on public.match_recaps;

create policy "leagues_read" on public.leagues
  for select to authenticated using (true);
create policy "matches_read" on public.matches
  for select to authenticated using (true);
create policy "players_read" on public.players
  for select to authenticated using (true);
create policy "preds_read" on public.match_predictions
  for select to authenticated using (true);
create policy "tourney_read" on public.tournament_predictions
  for select to authenticated using (true);
create policy "sync_read" on public.sync_log
  for select to authenticated using (true);
create policy "summaries_read" on public.matchday_summaries
  for select to authenticated using (true);
create policy "recaps_read" on public.match_recaps
  for select to authenticated using (true);

drop policy if exists "leagues_write" on public.leagues;
drop policy if exists "players_write" on public.players;
drop policy if exists "players_update" on public.players;
drop policy if exists "preds_insert" on public.match_predictions;
drop policy if exists "preds_update" on public.match_predictions;
drop policy if exists "tourney_insert" on public.tournament_predictions;
drop policy if exists "tourney_update" on public.tournament_predictions;
drop policy if exists "matches_insert" on public.matches;
drop policy if exists "matches_update" on public.matches;
drop policy if exists "sync_insert" on public.sync_log;
drop policy if exists "summaries_insert" on public.matchday_summaries;
drop policy if exists "recaps_insert" on public.match_recaps;

revoke all on public.leagues, public.players, public.matches,
  public.match_predictions, public.tournament_predictions,
  public.matchday_summaries, public.match_recaps, public.sync_log
  from anon;

revoke insert, update, delete on public.leagues, public.players, public.matches,
  public.match_predictions, public.tournament_predictions,
  public.matchday_summaries, public.match_recaps, public.sync_log
  from authenticated;

grant select on public.leagues, public.matches, public.match_predictions,
  public.tournament_predictions, public.matchday_summaries,
  public.match_recaps, public.sync_log
  to authenticated;

revoke select on public.players from authenticated;
grant select (
  id, league_id, display_name, is_admin, joined_at, joined_match_day
) on public.players to authenticated;

do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'players'
  ) then
    alter publication supabase_realtime drop table public.players;
  end if;
end $$;

commit;
