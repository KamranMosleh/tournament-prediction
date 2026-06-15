import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { invite_code, display_name } = await req.json()

    if (!invite_code?.trim() || !display_name?.trim())
      return NextResponse.json({ error: 'Missing invite_code or display_name' }, { status: 400 })
    if (display_name.length < 2 || display_name.length > 20)
      return NextResponse.json({ error: 'Display name must be 2–20 characters' }, { status: 400 })

    const supabase = createServiceClient()

    const { data: league } = await supabase
      .from('leagues')
      .select('*')
      .eq('invite_code', invite_code.trim().toUpperCase())
      .single()

    if (!league)
      return NextResponse.json({ error: 'League not found. Check your invite code.' }, { status: 404 })

    const { data: existing } = await supabase
      .from('players')
      .select('id, session_token, is_admin, display_name')
      .eq('league_id', league.id)
      .eq('display_name', display_name.trim())
      .single()

    if (existing) {
      // Session recovery — re-issue token
      const { data: updated } = await supabase
        .from('players')
        .update({ session_token: crypto.randomUUID() })
        .eq('id', existing.id)
        .select()
        .single()

      return NextResponse.json({
        league,
        player: updated,
        session: {
          player_id: updated!.id,
          session_token: updated!.session_token,
          display_name: updated!.display_name,
          league_id: league.id,
          league_name: league.name,
          invite_code: league.invite_code,
          is_admin: updated!.is_admin,
        },
        recovered: true,
      })
    }

    const { data: player, error } = await supabase
      .from('players')
      .insert({ league_id: league.id, display_name: display_name.trim(), is_admin: false })
      .select()
      .single()

    if (error || !player)
      return NextResponse.json({ error: 'Failed to join league' }, { status: 500 })

    return NextResponse.json({
      league,
      player,
      session: {
        player_id: player.id,
        session_token: player.session_token,
        display_name: player.display_name,
        league_id: league.id,
        league_name: league.name,
        invite_code: league.invite_code,
        is_admin: false,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
