'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Archive,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  LogIn,
  LogOut,
  PlusCircle,
  ShieldCheck,
  Trophy,
  UserPlus,
  Users,
} from 'lucide-react'
import type { League, Player, Session, SessionsMap } from '@/types'
import { getSessions, removeSession, saveSession } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

// Tournaments available on football-data.org free tier
const TOURNAMENTS = [
  { label: 'FIFA World Cup 2026',         code: 'WC',  season: 2026 },
  { label: 'UEFA Euro 2028',              code: 'EC',  season: 2028 },
  { label: 'UEFA Champions League 25/26', code: 'CL',  season: 2025 },
  { label: 'UEFA Europa League 25/26',    code: 'EL',  season: 2025 },
  { label: 'Premier League 25/26',        code: 'PL',  season: 2025 },
  { label: 'Bundesliga 25/26',            code: 'BL1', season: 2025 },
  { label: 'La Liga 25/26',               code: 'PD',  season: 2025 },
  { label: 'Serie A 25/26',               code: 'SA',  season: 2025 },
  { label: 'Ligue 1 25/26',               code: 'FL1', season: 2025 },
]

type AccountPlayerRow = Player & { leagues: League | League[] | null }
type LeagueEntry = [string, Session, boolean]

export default function HomePage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<SessionsMap>({})
  const [accountEmail, setAccountEmail] = useState<string | null>(null)
  const [accountLeagues, setAccountLeagues] = useState<LeagueEntry[]>([])
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    let mounted = true
    const savedSessions = getSessions()
    setSessions(savedSessions)

    const savedCodes = Object.keys(savedSessions)
    if (savedCodes.length > 0) {
      supabase
        .from('leagues')
        .select('invite_code')
        .in('invite_code', savedCodes)
        .then(({ data, error }) => {
          if (!mounted || error) return
          const existingCodes = new Set((data ?? []).map(row => row.invite_code.toUpperCase()))
          for (const code of savedCodes) {
            if (!existingCodes.has(code.toUpperCase())) removeSession(code)
          }
          setSessions(getSessions())
        })
    }

    const loadAccount = async () => {
      setAuthLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted) return

      setAccountEmail(user?.email ?? null)

      if (!user) {
        setAccountLeagues([])
        setAuthLoading(false)
        return
      }

      const { data } = await supabase
        .from('players')
        .select('*, leagues(*)')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: true })

      if (!mounted) return

      const entries = ((data ?? []) as AccountPlayerRow[])
        .map(row => {
          const league = relationOne(row.leagues)
          if (!league) return null
          const session: Session = {
            player_id: row.id,
            user_id: row.user_id,
            session_token: row.session_token,
            display_name: row.display_name,
            league_id: league.id,
            league_name: league.name,
            invite_code: league.invite_code,
            is_admin: row.is_admin,
          }
          return [league.invite_code, session, Boolean(league.archived_at)] as LeagueEntry
        })
        .filter((entry): entry is LeagueEntry => Boolean(entry))

      setAccountLeagues(entries)
      setAuthLoading(false)
    }

    loadAccount()
    const { data: authListener } = supabase.auth.onAuthStateChange(() => { loadAccount() })

    return () => {
      mounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  const legacyLeagues = Object.entries(sessions)
    .filter(([code]) => !accountLeagues.some(([accountCode]) => accountCode.toUpperCase() === code.toUpperCase()))
    .map(([code, session]) => [code, session, false] as LeagueEntry)

  const activeAccountLeagues = accountLeagues.filter(([, , archived]) => !archived)
  const archivedAccountLeagues = accountLeagues.filter(([, , archived]) => archived)
  const hasLeagueCards = accountLeagues.length > 0 || legacyLeagues.length > 0
  const isSignedIn = Boolean(accountEmail)

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setAccountEmail(null)
    setAccountLeagues([])
    router.refresh()
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:py-12">
      <div className="w-full max-w-5xl mx-auto">
        <header className="mb-6 sm:mb-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--accent)' }}>
                <Trophy size={14} />
                Football predictions
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
                Tournament Predictor
              </h1>
              <p className="text-sm sm:text-base mt-2 max-w-xl" style={{ color: 'var(--text-muted)' }}>
                Create a league, share a code, and track every prediction with friends.
              </p>
            </div>

            <AccountPanel email={accountEmail} loading={authLoading} onSignOut={signOut} />
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr] md:items-start">
          {hasLeagueCards && (
            <div className="order-1 md:order-3 md:col-start-2 md:row-start-2 flex flex-col gap-4">
              {activeAccountLeagues.length > 0 && (
                <YourLeaguesCard
                  title="Your Leagues"
                  description="Synced to your account."
                  leagues={activeAccountLeagues}
                />
              )}
              {archivedAccountLeagues.length > 0 && (
                <YourLeaguesCard
                  title="Archived Leagues"
                  description="Read-only history. Owners can restore them."
                  leagues={archivedAccountLeagues}
                  archived
                />
              )}
              {legacyLeagues.length > 0 && (
                <YourLeaguesCard
                  title="Saved on this device"
                  description="Legacy sessions stored in this browser."
                  leagues={legacyLeagues}
                />
              )}
            </div>
          )}

          <div className={`${hasLeagueCards ? 'order-2' : 'order-1'} md:order-1 md:col-start-1 md:row-span-2`}>
            <CreateLeagueCard
              signedIn={isSignedIn}
              onAuthRequired={() => router.push('/auth/sign-in?next=/')}
              onCreated={(code, session) => {
                saveSession(code, session)
                setSessions(getSessions())
              }}
            />
          </div>

          <div className={`${hasLeagueCards ? 'order-3' : 'order-2'} md:order-2 md:col-start-2 md:row-start-1`}>
            <JoinLeagueCard
              signedIn={isSignedIn}
              onAuthRequired={() => router.push('/auth/sign-in?next=/')}
              onJoined={(code, session) => {
                saveSession(code, session)
                setSessions(getSessions())
              }}
            />
          </div>
        </div>
      </div>
    </main>
  )
}

