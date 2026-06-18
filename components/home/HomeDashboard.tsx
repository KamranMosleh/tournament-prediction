'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Archive,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  LogOut,
  PlusCircle,
  ShieldCheck,
  Trophy,
  Users,
} from 'lucide-react'
import type { Session } from '@/types'
import { createClient } from '@/lib/supabase/client'

const TOURNAMENTS = [
  { label: 'FIFA World Cup 2026', code: 'WC', season: 2026 },
  { label: 'UEFA Euro 2028', code: 'EC', season: 2028 },
  { label: 'UEFA Champions League 25/26', code: 'CL', season: 2025 },
  { label: 'UEFA Europa League 25/26', code: 'EL', season: 2025 },
  { label: 'Premier League 25/26', code: 'PL', season: 2025 },
  { label: 'Bundesliga 25/26', code: 'BL1', season: 2025 },
  { label: 'La Liga 25/26', code: 'PD', season: 2025 },
  { label: 'Serie A 25/26', code: 'SA', season: 2025 },
  { label: 'Ligue 1 25/26', code: 'FL1', season: 2025 },
]

export interface DashboardLeague {
  session: Session
  archived: boolean
}

export function HomeDashboard({ email, leagues }: { email: string; leagues: DashboardLeague[] }) {
  const router = useRouter()
  const active = leagues.filter(league => !league.archived)
  const archived = leagues.filter(league => league.archived)

  const signOut = async () => {
    await createClient().auth.signOut()
    router.replace('/')
    router.refresh()
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:py-12">
      <div className="w-full max-w-5xl mx-auto">
        <header className="mb-6 sm:mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--accent)' }}>
              <Trophy size={14} />
              Football predictions
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold" style={{ color: 'var(--text)' }}>Tournament Predictor</h1>
            <p className="text-sm sm:text-base mt-2" style={{ color: 'var(--text-muted)' }}>
              Create a league, share its code, and make your picks.
            </p>
          </div>
          <div className="flex flex-col lg:items-end gap-2">
            <p className="text-xs max-w-xs truncate" style={{ color: 'var(--text-muted)' }}>
              Signed in as <span style={{ color: 'var(--text)' }}>{email}</span>
            </p>
            <button onClick={signOut} className="inline-flex items-center gap-1.5 text-xs w-fit" style={{ color: 'var(--text-subtle)' }}>
              <LogOut size={13} />
              Sign out
            </button>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr] md:items-start">
          <div className="flex flex-col gap-4">
            {active.length > 0 && <LeagueList title="Your Leagues" leagues={active} />}
            <JoinLeagueCard />
            {archived.length > 0 && <LeagueList title="Archived Leagues" leagues={archived} archived />}
          </div>
          <CreateLeagueCard />
        </div>
      </div>
    </main>
  )
}

