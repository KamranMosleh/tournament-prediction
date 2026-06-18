import { notFound, redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { LeagueHub } from '@/components/layout/LeagueHub'
import type { League, Player, Match, MatchPrediction, TournamentPrediction, MatchdaySummary, MatchRecap } from '@/types'

interface Props { params: Promise<{ code: string }> }

export default async function LeaguePage({ params }: Props) {
  const { code: rawCode } = await params
  const code = rawCode.toUpperCase()
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()

  if (!user) {
    redirect(`/auth/sign-in?next=${encodeURIComponent(`/league/${code}`)}`)
  }

  const supabase = createServiceClient()

  // 1. League
  const { data: league } = await supabase
    .from('leagues')
    .select('*')
    .eq('invite_code', code)
    .single()

  if (!league) notFound()

  // 2. Players (fetch once, reuse IDs)
  const { data: players } = await supabase
    .from('players')
    .select('id, league_id, user_id, display_name, is_admin, joined_at, joined_match_day')
    .eq('league_id', league.id)
    .order('joined_at')

  const accountPlayers = (players ?? []) as Player[]
  const playerIds = accountPlayers.map(player => player.id)
  const currentPlayer = accountPlayers.find(player => player.user_id === user.id) ?? null
  const safePlayers = accountPlayers.map(player => ({ ...player, user_id: null }))

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
      currentPlayer={currentPlayer}
      players={safePlayers}
      matches={(matches ?? []) as Match[]}
      predictions={(predictions ?? []) as MatchPrediction[]}
      tournamentPredictions={(tournamentPredictions ?? []) as TournamentPrediction[]}
      summaries={(summaries ?? []) as MatchdaySummary[]}
      recaps={(recaps ?? []) as MatchRecap[]}
    />
  )
}
