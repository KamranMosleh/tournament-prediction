import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  autoGeneratePunditSummariesForLeagueMatchDay,
  autoGenerateMatchRecapsForMatch,
  enrichOpenMatchesForTournament,
} from '@/lib/ai-jobs'

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('x-session-token')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { match_id, home_score, away_score } = await req.json()

    if (!match_id || home_score === undefined || away_score === undefined) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    if (home_score < 0 || away_score < 0 || home_score > 30 || away_score > 30) {
      return NextResponse.json({ error: 'Invalid scores' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Verify player is admin
    const { data: player } = await supabase.from('players').select('*').eq('session_token', token).single()
    if (!player?.is_admin) {
      return NextResponse.json({ error: 'Forbidden — admins only' }, { status: 403 })
    }

    // Verify match belongs to admin's league
    const { data: match } = await supabase.from('matches').select('*').eq('id', match_id).single()
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    if (match.status === 'open') {
      return NextResponse.json({ error: 'Match has not started yet' }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('matches')
      .update({ home_score, away_score, status: 'finished' })
      .eq('id', match_id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'Failed to save result' }, { status: 500 })

    const [aiSummary, aiRecap, aiEnrichment] = await Promise.all([
      match.match_day
        ? autoGeneratePunditSummariesForLeagueMatchDay(player.league_id, match.match_day, supabase)
        : Promise.resolve({ status: 'skipped' as const, reason: 'match day unavailable' }),
      autoGenerateMatchRecapsForMatch(match_id, match.tournament_code, match.tournament_season, supabase),
      enrichOpenMatchesForTournament(match.tournament_code, match.tournament_season, {}, supabase),
    ])

    return NextResponse.json({ match: data, aiSummary, aiRecap, aiEnrichment })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
