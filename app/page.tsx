import Link from 'next/link'
import { LogIn, Trophy, UserPlus } from 'lucide-react'
import { HomeDashboard, type DashboardLeague } from '@/components/home/HomeDashboard'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { League, Player, Session } from '@/types'

export default async function HomePage() {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()

  if (!user) return <SignedOutGate />

  const supabase = createServiceClient()
  const { data: playerRows } = await supabase
    .from('players')
    .select('id, league_id, user_id, display_name, is_admin, joined_at, joined_match_day')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })

  const players = (playerRows ?? []) as Player[]
  const leagueIds = players.map(player => player.league_id)
  const { data: leagueRows } = leagueIds.length
    ? await supabase.from('leagues').select('*').in('id', leagueIds)
    : { data: [] }

  const leaguesById = new Map(
    ((leagueRows ?? []) as League[]).map(league => [league.id, league])
  )

  const leagues: DashboardLeague[] = players.flatMap(player => {
    const league = leaguesById.get(player.league_id)
    if (!league || !player.user_id) return []

    const session: Session = {
      player_id: player.id,
      user_id: player.user_id,
      display_name: player.display_name,
      league_id: league.id,
      league_name: league.name,
      invite_code: league.invite_code,
      is_admin: player.is_admin,
    }

    return [{ session, archived: Boolean(league.archived_at) }]
  })

  return <HomeDashboard email={user.email ?? 'Signed-in account'} leagues={leagues} />
}

function SignedOutGate() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm text-center">
        <div
          className="inline-flex w-12 h-12 items-center justify-center rounded-lg mb-4"
          style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}
        >
          <Trophy size={23} />
        </div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
          Tournament Predictor
        </h1>
        <p className="text-sm mt-2 mb-6" style={{ color: 'var(--text-muted)' }}>
          Sign in to create, join, and manage your private leagues.
        </p>
        <div
          className="rounded-lg p-5 flex flex-col gap-3"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <Link
            href="/auth/sign-in"
            className="w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
            style={{ background: 'var(--accent)', color: '#000' }}
          >
            <LogIn size={15} />
            Sign in
          </Link>
          <Link
            href="/auth/sign-up"
            className="w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
            style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
          >
            <UserPlus size={15} />
            Create account
          </Link>
        </div>
      </div>
    </main>
  )
}
