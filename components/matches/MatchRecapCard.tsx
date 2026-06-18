'use client'

import { useState } from 'react'
import { Flame } from 'lucide-react'
import type { MatchRecap } from '@/types'

interface Props {
  recap: MatchRecap
}

export function MatchRecapCard({ recap }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="mx-4 mb-3 rounded-lg overflow-hidden cursor-pointer select-none"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}
      onClick={() => setExpanded(e => !e)}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: expanded ? '1px solid var(--border-subtle)' : 'none' }}
      >
        <div className="flex items-center gap-1.5">
          <Flame size={11} style={{ color: 'var(--gold)' }} />
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            Match Recap
          </span>
        </div>
        <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {/* Headline — always visible */}
      <p
        className="px-3 py-2 text-xs italic leading-relaxed"
        style={{ color: 'var(--text-muted)' }}
      >
        {recap.headline}
      </p>

      {/* Per-player roasts — expanded only */}
      {expanded && recap.roasts.length > 0 && (
        <div
          className="flex flex-col divide-y"
          style={{ borderTop: '1px solid var(--border-subtle)', '--tw-divide-opacity': 1 } as React.CSSProperties}
        >
          {recap.roasts.map((r, i) => (
            <div key={i} className="px-3 py-2 flex flex-col gap-0.5">
              {/* Player name + prediction stats row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                  {r.player_name}
                </span>
                {r.prediction ? (
                  <>
                    <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                      predicted {r.prediction}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>·</span>
                  </>
                ) : (
                  <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>no prediction ·</span>
                )}
                <PointsBadge pts={r.points} hasPrediction={r.prediction !== null} />
              </div>
              {/* Roast line */}
              <p className="text-xs italic leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {r.roast}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PointsBadge({ pts, hasPrediction }: { pts: number; hasPrediction: boolean }) {
  if (!hasPrediction) return null
  const cfg =
    pts >= 3
      ? { label: `+${pts} pts`, color: 'var(--accent)', bg: 'var(--accent-glow)' }
      : pts > 0
      ? { label: `+${pts} ${pts === 1 ? 'pt' : 'pts'}`, color: 'var(--gold)', bg: 'rgba(210,153,34,0.12)' }
      : { label: '0 pts', color: 'var(--text-subtle)', bg: 'var(--surface-2)' }
  return (
    <span
      className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      {cfg.label}
    </span>
  )
}
