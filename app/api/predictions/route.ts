import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getVerifiedPlayer } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { match_id, player_id, home_score, away_score, penalty_winner_team } = await req.json()
    const homeScore = Number(home_score)
    const awayScore = Number(away_score)
    const penaltyWinnerInput = typeof penalty_winner_team === 'string' ? penalty_winner_team.trim() : ''

    if (
      !match_id ||
      !player_id ||
      home_score === undefined ||
      away_score === undefined ||
      home_score === null ||
      away_score === null ||
      home_score === '' ||
      away_score === ''
    ) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    if (
      !Number.isInteger(homeScore) ||
      !Number.isInteger(awayScore) ||
      homeScore < 0 ||
      awayScore < 0 ||
      homeScore > 20 ||
      awayScore > 20
    ) {
      return NextResponse.json({ error: 'Invalid scores' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const verified = await getVerifiedPlayer(supabase, { playerId: player_id })
    if (!verified) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: league } = await supabase
      .from('leagues')
      .select('archived_at, tournament_code, tournament_season')
      .eq('id', verified.player.league_id)
      .single()

    if (league?.archived_at) {
      return NextResponse.json({ error: 'This league is archived and read-only' }, { status: 409 })
    }

    // Check match is still open
    const { data: match } = await supabase
      .from('matches')
      .select('status, tournament_code, tournament_season, stage, home_team, away_team')
      .eq('id', match_id)
      .single()

    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    if (
      !league ||
      match.tournament_code !== league.tournament_code ||
      match.tournament_season !== league.tournament_season
    ) {
      return NextResponse.json({ error: 'Match is outside this league tournament' }, { status: 403 })
    }
    if (match.status !== 'open') {
      return NextResponse.json({ error: 'Predictions are locked for this match' }, { status: 409 })
    }
    const penaltyEligible = match.stage !== 'group'
    const predictedDraw = homeScore === awayScore
    let penaltyWinnerTeam: string | null = null

    if (penaltyEligible && predictedDraw) {
      if (penaltyWinnerInput !== match.home_team && penaltyWinnerInput !== match.away_team) {
        return NextResponse.json({ error: 'Select the penalty shootout winner' }, { status: 400 })
      }
      penaltyWinnerTeam = penaltyWinnerInput
    }

    // Upsert prediction, then read it back before reporting success.
    const { error } = await supabase
      .from('match_predictions')
      .upsert(
        {
          player_id,
          match_id,
          home_score: homeScore,
          away_score: awayScore,
          penalty_winner_team: penaltyWinnerTeam,
          submitted_at: new Date().toISOString(),
        },
        { onConflict: 'player_id,match_id' }
      )

    if (error) return NextResponse.json({ error: 'Failed to save' }, { status: 500 })

    const { data: persisted, error: verifyError } = await supabase
      .from('match_predictions')
      .select('*')
      .eq('player_id', player_id)
      .eq('match_id', match_id)
      .single()

    if (verifyError || !persisted) {
      return NextResponse.json({ error: 'Failed to verify saved prediction' }, { status: 500 })
    }

    if (
      persisted.home_score !== homeScore ||
      persisted.away_score !== awayScore ||
      (persisted.penalty_winner_team ?? null) !== penaltyWinnerTeam
    ) {
      return NextResponse.json({ error: 'Saved prediction verification failed' }, { status: 409 })
    }

    return NextResponse.json({ prediction: persisted, verified: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
