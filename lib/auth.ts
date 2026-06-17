import type { NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { League, Player, Session } from '@/types'

type ServiceClient = ReturnType<typeof createServiceClient>

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user ?? null
}

export async function upsertProfile(user: User): Promise<void> {
  const supabase = createServiceClient()
  await supabase
    .from('profiles')
    .upsert({ id: user.id, email: user.email ?? null }, { onConflict: 'id' })
}

export function toSession(player: Player, league: League): Session {
  return {
    player_id: player.id,
    user_id: player.user_id,
    session_token: player.session_token,
    display_name: player.display_name,
    league_id: league.id,
    league_name: league.name,
    invite_code: league.invite_code,
    is_admin: player.is_admin,
  }
}

export async function getVerifiedPlayer(
  req: NextRequest,
  supabase: ServiceClient,
  options: {
    playerId?: string
    leagueId?: string
    requireAdmin?: boolean
  } = {}
): Promise<{ player: Player; user: User | null; method: 'auth' | 'legacy' } | null> {
  const user = await getCurrentUser()

  if (user) {
    let query = supabase.from('players').select('*').eq('user_id', user.id)
    if (options.playerId) query = query.eq('id', options.playerId)
    if (options.leagueId) query = query.eq('league_id', options.leagueId)

    const { data: player } = await query.maybeSingle()
    if (player && (!options.requireAdmin || player.is_admin)) {
      return { player: player as Player, user, method: 'auth' }
    }
  }

  const token = req.headers.get('x-session-token')
  if (!token) return null

  let query = supabase.from('players').select('*').eq('session_token', token)
  if (options.playerId) query = query.eq('id', options.playerId)
  if (options.leagueId) query = query.eq('league_id', options.leagueId)

  const { data: player } = await query.maybeSingle()
  if (!player || (options.requireAdmin && !player.is_admin)) return null
  return { player: player as Player, user: null, method: 'legacy' }
}
