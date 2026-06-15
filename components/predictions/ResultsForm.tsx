'use client'

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import type { Match } from '@/types'
import { formatKickoff } from '@/lib/utils'

interface Props {
  matches: Match[]
  sessionToken: string
}

export function ResultsForm({ matches, sessionToken }: Props) {
  const pending = matches.filter(m => m.status === 'locked' || (m.status === 'finished' && m.home_score !== null))
  const locked = matches.filter(m => m.status === 'locked')

  if (locked.length === 0 && pending.length === 0) {
    return (
      <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
        <div className="text-4xl mb-3">⏳</div>
        <p className="font-medium">No matches to update yet</p>
        <p className="text-sm mt-1">Results appear here once matches kick off.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(210,153,34,0.1)', border: '1px solid rgba(210,153,34,0.25)', color: 'var(--gold)' }}>
        🔒 Admin view — enter the final scores after each match finishes.
      </div>

      {locked.map(match => (
        <ResultRow key={match.id} match={match} sessionToken={sessionToken} />
      ))}

      {pending.filter(m => m.status === 'finished').length > 0 && (
        <>
          <h4 className="text-xs font-semibold uppercase tracking-widest pt-2" style={{ color: 'var(--text-muted)' }}>
            Already entered (click to correct)
          </h4>
          {pending.filter(m => m.status === 'finished').map(match => (
            <ResultRow key={match.id} match={match} sessionToken={sessionToken} />
          ))}
        </>
      )}
    </div>
  )
}

function ResultRow({ match, sessionToken }: { match: Match; sessionToken: string }) {
  const [home, setHome] = useState(match.home_score?.toString() ?? '')
  const [away, setAway] = useState(match.away_score?.toString() ?? '')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const { date, time } = formatKickoff(match.kickoff_time)

  const submit = async () => {
    if (home === '' || away === '') return
    setState('saving')
    try {
      const res = await fetch('/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-token': sessionToken },
        body: JSON.stringify({ match_id: match.id, home_score: Number(home), away_score: Number(away) }),
      })
      setState(res.ok ? 'saved' : 'error')
      if (res.ok) setTimeout(() => setState('idle'), 3000)
    } catch {
      setState('error')
    }
  }

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{date} · {time}</span>
        {match.status === 'finished' && (
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
            Entered
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="flex-1 text-sm font-medium text-right" style={{ color: 'var(--text)' }}>{match.home_team}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          <input type="number" min={0} max={20} value={home} onChange={e => setHome(e.target.value)}
            className="w-10 h-10 rounded-lg text-center text-lg font-bold tabular-nums outline-none"
            style={{ background: 'var(--bg)', border: '1.5px solid var(--border)', color: 'var(--text)' }}
          />
          <span className="font-bold" style={{ color: 'var(--text-subtle)' }}>–</span>
          <input type="number" min={0} max={20} value={away} onChange={e => setAway(e.target.value)}
            className="w-10 h-10 rounded-lg text-center text-lg font-bold tabular-nums outline-none"
            style={{ background: 'var(--bg)', border: '1.5px solid var(--border)', color: 'var(--text)' }}
          />
        </div>
        <span className="flex-1 text-sm font-medium" style={{ color: 'var(--text)' }}>{match.away_team}</span>
        <button
          onClick={submit}
          disabled={home === '' || away === '' || state === 'saving'}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all shrink-0"
          style={{
            background: state === 'saved' ? 'var(--accent-glow)' : 'var(--accent)',
            color: state === 'saved' ? 'var(--accent)' : '#000',
          }}
        >
          {state === 'saving' ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          {state === 'saved' ? 'Saved' : 'Save'}
        </button>
      </div>
      {state === 'error' && (
        <p className="text-xs mt-2 text-center" style={{ color: 'var(--red)' }}>Failed to save</p>
      )}
    </div>
  )
}
