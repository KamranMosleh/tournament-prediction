import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('x-session-token')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { player_id, league_id, winner_team, top_scorer_name } = await req.json()

    if (!player_id || !league_id || !winner_team?.trim() || !top_scorer_name?.trim()) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Verify session
    const { data: player } = await supabase
      .from('players')
      .select('id, league_id')
      .eq('session_token', token)
      .single()

    if (!player || player.id !== player_id || player.league_id !== league_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: league } = await supabase
      .from('leagues')
      .select('tournament_code, tournament_season')
      .eq('id', league_id)
      .single()

    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 })
    }

    // Check deadline: must be before first match kicks off
    const { data: firstMatch } = await supabase
      .from('matches')
      .select('kickoff_time, status')
      .eq('tournament_code', league.tournament_code)
      .eq('tournament_season', league.tournament_season)
      .order('kickoff_time', { ascending: true })
      .limit(1)
      .single()

    if (firstMatch && firstMatch.status !== 'open') {
      return NextResponse.json({ error: 'Tournament predictions are locked' }, { status: 409 })
    }
    if (firstMatch && new Date(firstMatch.kickoff_time) <= new Date()) {
      return NextResponse.json({ error: 'Tournament predictions are locked' }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('tournament_predictions')
      .upsert(
        { player_id, league_id, winner_team: winner_team.trim(), top_scorer_name: top_scorer_name.trim(), submitted_at: new Date().toISOString() },
        { onConflict: 'player_id,league_id' }
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