function LeagueList({ title, leagues, archived = false }: { title: string; leagues: DashboardLeague[]; archived?: boolean }) {
  const router = useRouter()
  return (
    <Card compact>
      <CardHeader
        icon={archived ? <Archive size={15} style={{ color: 'var(--gold)' }} /> : <ShieldCheck size={15} style={{ color: 'var(--accent)' }} />}
        label={title}
        description={archived ? 'Read-only history. Owners can restore these leagues.' : 'Leagues linked to your account.'}
      />
      <div className="flex flex-col gap-2">
        {leagues.map(({ session, archived: isArchived }) => (
          <button
            key={session.league_id}
            onClick={() => router.push(`/league/${session.invite_code}`)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-left"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}>
              {isArchived ? <Archive size={14} /> : <Trophy size={14} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{session.league_name}</p>
              <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                Playing as <span style={{ color: 'var(--text)' }}>{session.display_name}</span>
                {' · '}
                <span className="font-mono">{session.invite_code}</span>
              </p>
            </div>
            <ExternalLink size={13} style={{ color: 'var(--text-subtle)' }} />
          </button>
        ))}
      </div>
    </Card>
  )
}

function CreateLeagueCard() {
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
    const tournament = TOURNAMENTS[tournamentIdx]
    try {
      const res = await fetch('/api/leagues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          league_name: leagueName,
          display_name: yourName,
          telegram_url: telegram || null,
          tournament: tournament.label,
          tournament_code: tournament.code,
          tournament_season: tournament.season,
        }),
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error ?? 'Failed to create league')
      router.push(`/league/${data.league.invite_code}`)
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const ready = leagueName.trim().length >= 3 && yourName.trim().length >= 2
  return (
    <Card primary>
      <CardHeader icon={<PlusCircle size={16} style={{ color: 'var(--gold)' }} />} label="Create a League" description="Choose a tournament and invite your group." />
      <div className="flex flex-col gap-3.5">
        <Field label="League name" placeholder="e.g. Office Crew 2026" value={leagueName} onChange={setLeagueName} maxLength={40} />
        <Field label="Your name" placeholder="How you'll appear on the board" value={yourName} onChange={setYourName} maxLength={20} />
        <div>
          <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Tournament</label>
          <select value={tournamentIdx} onChange={event => setTournamentIdx(Number(event.target.value))} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: 'var(--bg)', border: '1.5px solid var(--border)', color: 'var(--text)' }}>
            {TOURNAMENTS.map((tournament, index) => <option key={`${tournament.code}-${tournament.season}`} value={index}>{tournament.label}</option>)}
          </select>
        </div>
        <button onClick={() => setShowAdvanced(value => !value)} className="flex items-center gap-1 text-xs w-fit" style={{ color: 'var(--text-subtle)' }}>
          {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {showAdvanced ? 'Hide options' : 'Add Telegram / WhatsApp Group Link'}
        </button>
        {showAdvanced && (
          <Field
            label="Telegram / WhatsApp group link (optional)"
            placeholder="https://t.me/... or https://chat.whatsapp.com/..."
            value={telegram}
            onChange={setTelegram}
          />
        )}
        {error && <p className="text-xs" style={{ color: 'var(--red)' }}>{error}</p>}
        <ActionButton onClick={handleCreate} disabled={!ready || loading} loading={loading} label="Create League" color="var(--accent)" />
      </div>
    </Card>
  )
}

function JoinLeagueCard() {
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
      if (!res.ok) return setError(data.error ?? 'Failed to join league')
      router.push(`/league/${data.league.invite_code}`)
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const ready = code.trim().length === 6 && yourName.trim().length >= 2
  return (
    <Card compact>
      <CardHeader icon={<Users size={15} style={{ color: 'var(--blue)' }} />} label="Join a League" description="Enter an invite code from a friend." />
      <div className="flex flex-col gap-3">
        <Field label="Invite code" placeholder="e.g. WOLF42" value={code} onChange={value => setCode(value.toUpperCase())} maxLength={6} mono />
        <Field label="Your name" placeholder="How you'll appear on the board" value={yourName} onChange={setYourName} maxLength={20} />
        {error && <p className="text-xs" style={{ color: 'var(--red)' }}>{error}</p>}
        <ActionButton onClick={handleJoin} disabled={!ready || loading} loading={loading} label="Join League" color="var(--blue)" />
      </div>
    </Card>
  )
}

function Card({ children, primary, compact }: { children: ReactNode; primary?: boolean; compact?: boolean }) {
  return (
    <div className={`${compact ? 'p-4' : 'p-5 sm:p-6'} rounded-lg`} style={{ background: 'var(--surface)', border: primary ? '1px solid rgba(63,185,80,0.28)' : '1px solid var(--border)' }}>
      {children}
    </div>
  )
}

function CardHeader({ icon, label, description }: { icon: ReactNode; label: string; description: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>{icon}</div>
      <div>
        <span className="font-semibold text-sm block" style={{ color: 'var(--text)' }}>{label}</span>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{description}</p>
      </div>
    </div>
  )
}

function Field({ label, placeholder, value, onChange, maxLength, mono }: { label: string; placeholder: string; value: string; onChange: (value: string) => void; maxLength?: number; mono?: boolean }) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <input type="text" placeholder={placeholder} value={value} onChange={event => onChange(event.target.value)} maxLength={maxLength} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: 'var(--bg)', border: '1.5px solid var(--border)', color: 'var(--text)', fontFamily: mono ? 'monospace' : 'inherit' }} />
    </div>
  )
}

function ActionButton({ onClick, disabled, loading, label, color }: { onClick: () => void; disabled: boolean; loading: boolean; label: string; color: string }) {
  return (
    <button onClick={onClick} disabled={disabled} className="w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2" style={{ background: disabled ? 'var(--surface-2)' : color, color: disabled ? 'var(--text-subtle)' : '#000' }}>
      {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
      {loading ? 'Loading...' : label}
    </button>
  )
}
