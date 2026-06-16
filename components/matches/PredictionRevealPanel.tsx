'use client'

import { useState } from 'react'
import type { Match, MatchRevealData } from '@/types'

interface Props {
  match: Match
  reveal: MatchRevealData
}

export function PredictionRevealPanel({ match, reveal }: Props) {
  const [expanded, setExpanded] = useState(false)
  const isOpen = match.status === 'open'

  return (
    <div className="px-4 pb-3">
      <div
        className="rounded-lg border"
        style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}
      >
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          <span>
            {isOpen
              ? 'Prediction Sentiment — names hidden until kick-off'
              : match.status === 'finished'
                ? 'Prediction Reveal — with points'
                : 'Prediction Reveal — locked picks'}
          </span>
          <span style={{ color: 'var(--text-subtle)' }}>{expanded ? '▲' : '▼'}</span>
        </button>

        {expanded && (
          <div className="px-3 pb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            {isOpen ? <OpenAggregate reveal={reveal} /> : <NamedEntries reveal={reveal} showPoints={match.status === 'finished'} />}
          </div>
        )}
      </div>
    </div>
  )
}

function OpenAggregate({ reveal }: { reveal: MatchRevealData }) {
  const o = reveal.aggregate.outcome_counts
  return (
    <div className="flex flex-col gap-2">
      <p>
        {reveal.aggregate.predicted_count}/{reveal.aggregate.total_players} players submitted picks
        {reveal.aggregate.missing_count > 0 ? ` (${reveal.aggregate.missing_count} missing)` : ''}
      </p>
      {reveal.aggregate.top_scores.length > 0 ? (
        <p>
          Most-picked scores: {reveal.aggregate.top_scores.map(s => `${s.score} (${s.count})`).join(', ')}
        </p>
      ) : (
        <p>No picks yet for this match.</p>
      )}
      <p>
        Outcome split: Home {o.home_win} · Draw {o.draw} · Away {o.away_win}
      </p>
      <p style={{ color: 'var(--text-subtle)' }}>
        Player names stay hidden until kick-off lock.
      </p>
    </div>
  )
}

function NamedEntries({ reveal, showPoints }: { reveal: MatchRevealData; showPoints: boolean }) {
  if (reveal.entries.length === 0) {
    return <p>No predictions were submitted for this match.</p>
  }

  return (
    <div className="flex flex-col gap-1.5">
      {reveal.entries.map(entry => (
        <div key={entry.player_id} className="flex items-center justify-between gap-2">
          <span style={{ color: 'var(--text)' }}>{entry.player_name}</span>
          <span>
            {entry.score}
            {showPoints && entry.points !== null ? ` · ${entry.points} pts` : ''}
          </span>
        </div>
      ))}
    </div>
  )
}