function relationOne<T>(relation: T | T[] | null): T | null {
  if (Array.isArray(relation)) return relation[0] ?? null
  return relation
}

function AccountPanel({ email, loading, onSignOut }: { email: string | null; loading: boolean; onSignOut: () => void }) {
  if (loading) {
    return (
      <div className="text-xs flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
        <Loader2 size={13} className="animate-spin" />
        Checking account...
      </div>
    )
  }

  if (!email) {
    return (
      <div className="flex flex-wrap gap-2">
        <AuthLink href="/auth/sign-in" icon={<LogIn size={13} />} label="Sign in" />
        <AuthLink href="/auth/sign-up" icon={<UserPlus size={13} />} label="Create account" strong />
      </div>
    )
  }

  return (
    <div className="flex flex-col sm:items-end gap-2">
      <p className="text-xs max-w-xs truncate" style={{ color: 'var(--text-muted)' }}>
        Signed in as <span style={{ color: 'var(--text)' }}>{email}</span>
      </p>
      <button
        onClick={onSignOut}
        className="inline-flex items-center gap-1.5 text-xs w-fit"
        style={{ color: 'var(--text-subtle)' }}
      >
        <LogOut size={13} />
        Sign out
      </button>
    </div>
  )
}

function AuthLink({ href, icon, label, strong }: { href: string; icon: ReactNode; label: string; strong?: boolean }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
      style={{
        background: strong ? 'var(--accent)' : 'var(--surface)',
        color: strong ? '#000' : 'var(--text)',
        border: strong ? '1px solid var(--accent)' : '1px solid var(--border)',
      }}
    >
      {icon}
      {label}
    </a>
  )
}

