import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getVerifiedPlayer } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { match_id, player_id, home_score, away_score } = await req.json()

    if (!match_id || !player_id || home_score === undefined || away_score === undefined) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    if (home_score < 0 || away_score < 0 || home_score > 20 || away_score > 20) {
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
      .select('status, tournament_code, tournament_season')
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

    // Upsert prediction
    const { data, error } = await supabase
      .from('match_predictions')
      .upsert(
        { player_id, match_id, home_score, away_score, submitted_at: new Date().toISOString() },
        { onConflict: 'player_id,match_id' }
      )
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'Failed to save' }, { status: 500 })

    return NextResponse.json({ prediction: data })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
