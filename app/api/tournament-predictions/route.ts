import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getVerifiedPlayer } from '@/lib/auth'
import type { Match } from '@/types'
import { getPickDeadlines, isDeadlinePassed } from '@/lib/tournament-picks'

export async function POST(req: NextRequest) {
  try {
    const { player_id, league_id, winner_team, top_scorer_name } = await req.json()
    const winnerInput = typeof winner_team === 'string' ? winner_team.trim() : ''
    const scorerInput = typeof top_scorer_name === 'string' ? top_scorer_name.trim() : ''

    if (!player_id || !league_id) {
      return NextResponse.json({ error: 'Missing player_id or league_id' }, { status: 400 })
    }
    if (!winnerInput && !scorerInput) {
      return NextResponse.json({ error: 'Provide winner_team or top_scorer_name' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const verified = await getVerifiedPlayer(supabase, { playerId: player_id, leagueId: league_id })
    if (!verified) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: league } = await supabase
      .from('leagues')
      .select('tournament_code, tournament_season, archived_at')
      .eq('id', league_id)
      .single()

    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 })
    }
    if (league.archived_at) {
      return NextResponse.json({ error: 'This league is archived and read-only' }, { status: 409 })
    }

    const { data: tournamentMatches } = await supabase
      .from('matches')
      .select('*')
      .eq('tournament_code', league.tournament_code)
      .eq('tournament_season', league.tournament_season)
      .order('kickoff_time', { ascending: true })

    const deadlines = getPickDeadlines((tournamentMatches ?? []) as Match[])
    const winnerLocked = isDeadlinePassed(deadlines.finalKickoff)
    const scorerLocked = isDeadlinePassed(deadlines.semiFinalKickoff)

    const { data: existing } = await supabase
      .from('tournament_predictions')
      .select('*')
      .eq('player_id', player_id)
      .eq('league_id', league_id)
      .single()

    if (winnerInput && winnerLocked && existing?.winner_team?.toLowerCase() !== winnerInput.toLowerCase()) {
      return NextResponse.json({ error: 'Winner prediction is locked (final has started)' }, { status: 409 })
    }
    if (scorerInput && scorerLocked && existing?.top_scorer_name?.toLowerCase() !== scorerInput.toLowerCase()) {
      return NextResponse.json({ error: 'Top scorer prediction is locked (semi-finals have started)' }, { status: 409 })
    }

    const winnerChanged = !!winnerInput && winnerInput !== (existing?.winner_team ?? '')
    const scorerChanged = !!scorerInput && scorerInput !== (existing?.top_scorer_name ?? '')
    const nowIso = new Date().toISOString()

    const payload = {
      player_id,
      league_id,
      winner_team: winnerInput || existing?.winner_team || '',
      top_scorer_name: scorerInput || existing?.top_scorer_name || '',
      submitted_at: nowIso,
      winner_submitted_at: winnerChanged ? nowIso : (existing?.winner_submitted_at ?? existing?.submitted_at ?? null),
      top_scorer_submitted_at: scorerChanged ? nowIso : (existing?.top_scorer_submitted_at ?? existing?.submitted_at ?? null),
    }

    const { data, error } = await supabase
      .from('tournament_predictions')
      .upsert(payload, { onConflict: 'player_id,league_id' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'Failed to save' }, { status: 500 })

    return NextResponse.json({ prediction: data })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
