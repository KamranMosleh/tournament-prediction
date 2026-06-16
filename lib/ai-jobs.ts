import { createServiceClient } from '@/lib/supabase/server'
import { groqComplete, punditsPrompt } from '@/lib/groq'
import { computeLeaderboard, sortLeaderboard } from '@/lib/scoring'
import type {
  League,
  Match,
  MatchPrediction,
  Player,
  TournamentPrediction,
} from '@/types'

type ServiceClient = ReturnType<typeof createServiceClient>

export type SummaryGenerationResult = {
  status: 'created' | 'skipped' | 'error'
  reason?: string
}

async function isMatchDayComplete(
  supabase: ServiceClient,
  tournamentCode: string,
  tournamentSeason: number,
  matchDay: number
): Promise<boolean> {
  const { data: dayMatches } = await supabase
    .from('matches')
    .select('id, status')
    .eq('tournament_code', tournamentCode)
    .eq('tournament_season', tournamentSeason)
    .eq('match_day', matchDay)

  if (!dayMatches?.length) return false
  return dayMatches.every((m: { status: string }) => m.status === 'finished')
}

export async function generatePunditSummaryForMatchDay(
  leagueId: string,
  matchDay: number,
  supabaseArg?: ServiceClient
): Promise<SummaryGenerationResult> {
  if (!process.env.GROQ_API_KEY) {
    return { status: 'skipped', reason: 'GROQ_API_KEY not set' }
  }

  const supabase = supabaseArg ?? createServiceClient()

  const { data: existing } = await supabase
    .from('matchday_summaries')
    .select('id')
    .eq('league_id', leagueId)
    .eq('match_day', matchDay)
    .single()

  if (existing) return { status: 'skipped', reason: 'already exists' }

  const { data: league } = await supabase
    .from('leagues')
    .select('*')
    .eq('id', leagueId)
    .single()

  if (!league) return { status: 'error', reason: 'League not found' }

  const isComplete = await isMatchDayComplete(
    supabase,
    league.tournament_code,
    league.tournament_season,
    matchDay
  )

  if (!isComplete) {
    return { status: 'skipped', reason: 'matchday not fully finished' }
  }

  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .eq('tournament_code', league.tournament_code)
    .eq('tournament_season', league.tournament_season)
    .eq('match_day', matchDay)
    .eq('status', 'finished')

  if (!matches?.length) {
    return { status: 'skipped', reason: 'no finished matches' }
  }

  const { data: players } = await supabase
    .from('players')
    .select('*')
    .eq('league_id', leagueId)

  const playerIds = (players ?? []).map((p: Player) => p.id)
  const { data: predictions } = playerIds.length > 0
    ? await supabase.from('match_predictions').select('*').in('player_id', playerIds)
    : { data: [] }

  const { data: tournamentPreds } = await supabase
    .from('tournament_predictions')
    .select('*')
    .eq('league_id', leagueId)

  const results = (matches as Match[])
    .map(m => `${m.home_team} ${m.home_score}–${m.away_score} ${m.away_team}`)
    .join(', ')

  const scores = sortLeaderboard(computeLeaderboard({
    players: (players ?? []) as Player[],
    predictions: (predictions ?? []) as MatchPrediction[],
    matches: matches as Match[],
    tournamentPredictions: (tournamentPreds ?? []) as TournamentPrediction[],
    scoringMode: (league as League).scoring_mode,
  }))

  const leaderboardStr = scores
    .slice(0, 5)
    .map((s, i) => `${i + 1}. ${s.display_name} ${s.total_points}pts`)
    .join(', ')

  const summary = await groqComplete(punditsPrompt(matchDay, results, leaderboardStr), 250)
  if (!summary) return { status: 'error', reason: 'Groq returned null' }

  const { error: insertError } = await supabase
    .from('matchday_summaries')
    .insert({ league_id: leagueId, match_day: matchDay, summary_text: summary })

  if (insertError) {
    // Unique violation can happen when concurrent jobs race for the same matchday.
    if (insertError.code === '23505') {
      return { status: 'skipped', reason: 'already exists' }
    }
    return { status: 'error', reason: insertError.message }
  }

  return { status: 'created' }
}

export async function autoGeneratePunditSummariesForLeagueMatchDay(
  leagueId: string,
  matchDay: number,
  supabaseArg?: ServiceClient
): Promise<SummaryGenerationResult> {
  return generatePunditSummaryForMatchDay(leagueId, matchDay, supabaseArg)
}

export async function autoGeneratePunditSummariesForTournament(
  tournamentCode: string,
  tournamentSeason: number,
  supabaseArg?: ServiceClient
): Promise<{ created: number; skipped: number; errors: number }> {
  const supabase = supabaseArg ?? createServiceClient()

  const { data: leagues } = await supabase
    .from('leagues')
    .select('id')
    .eq('tournament_code', tournamentCode)
    .eq('tournament_season', tournamentSeason)

  if (!leagues?.length) return { created: 0, skipped: 0, errors: 0 }

  const { data: allMatches } = await supabase
    .from('matches')
    .select('match_day, status')
    .eq('tournament_code', tournamentCode)
    .eq('tournament_season', tournamentSeason)
    .not('match_day', 'is', null)

  if (!allMatches?.length) return { created: 0, skipped: 0, errors: 0 }

  const dayStats = new Map<number, { total: number; finished: number }>()
  for (const row of allMatches as Array<{ match_day: number; status: string }>) {
    const stat = dayStats.get(row.match_day) ?? { total: 0, finished: 0 }
    stat.total += 1
    if (row.status === 'finished') stat.finished += 1
    dayStats.set(row.match_day, stat)
  }

  const completeDays = [...dayStats.entries()]
    .filter(([, stat]) => stat.total > 0 && stat.finished === stat.total)
    .map(([day]) => day)
    .sort((a, b) => a - b)

  if (!completeDays.length) return { created: 0, skipped: 0, errors: 0 }

  let created = 0
  let skipped = 0
  let errors = 0

  for (const league of leagues as Array<{ id: string }>) {
    for (const day of completeDays) {
      const res = await generatePunditSummaryForMatchDay(league.id, day, supabase)
      if (res.status === 'created') created++
      else if (res.status === 'skipped') skipped++
      else errors++
    }
  }

  return { created, skipped, errors }
}