import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getVerifiedPlayer } from '@/lib/auth'
import {
  autoGeneratePunditSummariesForLeagueMatchDay,
  generateLatestDailyPunditSummaryForLeague,
  autoGenerateMatchRecapsForMatch,
  enrichOpenMatchesForTournament,
} from '@/lib/ai-jobs'

export async function POST(req: NextRequest) {
  try {
    const { match_id, league_id, home_score, away_score, shootout_winner_team } = await req.json()
    const homeScore = Number(home_score)
    const awayScore = Number(away_score)

    if (!match_id || !league_id || home_score === undefined || away_score === undefined) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    if (
      !Number.isInteger(homeScore) ||
      !Number.isInteger(awayScore) ||
      homeScore < 0 ||
      awayScore < 0 ||
      homeScore > 30 ||
      awayScore > 30
    ) {
      return NextResponse.json({ error: 'Invalid scores' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data: match } = await supabase.from('matches').select('*').eq('id', match_id).single()
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    if (match.status === 'open') {
      return NextResponse.json({ error: 'Match has not started yet' }, { status: 409 })
    }

    const verified = await getVerifiedPlayer(supabase, { leagueId: league_id, requireAdmin: true })
    if (!verified) {
      return NextResponse.json({ error: 'Forbidden - admins only' }, { status: 403 })
    }

    const player = verified.player
    const { data: league } = await supabase
      .from('leagues')
      .select('tournament_code, tournament_season, sync_source, archived_at')
      .eq('id', player.league_id)
      .single()

    if (
      !league ||
      league.tournament_code !== match.tournament_code ||
      league.tournament_season !== match.tournament_season
    ) {
      return NextResponse.json({ error: 'Forbidden - match is outside this league tournament' }, { status: 403 })
    }
    if (league.archived_at) {
      return NextResponse.json({ error: 'This league is archived and read-only' }, { status: 409 })
    }
    if (league.sync_source !== 'manual') {
      return NextResponse.json({ error: 'Match results are managed by automatic sync' }, { status: 409 })
    }

    const penaltyEligible = match.stage !== 'group'
    const wentToPenalties = penaltyEligible && homeScore === awayScore
    let resultWinnerTeam: string | null = null

    if (penaltyEligible) {
      if (homeScore > awayScore) {
        resultWinnerTeam = match.home_team
      } else if (awayScore > homeScore) {
        resultWinnerTeam = match.away_team
      } else if (shootout_winner_team === match.home_team || shootout_winner_team === match.away_team) {
        resultWinnerTeam = shootout_winner_team
      } else {
        return NextResponse.json(
          { error: 'Select the penalty shootout winner for this tied knockout match' },
          { status: 400 }
        )
      }
    }

    const { data, error } = await supabase
      .from('matches')
      .update({
        home_score: homeScore,
        away_score: awayScore,
        status: 'finished',
        result_winner_team: resultWinnerTeam,
        went_to_penalties: wentToPenalties,
      })
      .eq('id', match_id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'Failed to save result' }, { status: 500 })

    const [aiSummary, aiDailySummary, aiRecap, aiEnrichment] = await Promise.all([
      match.match_day
        ? autoGeneratePunditSummariesForLeagueMatchDay(player.league_id, match.match_day, supabase)
        : Promise.resolve({ status: 'skipped' as const, reason: 'match day unavailable' }),
      generateLatestDailyPunditSummaryForLeague(player.league_id, undefined, supabase),
      autoGenerateMatchRecapsForMatch(match_id, match.tournament_code, match.tournament_season, supabase),
      enrichOpenMatchesForTournament(match.tournament_code, match.tournament_season, {}, supabase),
    ])

    return NextResponse.json({ match: data, aiSummary, aiDailySummary, aiRecap, aiEnrichment })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
