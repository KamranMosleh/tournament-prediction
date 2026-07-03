import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { PlayerAvatar } from '@/components/ui/PlayerAvatar'
import { PredictionBreakdown } from './PredictionBreakdown'
import type { PlayerScore } from '@/types'

interface Props {
  scores: PlayerScore[]
  currentPlayerId: string
}

const medals = ['🥇', '🥈', '🥉']

export function Leaderboard({ scores, currentPlayerId }: Props) {
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null)

  if (scores.length === 0) {
    return (
      <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
        <div className="text-4xl mb-3">🏆</div>
        <p className="font-medium">No scores yet</p>
        <p className="text-sm mt-1 opacity-70">Submit predictions before kick-off to earn points.</p>
      </div>
    )
  }

  const top = Math.max(...scores.map(s => s.total_points), 1)

  const toggleExpanded = (playerId: string) => {
    setExpandedPlayerId(prev => prev === playerId ? null : playerId)
  }

  return (
    <div className="flex flex-col gap-2">
      {scores.map((player, i) => {
        const isMe = player.player_id === currentPlayerId
        const barPct = (player.total_points / top) * 100
        const formPct = player.form_max_points > 0
          ? Math.round((player.form_points / player.form_max_points) * 100)
          : null
        const isLate = player.joined_match_day != null && player.joined_match_day > 1
        const isExpanded = expandedPlayerId === player.player_id

        return (
          <div key={player.player_id}
            onClick={() => toggleExpanded(player.player_id)}
            className="rounded-xl px-4 py-3 flex flex-col transition-all cursor-pointer hover:bg-opacity-95 select-none"
            style={{
              background: isMe ? 'rgba(63,185,80,0.07)' : 'var(--surface)',
              border: `1px solid ${isMe ? 'rgba(63,185,80,0.3)' : 'var(--border)'}`,
            }}>
            
            {/* Main player info row */}
            <div className="flex items-center gap-3 w-full">
              {/* Rank */}
              <div className="w-6 text-center shrink-0">
                {medals[i]
                  ? <span className="text-base leading-none">{medals[i]}</span>
                  : <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--text-subtle)' }}>{i + 1}</span>
                }
              </div>

              {/* Avatar */}
              <PlayerAvatar name={player.display_name} />

              {/* Name + bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm truncate"
                    style={{ color: isMe ? 'var(--accent)' : 'var(--text)' }}>
                    {player.display_name}
                  </span>
                  {isMe && (
                    <span className="text-xs px-1.5 py-0.5 rounded font-medium shrink-0"
                      style={{ background: 'rgba(63,185,80,0.15)', color: 'var(--accent)' }}>you</span>
                  )}
                  {isLate && (
                    <span className="text-xs px-1.5 py-0.5 rounded shrink-0"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-subtle)' }}>
                      md{player.joined_match_day}+
                    </span>
                  )}
                </div>
                {/* Points bar */}
                <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                  <div className="h-full rounded-full transition-all duration-700 bar-fill"
                    style={{
                      width: `${barPct}%`,
                      background: i === 0 ? 'var(--gold)' : isMe ? 'var(--accent)' : 'var(--border)',
                    }} />
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>
                  Match points {player.match_points} · Tournament bonus {player.tournament_points}
                </p>
                {/* Form % for late joiners */}
                {formPct !== null && isLate && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>
                    {formPct}% form since joining
                  </p>
                )}
              </div>

              {/* Points & Chevron indicator */}
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <div className="text-right">
                  <span className="text-lg font-bold tabular-nums"
                    style={{ color: i === 0 ? 'var(--gold)' : isMe ? 'var(--accent)' : 'var(--text)' }}>
                    {player.total_points}
                  </span>
                  <span className="text-xs ml-1" style={{ color: 'var(--text-subtle)' }}>pts</span>
                </div>
                <div style={{ color: 'var(--text-muted)' }} className="opacity-70">
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>
            </div>

            {/* Expandable breakdown panel */}
            {isExpanded && (
              <PredictionBreakdown player={player} />
            )}

          </div>
        )
      })}

      <p className="text-center text-xs pt-1" style={{ color: 'var(--text-subtle)' }}>
        Tie-break: most exact scores · md# = joined at matchday
      </p>
    </div>
  )
}

