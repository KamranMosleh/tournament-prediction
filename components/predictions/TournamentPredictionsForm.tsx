'use client'

import { useState } from 'react'
import { Trophy, User, Check, Loader2, Lock } from 'lucide-react'
import type { TournamentPrediction } from '@/types'

const WORLD_CUP_2026_TEAMS = [
  'Argentina', 'Australia', 'Belgium', 'Brazil', 'Cameroon', 'Canada',
  'Chile', 'Colombia', 'Croatia', 'Denmark', 'Ecuador', 'Egypt',
  'England', 'France', 'Germany', 'Ghana', 'Honduras', 'Hungary',
  'Iran', 'Italy', 'Japan', 'Mexico', 'Morocco', 'Netherlands',
  'New Zealand', 'Nigeria', 'Panama', 'Paraguay', 'Peru', 'Poland',
  'Portugal', 'Qatar', 'Saudi Arabia', 'Senegal', 'Serbia', 'Slovenia',
  'South Korea', 'Spain', 'Switzerland', 'Turkey', 'Ukraine', 'Uruguay',
  'USA', 'Venezuela',
]

interface Props {
  existing: TournamentPrediction | null
  playerId: string
  leagueId: string
  sessionToken: string
  locked: boolean
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function TournamentPredictionsForm({ existing, playerId, leagueId, sessionToken, locked }: Props) {
  const [winner, setWinner] = useState(existing?.winner_team ?? '')
  const [scorer, setScorer] = useState(existing?.top_scorer_name ?? '')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [filterText, setFilterText] = useState('')

  const filteredTeams = WORLD_CUP_2026_TEAMS.filter(t =>
    t.toLowerCase().includes(filterText.toLowerCase())
  )

  const save = async () => {
    if (!winner || !scorer) return
    setSaveState('saving')
    try {
      const res = await fetch('/api/tournament-predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-token': sessionToken },
        body: JSON.stringify({ player_id: playerId, league_id: leagueId, winner_team: winner, top_scorer_name: scorer }),
      })
      setSaveState(res.ok ? 'saved' : 'error')
      if (res.ok) setTimeout(() => setSaveState('idle'), 3000)
    } catch {
      setSaveState('error')
    }
  }

  if (locked) {
    return (
      <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Lock size={16} style={{ color: 'var(--gold)' }} />
          <h3 className="font-semibold" style={{ color: 'var(--text)' }}>Tournament Picks — Locked</h3>
        </div>
        {existing ? (
          <div className="flex flex-col gap-3">
            <PredRow icon={<Trophy size={14} style={{ color: 'var(--gold)' }} />} label="Tournament winner" value={existing.winner_team} />
            <PredRow icon={<User size={14} style={{ color: 'var(--blue)' }} />} label="Golden Boot" value={existing.top_scorer_name} />
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No tournament picks submitted.</p>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-1">
        <Trophy size={16} style={{ color: 'var(--gold)' }} />
        <h3 className="font-semibold" style={{ color: 'var(--text)' }}>Tournament Picks</h3>
      </div>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        Lock in before the first kick-off. Worth up to 8 bonus points.
      </p>

      {/* Winner select */}
      <div className="mb-4">
        <label className="text-xs font-medium uppercase tracking-wider block mb-2" style={{ color: 'var(--text-muted)' }}>
          🏆 Tournament Winner — 5 pts
        </label>
        <div className="relative">
          <input
            type="text"
            placeholder="Search team…"
            value={winner || filterText}
            onChange={e => {
              if (winner) setWinner('')
              setFilterText(e.target.value)
            }}
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
            style={{
              background: 'var(--bg)',
              border: '1.5px solid var(--border)',
              color: 'var(--text)',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
            onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
          />
          {!winner && filterText && (
            <div className="absolute z-10 w-full mt-1 rounded-lg overflow-hidden shadow-xl"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', maxHeight: '200px', overflowY: 'auto' }}>
              {filteredTeams.slice(0, 12).map(team => (
                <button
                  key={team}
                  onClick={() => { setWinner(team); setFilterText('') }}
                  className="w-full text-left px-3 py-2 text-sm transition-colors"
                  style={{ color: 'var(--text)' }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.background = 'var(--accent-glow)' }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent' }}
                >
                  {team}
                </button>
              ))}
              {filteredTeams.length === 0 && (
                <div className="px-3 py-2 text-sm" style={{ color: 'var(--text-muted)' }}>No teams found</div>
              )}
            </div>
          )}
        </div>
        {winner && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm font-medium" style={{ color: 'var(--accent)' }}>✓ {winner}</span>
            <button onClick={() => setWinner('')} className="text-xs" style={{ color: 'var(--text-muted)' }}>change</button>
          </div>
        )}
      </div>

      {/* Golden Boot */}
      <div className="mb-6">
        <label className="text-xs font-medium uppercase tracking-wider block mb-2" style={{ color: 'var(--text-muted)' }}>
          ⚽ Golden Boot (Top Scorer) — 3 pts
        </label>
        <input
          type="text"
          placeholder="Player name…"
          value={scorer}
          onChange={e => setScorer(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
          style={{ background: 'var(--bg)', border: '1.5px solid var(--border)', color: 'var(--text)' }}
          onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
          onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
        />
      </div>

      {/* Save button */}
      <button
        onClick={save}
        disabled={!winner || !scorer || saveState === 'saving'}
        className="w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all"
        style={{
          background: !winner || !scorer ? 'var(--surface-2)' : 'var(--accent)',
          color: !winner || !scorer ? 'var(--text-subtle)' : '#000',
          cursor: !winner || !scorer ? 'not-allowed' : 'pointer',
        }}
      >
        {saveState === 'saving' && <Loader2 size={14} className="animate-spin" />}
        {saveState === 'saved' && <Check size={14} />}
        {saveState === 'saved' ? 'Picks saved!' : saveState === 'saving' ? 'Saving…' : 'Save my picks'}
      </button>

      {saveState === 'error' && (
        <p className="text-xs text-center mt-2" style={{ color: 'var(--red)' }}>Failed to save. Try again.</p>
      )}
    </div>
  )
}

function PredRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--surface-2)' }}>
      {icon}
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="ml-auto font-medium text-sm" style={{ color: 'var(--text)' }}>{value}</span>
    </div>
  )
}
