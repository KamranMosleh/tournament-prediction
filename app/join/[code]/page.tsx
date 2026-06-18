import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { LogIn, Trophy, UserPlus } from 'lucide-react'
import { JoinLeagueForm } from '@/components/join/JoinLeagueForm'
import { withNext } from '@/lib/auth-redirect'
import { createClient, createServiceClient } from '@/lib/supabase/server'

interface Props {
  params: Promise<{ code: string }>
}

export default async function JoinPage({ params }: Props) {
  const { code: rawCode } = await params
  const code = rawCode.toUpperCase()
  const next = `/join/${code}`
  const supabase = createServiceClient()
  const { data: league } = await supabase
    .from('leagues')
    .select('id, name, invite_code, archived_at')
    .eq('invite_code', code)
    .maybeSingle()

  if (!league) notFound()

  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex w-12 h-12 rounded-lg items-center justify-center mb-4" style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}>
            <Trophy size={22} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Join {league.name}</h1>
          <p className="text-sm mt-2 mb-6" style={{ color: 'var(--text-muted)' }}>
            Invite code <span className="font-mono font-bold" style={{ color: 'var(--accent)' }}>{code}</span>
          </p>
          <div className="rounded-lg p-5 flex flex-col gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
              Sign in or create an account. You will return to this invitation afterward.
            </p>
            <Link href={withNext('/auth/sign-in', next)} className="w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2" style={{ background: 'var(--accent)', color: '#000' }}>
              <LogIn size={15} />
              Sign in
            </Link>
            <Link href={withNext('/auth/sign-up', next)} className="w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2" style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}>
              <UserPlus size={15} />
              Create account
            </Link>
            <Link href="/" className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>Back to home</Link>
          </div>
        </div>
      </main>
    )
  }

  const { data: membership } = await supabase
    .from('players')
    .select('id')
    .eq('league_id', league.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (membership) redirect(`/league/${code}`)

  return <JoinLeagueForm code={code} leagueName={league.name} archived={Boolean(league.archived_at)} />
}
