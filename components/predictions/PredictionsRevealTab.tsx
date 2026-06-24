'use client'

import { useMemo, useState } from 'react'
import type { Match, MatchRevealData, Player, TournamentPrediction } from '@/types'
import { PredictionRevealPanel } from '@/components/matches/PredictionRevealPanel'
import { isWithinLastHours } from '@/lib/utils'

type Filter = 'all' | 'open' | 'locked' | 'finished' | 'last_24h'

interface Props {
  matches: Match[]
  reveals: Map<string, MatchRevealData>
  players: Player[]
  tournamentPredictions: TournamentPrediction[]
}

export function PredictionsRevealTab({ matches, reveals, players, tournamentPredictions }: Props) {
  const [filter, setFilter] = useState<Filter>('all')

  const sortedMatches = useMemo(
    () => [...matches].sort((a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime()),
    [matches]
  )

  const finishedMatches = useMemo(
    () => sortedMatches.filter(match => match.status === 'finished'),
    [sortedMatches]
  )
  const last24hFinishedMatches = finishedMatches.filter(match => isWithinLastHours(match.kickoff_time, 24))
  const filteredMatches = filter === 'last_24h'
    ? last24hFinishedMatches
    : sortedMatches.filter(m => filter === 'all' || m.status === filter)

  const playerNameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of players) map.set(p.id, p.display_name)
    return map
  }, [players])

  const tournamentRows = useMemo(() => {
    return players.map(p => {
      const pick = tournamentPredictions.find(tp => tp.player_id === p.id)
      return {
        player: p.display_name,
        winner: pick?.winner_team || '—',
        scorer: pick?.top_scorer_name || '—',
      }
    })
  }, [players, tournamentPredictions])

  return (
    <div className="flex flex-col gap-5">
      {/* Visibility rules explanation */}
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-subtle)' }}>
        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>How reveal works: </span>
        While a match is open, only anonymous score/outcome totals are shown — no names.
        Once a match locks at kick-off, named picks become visible.
        After a match finishes, points earned per player are shown alongside their pick.
        Tournament winner and top-scorer picks are always visible to everyone in the league.
      </p>

      <section className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
          Tournament Picks (Visible to League)
        </h3>
        <div className="flex flex-col gap-2">
          {tournamentRows.map(row => (
            <div key={row.player} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="font-semibold" style={{ color: 'var(--text)' }}>{row.player}</span>
              <span>Winner: {row.winner}</span>
              <span style={{ color: 'var(--text-subtle)' }}>·</span>
              <span>Top scorer: {row.scorer}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            Match Predictions Reveal
          </h3>
          <div className="flex flex-wrap items-center justify-end gap-1">
            {(['all', 'open', 'locked', 'finished'] as Filter[]).map(opt => (
              <button
                key={opt}
                onClick={() => setFilter(opt)}
                className="px-2 py-1 text-xs rounded-md"
                style={{
                  background: filter === opt ? 'var(--accent-glow)' : 'var(--surface-2)',
                  color: filter === opt ? 'var(--accent)' : 'var(--text-subtle)',
                }}
              >
                {opt}
              </button>
            ))}
            {last24hFinishedMatches.length > 0 && (
              <button
                onClick={() => setFilter('last_24h')}
                className="px-2 py-1 text-xs rounded-md"
                style={{
                  background: filter === 'last_24h' ? 'var(--accent-glow)' : 'var(--surface-2)',
                  color: filter === 'last_24h' ? 'var(--accent)' : 'var(--text-subtle)',
                }}
              >
                last 24h ({last24hFinishedMatches.length})
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {filteredMatches.map(match => {
            const reveal = reveals.get(match.id)
            if (!reveal) return null
            return (
              <div key={match.id} className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="px-4 py-2 text-xs" style={{ color: 'var(--text-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                  {match.home_team} vs {match.away_team}
                </div>
                <PredictionRevealPanel match={match} reveal={reveal} />
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
