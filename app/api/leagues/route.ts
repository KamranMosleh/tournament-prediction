import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateInviteCode } from '@/lib/utils'

export async function POST(req: NextRequest) {
  try {
    const { league_name, display_name, telegram_url, tournament_code, tournament_season, tournament } = await req.json()

    if (!league_name?.trim() || !display_name?.trim())
      return NextResponse.json({ error: 'Missing league_name or display_name' }, { status: 400 })
    if (league_name.length < 3 || league_name.length > 40)
      return NextResponse.json({ error: 'League name must be 3–40 characters' }, { status: 400 })
    if (display_name.length < 2 || display_name.length > 20)
      return NextResponse.json({ error: 'Display name must be 2–20 characters' }, { status: 400 })

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
        telegram_url: telegram_url ?? null,
      })
      .select()
      .single()

    if (leagueError || !league)
      return NextResponse.json({ error: 'Failed to create league' }, { status: 500 })

    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({ league_id: league.id, display_name: display_name.trim(), is_admin: true })
      .select()
      .single()

    if (playerError || !player) {
      await supabase.from('leagues').delete().eq('id', league.id)
      return NextResponse.json({ error: 'Failed to create player' }, { status: 500 })
    }

    await supabase.from('leagues').update({ created_by: player.id }).eq('id', league.id)

    return NextResponse.json({
      league: { ...league, created_by: player.id },
      player,
      session: {
        player_id: player.id,
        session_token: player.session_token,
        display_name: player.display_name,
        league_id: league.id,
        league_name: league.name,
        invite_code: league.invite_code,
        is_admin: true,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