function YourLeaguesCard({ title, description, leagues, archived = false }: {
  title: string
  description: string
  leagues: LeagueEntry[]
  archived?: boolean
}) {
  return (
    <Card compact>
      <CardHeader
        icon={archived
          ? <Archive size={15} style={{ color: 'var(--gold)' }} />
          : <ShieldCheck size={15} style={{ color: 'var(--accent)' }} />}
        label={title}
        description={description}
      />
      <div className="flex flex-col gap-2">
        {leagues.map(([code, s, isArchived]) => (
          <YourLeagueRow key={code} code={code} session={s} archived={isArchived} />
        ))}
      </div>
    </Card>
  )
}

function YourLeagueRow({ code, session, archived }: { code: string; session: Session; archived: boolean }) {
  const router = useRouter()
  return (
    <button
      onClick={() => router.push(`/league/${code}`)}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-left transition-all"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)' }}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}
      >
        {archived ? <Archive size={14} /> : <Trophy size={14} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate leading-tight" style={{ color: 'var(--text)' }}>
          {session.league_name ?? code}
        </p>
        <p className="text-xs leading-tight mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
          Playing as <span style={{ color: 'var(--text)' }}>{session.display_name}</span>
          {' - '}
          <span className="font-mono">{code}</span>
          {archived && <span style={{ color: 'var(--gold)' }}> - Archived</span>}
        </p>
      </div>
      <ExternalLink size={13} style={{ color: 'var(--text-subtle)' }} className="shrink-0" />
    </button>
  )
}

function CreateLeagueCard({
  signedIn,
  onAuthRequired,
  onCreated,
}: {
  signedIn: boolean
  onAuthRequired: () => void
  onCreated: (code: string, s: Session) => void
}) {
  const router = useRouter()
  const [leagueName, setLeagueName] = useState('')
  const [yourName, setYourName] = useState('')
  const [telegram, setTelegram] = useState('')
  const [tournamentIdx, setTournamentIdx] = useState(0)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!signedIn) {
      onAuthRequired()
      return
    }

    setError('')
    setLoading(true)
    const t = TOURNAMENTS[tournamentIdx]
    try {
      const res = await fetch('/api/leagues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          league_name: leagueName,
          display_name: yourName,
          telegram_url: telegram || null,
          tournament: t.label,
          tournament_code: t.code,
          tournament_season: t.season,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      onCreated(data.league.invite_code, data.session)
      router.push(`/league/${data.league.invite_code}`)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const ready = leagueName.trim().length >= 3 && yourName.trim().length >= 2
  const disabled = loading || (signedIn && !ready)

  return (
    <Card primary>
      <CardHeader
        icon={<PlusCircle size={16} style={{ color: 'var(--gold)' }} />}
        label="Create a League"
        description="Start fresh with a tournament and invite your crew."
      />
      <div className="flex flex-col gap-3.5">
        {!signedIn && (
          <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
            Sign in first so this league follows you across devices.
          </p>
        )}
        <Field label="League name" placeholder="e.g. Office Crew 2026" value={leagueName} onChange={setLeagueName} maxLength={40} />
        <Field label="Your name" placeholder="How you'll appear on the board" value={yourName} onChange={setYourName} maxLength={20} />

        <div>
          <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Tournament</label>
          <select
            value={tournamentIdx}
            onChange={e => setTournamentIdx(Number(e.target.value))}
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none appearance-none transition-colors"
            style={{
              background: 'var(--bg)',
              border: '1.5px solid var(--border)',
              color: 'var(--text)',
              cursor: 'pointer',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
            onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
          >
            {TOURNAMENTS.map((t, i) => (
              <option key={t.code + t.season} value={i} style={{ background: 'var(--surface)' }}>{t.label}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setShowAdvanced(v => !v)}
          className="flex items-center gap-1 text-xs w-fit"
          style={{ color: 'var(--text-subtle)' }}
        >
          {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {showAdvanced ? 'Hide options' : 'Add Telegram link'}
        </button>

        {showAdvanced && (
          <Field label="Telegram group link (optional)" placeholder="https://t.me/..." value={telegram} onChange={setTelegram} />
        )}

        {error && <p className="text-xs" style={{ color: 'var(--red)' }}>{error}</p>}
        <ActionBtn
          onClick={handleCreate}
          disabled={disabled}
          loading={loading}
          label={signedIn ? 'Create League' : 'Sign in to create'}
          color="var(--accent)"
        />
      </div>
    </Card>
  )
}

function JoinLeagueCard({
  signedIn,
  onAuthRequired,
  onJoined,
}: {
  signedIn: boolean
  onAuthRequired: () => void
  onJoined: (code: string, s: Session) => void
}) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [yourName, setYourName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleJoin = async () => {
    if (!signedIn) {
      onAuthRequired()
      return
    }

    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_code: code, display_name: yourName }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      onJoined(data.league.invite_code, data.session)
      router.push(`/league/${data.league.invite_code}`)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const ready = code.trim().length === 6 && yourName.trim().length >= 2
  const disabled = loading || (signedIn && !ready)

  return (
    <Card compact>
      <CardHeader
        icon={<Users size={15} style={{ color: 'var(--blue)' }} />}
        label="Join a League"
        description="Enter a code from a friend."
      />
      <div className="flex flex-col gap-3">
        {!signedIn && (
          <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
            Sign in first to save this league to your account.
          </p>
        )}
        <Field label="Invite code" placeholder="e.g. WOLF42" value={code} onChange={v => setCode(v.toUpperCase())} maxLength={6} mono />
        <Field label="Your name" placeholder="How you'll appear on the board" value={yourName} onChange={setYourName} maxLength={20} />
        {error && <p className="text-xs" style={{ color: 'var(--red)' }}>{error}</p>}
        <ActionBtn
          onClick={handleJoin}
          disabled={disabled}
          loading={loading}
          label={signedIn ? 'Join League' : 'Sign in to join'}
          color="var(--blue)"
        />
      </div>
    </Card>
  )
}

function Card({ children, primary, compact }: { children: ReactNode; primary?: boolean; compact?: boolean }) {
  return (
    <div
      className={`${compact ? 'p-4' : 'p-5 sm:p-6'} rounded-lg`}
      style={{
        background: primary
          ? 'linear-gradient(180deg, rgba(63,185,80,0.08), rgba(22,27,34,1) 34%)'
          : 'var(--surface)',
        border: primary ? '1px solid rgba(63,185,80,0.28)' : '1px solid var(--border)',
      }}
    >
      {children}
    </div>
  )
}

function CardHeader({ icon, label, description }: { icon: ReactNode; label: string; description?: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <span className="font-semibold text-sm block leading-tight" style={{ color: 'var(--text)' }}>{label}</span>
        {description && (
          <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {description}
          </p>
        )}
      </div>
    </div>
  )
}

function Field({ label, placeholder, value, onChange, maxLength, mono }: {
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  maxLength?: number
  mono?: boolean
}) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        maxLength={maxLength}
        className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-colors"
        style={{
          background: 'var(--bg)',
          border: '1.5px solid var(--border)',
          color: 'var(--text)',
          fontFamily: mono ? 'monospace' : 'inherit',
          letterSpacing: mono ? '0.12em' : 'normal',
        }}
        onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
        onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
      />
    </div>
  )
}

function ActionBtn({ onClick, disabled, loading, label, color }: {
  onClick: () => void
  disabled: boolean
  loading: boolean
  label: string
  color: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 mt-1 transition-colors"
      style={{
        background: disabled ? 'var(--surface-2)' : color,
        color: disabled ? 'var(--text-subtle)' : '#000',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
      {loading ? 'Loading...' : label}
    </button>
  )
}
