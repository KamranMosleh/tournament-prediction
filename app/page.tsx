'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Trophy, Users, ArrowRight, Loader2, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import type { Session, SessionsMap } from '@/types'
import { getSessions, saveSession } from '@/lib/utils'

// Tournaments available on football-data.org free tier
const TOURNAMENTS = [
  { label: 'FIFA World Cup 2026',        code: 'WC',  season: 2026 },
  { label: 'UEFA Euro 2028',             code: 'EC',  season: 2028 },
  { label: 'UEFA Champions League 25/26',code: 'CL',  season: 2025 },
  { label: 'UEFA Europa League 25/26',   code: 'EL',  season: 2025 },
  { label: 'Premier League 25/26',       code: 'PL',  season: 2025 },
  { label: 'Bundesliga 25/26',           code: 'BL1', season: 2025 },
  { label: 'La Liga 25/26',              code: 'PD',  season: 2025 },
  { label: 'Serie A 25/26',              code: 'SA',  season: 2025 },
  { label: 'Ligue 1 25/26',             code: 'FL1', season: 2025 },
]

export default function HomePage() {
  const [sessions, setSessions] = useState<SessionsMap>({})

  useEffect(() => { setSessions(getSessions()) }, [])

  const leagueList = Object.entries(sessions)

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* Hero */}
      <div className="text-center mb-8">
        <div
          className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
          style={{ background: 'var(--accent-glow)', border: '1px solid rgba(63,185,80,0.3)' }}
        >
          <span className="text-2xl">⚽</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-1.5" style={{ color: 'var(--text)' }}>
          Tournament Predictor
        </h1>
        <p className="text-sm max-w-xs mx-auto" style={{ color: 'var(--text-muted)' }}>
          Predict every score. Compete with friends. See who knows football best.
        </p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-3">
        {/* Your leagues */}
        {leagueList.length > 0 && (
          <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2.5" style={{ color: 'var(--text-muted)' }}>
              Your Leagues
            </p>
            <div className="flex flex-col gap-1.5">
              {leagueList.map(([code, s]) => (
                <YourLeagueRow key={code} code={code} session={s} />
              ))}
            </div>
          </div>
        )}

        <CreateLeagueCard
          onCreated={(code, session) => {
            saveSession(code, session)
            setSessions(getSessions())
          }}
        />

        <Divider label="or join with a code" />

        <JoinLeagueCard
          onJoined={(code, session) => {
            saveSession(code, session)
            setSessions(getSessions())
          }}
        />
      </div>
    </main>
  )
}

/* ── Your Leagues row ── */
function YourLeagueRow({ code, session }: { code: string; session: Session }) {
  const router = useRouter()
  return (
    <button
      onClick={() => router.push(`/league/${code}`)}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-left transition-all"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
        style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}
      >⚽</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate leading-tight" style={{ color: 'var(--text)' }}>
          {session.league_name ?? code}
        </p>
        <p className="text-xs leading-tight mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Playing as <span style={{ color: 'var(--text)' }}>{session.display_name}</span>
          {' · '}
          <span className="font-mono">{code}</span>
        </p>
      </div>
      <ExternalLink size={13} style={{ color: 'var(--text-subtle)' }} className="shrink-0" />
    </button>
  )
}

/* ── Create League ── */
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
    } catch { setError('Something went wrong. Please try again.') }
    finally { setLoading(false) }
  }

  const ready = leagueName.trim().length >= 3 && yourName.trim().length >= 2

  return (
    <Card>
      <CardHeader icon={<Trophy size={14} style={{ color: 'var(--gold)' }} />} label="Create a League" />
      <div className="flex flex-col gap-3">
        <Field label="League name" placeholder="e.g. Office Crew 2026" value={leagueName} onChange={setLeagueName} maxLength={40} />
        <Field label="Your name" placeholder="How you'll appear on the board" value={yourName} onChange={setYourName} maxLength={20} />

        {/* Tournament picker */}
        <div>
          <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Tournament</label>
          <select
            value={tournamentIdx}
            onChange={e => setTournamentIdx(Number(e.target.value))}
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none appearance-none"
            style={{
              background: 'var(--bg)', border: '1.5px solid var(--border)',
              color: 'var(--text)', cursor: 'pointer',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
            onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
          >
            {TOURNAMENTS.map((t, i) => (
              <option key={t.code + t.season} value={i} style={{ background: 'var(--surface)' }}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Optional extras */}
        <button
          onClick={() => setShowAdvanced(v => !v)}
          className="flex items-center gap-1 text-xs"
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

/* ── Join League ── */
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
    } catch { setError('Something went wrong. Please try again.') }
    finally { setLoading(false) }
  }

  const ready = code.trim().length === 6 && yourName.trim().length >= 2

  return (
    <Card>
      <CardHeader icon={<Users size={14} style={{ color: 'var(--blue)' }} />} label="Join a League" />
      <div className="flex flex-col gap-3">
        <Field label="Invite code" placeholder="e.g. WOLF42" value={code} onChange={v => setCode(v.toUpperCase())} maxLength={6} mono />
        <Field label="Your name" placeholder="How you'll appear on the board" value={yourName} onChange={setYourName} maxLength={20} />
        {error && <p className="text-xs" style={{ color: 'var(--red)' }}>{error}</p>}
        <ActionBtn onClick={handleJoin} disabled={!ready || loading} loading={loading} label="Join League" color="var(--blue)" />
      </div>
    </Card>
  )
}

/* ── Shared primitives ── */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      {children}
    </div>
  )
}

function CardHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {icon}
      <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{label}</span>
    </div>
  )
}

function Field({ label, placeholder, value, onChange, maxLength, mono }: {
  label: string; placeholder: string; value: string
  onChange: (v: string) => void; maxLength?: number; mono?: boolean
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
        className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
        style={{
          background: 'var(--bg)', border: '1.5px solid var(--border)', color: 'var(--text)',
          fontFamily: mono ? 'monospace' : 'inherit',
          letterSpacing: mono ? '0.12em' : 'normal',
          transition: 'border-color 0.15s',
        }}
        onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
        onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
      />
    </div>
  )
}

function ActionBtn({ onClick, disabled, loading, label, color }: {
  onClick: () => void; disabled: boolean; loading: boolean; label: string; color: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 mt-1"
      style={{
        background: disabled ? 'var(--surface-2)' : color,
        color: disabled ? 'var(--text-subtle)' : '#000',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.15s, opacity 0.15s',
      }}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
      {loading ? 'Loading…' : label}
    </button>
  )
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
      <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>{label}</span>
      <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
    </div>
  )
}
