import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser, toSession, upsertProfile } from '@/lib/auth'
import type { League, Player } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const { invite_code, display_name } = await req.json()
    const inviteCode = typeof invite_code === 'string' ? invite_code.trim().toUpperCase() : ''
    const displayName = typeof display_name === 'string' ? display_name.trim() : ''

    if (!inviteCode || !displayName) {
      return NextResponse.json({ error: 'Missing invite_code or display_name' }, { status: 400 })
    }
    if (displayName.length < 2 || displayName.length > 20) {
      return NextResponse.json({ error: 'Display name must be 2-20 characters' }, { status: 400 })
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Sign in to join a league' }, { status: 401 })
    }

    await upsertProfile(user)

    const supabase = createServiceClient()

    const { data: league } = await supabase
      .from('leagues')
      .select('*')
      .eq('invite_code', inviteCode)
      .single()

    if (!league) {
      return NextResponse.json({ error: 'League not found. Check your invite code.' }, { status: 404 })
    }

    const { data: existingForAccount } = await supabase
      .from('players')
      .select('*')
      .eq('league_id', league.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingForAccount) {
      return NextResponse.json({
        league,
        player: existingForAccount,
        session: toSession(existingForAccount as Player, league as League),
        recovered: true,
      })
    }

    const { data: existingByName } = await supabase
      .from('players')
      .select('*')
      .eq('league_id', league.id)
      .ilike('display_name', displayName)
      .maybeSingle()

    if (existingByName) {
      if (existingByName.user_id && existingByName.user_id !== user.id) {
        return NextResponse.json({ error: 'That display name is already taken in this league' }, { status: 409 })
      }

      const { data: updated, error: updateError } = await supabase
        .from('players')
        .update({ session_token: crypto.randomUUID(), user_id: user.id })
        .eq('id', existingByName.id)
        .select()
        .single()

      if (updateError || !updated) {
        return NextResponse.json({ error: 'Failed to recover player' }, { status: 500 })
      }

      return NextResponse.json({
        league,
        player: updated,
        session: toSession(updated as Player, league as League),
        recovered: true,
      })
    }

    const { data: player, error } = await supabase
      .from('players')
      .insert({
        league_id: league.id,
        user_id: user.id,
        display_name: displayName,
        is_admin: false,
      })
      .select()
      .single()

    if (error?.code === '23505') {
      return NextResponse.json({ error: 'That display name is already taken in this league' }, { status: 409 })
    }
    if (error || !player) {
      return NextResponse.json({ error: 'Failed to join league' }, { status: 500 })
    }

    return NextResponse.json({
      league,
      player,
      session: toSession(player as Player, league as League),
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
