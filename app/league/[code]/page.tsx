import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LeagueHub } from '@/components/layout/LeagueHub'
import type { League, Player, Match, MatchPrediction, TournamentPrediction, MatchdaySummary, MatchRecap } from '@/types'

interface Props { params: Promise<{ code: string }> }

export default async function LeaguePage({ params }: Props) {
  const { code } = await params
  const supabase = await createClient()

  // 1. League
  const { data: league } = await supabase
    .from('leagues')
    .select('*')
    .eq('invite_code', code.toUpperCase())
    .single()

  if (!league) notFound()

  // 2. Players (fetch once, reuse IDs)
  const { data: players } = await supabase
    .from('players')
    .select('*')
    .eq('league_id', league.id)
    .order('joined_at')

  const playerIds = (players ?? []).map((p: { id: string }) => p.id)

  // 3. Everything else in parallel — predictions uses player IDs from step 2
  const [
    { data: matches },
    { data: predictions },
    { data: tournamentPredictions },
    { data: summaries },
    { data: recaps },
  ] = await Promise.all([
    supabase
      .from('matches')
      .select('*')
      .eq('tournament_code', league.tournament_code)
      .eq('tournament_season', league.tournament_season)
      .order('kickoff_time'),
    playerIds.length > 0
      ? supabase.from('match_predictions').select('*').in('player_id', playerIds)
      : Promise.resolve({ data: [] }),
    supabase.from('tournament_predictions').select('*').eq('league_id', league.id),
    supabase.from('matchday_summaries').select('*').eq('league_id', league.id).order('match_day'),
    supabase.from('match_recaps').select('*').eq('league_id', league.id),
  ])

  return (
    <LeagueHub
      league={league as League}
      players={(players ?? []) as Player[]}
      matches={(matches ?? []) as Match[]}
      predictions={(predictions ?? []) as MatchPrediction[]}
      tournamentPredictions={(tournamentPredictions ?? []) as TournamentPrediction[]}
      summaries={(summaries ?? []) as MatchdaySummary[]}
      recaps={(recaps ?? []) as MatchRecap[]}
    />
  )
}
