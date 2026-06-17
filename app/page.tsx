'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  PlusCircle,
  ShieldCheck,
  Trophy,
  Users,
} from 'lucide-react'
import type { Session, SessionsMap } from '@/types'
import { getSessions, saveSession } from '@/lib/utils'

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

export default function HomePage() {
  const [sessions, setSessions] = useState<SessionsMap>({})

  useEffect(() => { setSessions(getSessions()) }, [])

  const leagueList = Object.entries(sessions)
  const hasSavedLeagues = leagueList.length > 0

  return (
    <main className="min-h-screen px-4 py-8 sm:py-12">
      <div className="w-full max-w-5xl mx-auto">
        <header className="mb-6 sm:mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
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

            <p className="text-xs sm:text-right max-w-sm leading-relaxed" style={{ color: 'var(--text-subtle)' }}>
              Picks save automatically. Rejoin with the same league code and display name on any device.
            </p>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr] md:items-start">
          {hasSavedLeagues && (
            <div className="order-1 md:order-3 md:col-start-2 md:row-start-2">
              <YourLeaguesCard leagues={leagueList} />
            </div>
          )}

          <div className={`${hasSavedLeagues ? 'order-2' : 'order-1'} md:order-1 md:col-start-1 md:row-span-2`}>
            <CreateLeagueCard
              onCreated={(code, session) => {
                saveSession(code, session)
                setSessions(getSessions())
              }}
            />
          </div>

          <div className={`${hasSavedLeagues ? 'order-3' : 'order-2'} md:order-2 md:col-start-2 md:row-start-1`}>
            <JoinLeagueCard
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

function YourLeaguesCard({ leagues }: { leagues: Array<[string, Session]> }) {
  return (
    <Card compact>
      <CardHeader
        icon={<ShieldCheck size={15} style={{ color: 'var(--accent)' }} />}
        label="Your Leagues"
        description="Jump back into a saved league."
      />
      <div className="flex flex-col gap-2">
        {leagues.map(([code, s]) => (
          <YourLeagueRow key={code} code={code} session={s} />
        ))}
      </div>
    </Card>
  )
}

function YourLeagueRow({ code, session }: { code: string; session: Session }) {
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
        <Trophy size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate leading-tight" style={{ color: 'var(--text)' }}>
          {session.league_name ?? code}
        </p>
        <p className="text-xs leading-tight mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
          Playing as <span style={{ color: 'var(--text)' }}>{session.display_name}</span>
          {' - '}
          <span className="font-mono">{code}</span>
        </p>
      </div>
      <ExternalLink size={13} style={{ color: 'var(--text-subtle)' }} className="shrink-0" />
    </button>
  )
}

function CreateLeagueCard({ onCreated }: { onCreated: (code: string, s: Session) => void }) {
  const router = useRouter()
  const [leagueName, setLeagueName] = useState('')
  const [yourName, setYourName] = useState('')
  const [telegram, setTelegram] = useState('')
  const [tournamentIdx, setTournamentIdx] = useState(0)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
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

  return (
    <Card primary>
      <CardHeader
        icon={<PlusCircle size={16} style={{ color: 'var(--gold)' }} />}
        label="Create a League"
        description="Start fresh with a tournament and invite your crew."
      />
      <div className="flex flex-col gap-3.5">
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
        <ActionBtn onClick={handleCreate} disabled={!ready || loading} loading={loading} label="Create League" color="var(--accent)" />
      </div>
    </Card>
  )
}

function JoinLeagueCard({ onJoined }: { onJoined: (code: string, s: Session) => void }) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [yourName, setYourName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleJoin = async () => {
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

  return (
    <Card compact>
      <CardHeader
        icon={<Users size={15} style={{ color: 'var(--blue)' }} />}
        label="Join a League"
        description="Enter a code from a friend."
      />
      <div className="flex flex-col gap-3">
        <Field label="Invite code" placeholder="e.g. WOLF42" value={code} onChange={v => setCode(v.toUpperCase())} maxLength={6} mono />
        <Field label="Your name" placeholder="How you'll appear on the board" value={yourName} onChange={setYourName} maxLength={20} />
        {error && <p className="text-xs" style={{ color: 'var(--red)' }}>{error}</p>}
        <ActionBtn onClick={handleJoin} disabled={!ready || loading} loading={loading} label="Join League" color="var(--blue)" />
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
