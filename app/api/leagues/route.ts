import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser, toSession, upsertProfile } from '@/lib/auth'
import { generateInviteCode } from '@/lib/utils'
import type { League, Player, ScoringMode } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const { league_name, display_name, telegram_url, tournament_code, tournament_season, tournament, scoring_mode } = await req.json()
    const scoringMode: ScoringMode = scoring_mode === 'flat' || scoring_mode === 'multiplied'
      ? scoring_mode
      : 'multiplied'

    if (!league_name?.trim() || !display_name?.trim())
      return NextResponse.json({ error: 'Missing league_name or display_name' }, { status: 400 })
    if (league_name.length < 3 || league_name.length > 40)
      return NextResponse.json({ error: 'League name must be 3–40 characters' }, { status: 400 })
    if (display_name.length < 2 || display_name.length > 20)
      return NextResponse.json({ error: 'Display name must be 2–20 characters' }, { status: 400 })

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Sign in to create a league' }, { status: 401 })
    }

    await upsertProfile(user)

    const supabase = createServiceClient()

    let invite_code = generateInviteCode()
    for (let i = 0; i < 5; i++) {
      const { data } = await supabase.from('leagues').select('id').eq('invite_code', invite_code).single()
      if (!data) break
      invite_code = generateInviteCode()
    }

    const tournamentName = tournament ?? 'FIFA World Cup 2026'
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .insert({
        name: league_name.trim(),
        invite_code,
        tournament: tournamentName,
        tournament_code: tournament_code ?? 'WC',
        tournament_season: tournament_season ?? 2026,
        scoring_mode: scoringMode,
        telegram_url: telegram_url ?? null,
      })
      .select()
      .single()

    if (leagueError || !league)
      return NextResponse.json({ error: 'Failed to create league' }, { status: 500 })

    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({
        league_id: league.id,
        user_id: user.id,
        display_name: display_name.trim(),
        is_admin: true,
      })
      .select()
      .single()

    if (playerError || !player) {
      await supabase.from('leagues').delete().eq('id', league.id)
      return NextResponse.json({ error: 'Failed to create player' }, { status: 500 })
    }

    await supabase
      .from('leagues')
      .update({ created_by: player.id, created_by_user_id: user.id })
      .eq('id', league.id)

    const hydratedLeague = { ...league, created_by: player.id, created_by_user_id: user.id } as League
    const hydratedPlayer = player as Player

    return NextResponse.json({
      league: hydratedLeague,
      player,
      session: toSession(hydratedPlayer, hydratedLeague),
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
