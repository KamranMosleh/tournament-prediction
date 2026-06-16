'use client'

import { useState, useCallback } from 'react'
import { Check, Loader2, MapPin, Sparkles } from 'lucide-react'
import type { MatchWithPrediction, AIDifficulty, MatchRecap, MatchRevealData } from '@/types'
import { formatKickoff, timeUntil } from '@/lib/utils'
import { StatusPill } from '@/components/ui/StatusPill'
import { MatchRecapCard } from '@/components/matches/MatchRecapCard'
import { PredictionRevealPanel } from '@/components/matches/PredictionRevealPanel'

interface Props {
  match: MatchWithPrediction
  playerId: string
  sessionToken: string
  recap?: MatchRecap | null
  reveal?: MatchRevealData
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const DIFFICULTY_CONFIG: Record<AIDifficulty, { label: string; color: string; bg: string }> = {
  Easy:          { label: 'Easy to call',   color: 'var(--accent)', bg: 'var(--accent-glow)' },
  Tricky:        { label: 'Tricky',         color: 'var(--gold)',   bg: 'rgba(210,153,34,0.12)' },
  Unpredictable: { label: 'Unpredictable',  color: 'var(--red)',    bg: 'rgba(248,81,73,0.1)' },
}

export function MatchCard({ match, playerId, sessionToken, recap, reveal }: Props) {
  const [homeVal, setHomeVal] = useState(match.prediction?.home_score?.toString() ?? '')
  const [awayVal, setAwayVal] = useState(match.prediction?.away_score?.toString() ?? '')
  const [saveState, setSaveState] = useState<SaveState>('idle')

  const isLocked = match.status !== 'open'
  const { date, time } = formatKickoff(match.kickoff_time)
  const countdown = timeUntil(match.kickoff_time)
  const diff = match.ai_difficulty ? DIFFICULTY_CONFIG[match.ai_difficulty] : null

  // Points earned on finished match
  let pointsEarned: number | null = null
  if (match.status === 'finished' && match.prediction && match.home_score !== null && match.away_score !== null) {
    const p = match.prediction
    if (p.home_score === match.home_score && p.away_score === match.away_score) pointsEarned = 3
    else if (Math.sign(p.home_score - p.away_score) === Math.sign(match.home_score - match.away_score)) pointsEarned = 1
    else pointsEarned = 0
  }

  const save = useCallback(async (home: string, away: string) => {
    if (home === '' || away === '' || isLocked) return
    setSaveState('saving')
    try {
      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-token': sessionToken },
        body: JSON.stringify({ match_id: match.id, player_id: playerId, home_score: Number(home), away_score: Number(away) }),
      })
      setSaveState(res.ok ? 'saved' : 'error')
      if (res.ok) setTimeout(() => setSaveState('idle'), 2500)
    } catch { setSaveState('error') }
  }, [match.id, playerId, sessionToken, isLocked])

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: 'var(--surface)', border: `1px solid ${isLocked ? 'var(--border-subtle)' : 'var(--border)'}` }}>

      {/* Top bar: status + time + difficulty */}
      <div className="flex items-center justify-between px-4 py-2 gap-2"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <StatusPill status={match.status} />
          {countdown && <span className="text-xs font-medium shrink-0" style={{ color: 'var(--accent)' }}>in {countdown}</span>}
          {diff && match.status === 'open' && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
              style={{ background: diff.bg, color: diff.color }}>
              {diff.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs shrink-0" style={{ color: 'var(--text-subtle)' }}>
          {match.venue && <><MapPin size={9} /><span className="hidden sm:inline">{match.venue} · </span></>}
          <span>{date} {time}</span>
        </div>
      </div>

      {/* Teams + score inputs */}
      <div className="flex items-center gap-3 px-4 py-4">
        <span className="flex-1 font-semibold text-sm text-right leading-tight" style={{ color: 'var(--text)' }}>
          {match.home_team}
        </span>

        <div className="flex items-center gap-1.5 shrink-0">
          <ScoreBox value={homeVal} onChange={setHomeVal} onBlur={() => save(homeVal, awayVal)}
            disabled={isLocked} ariaLabel="Home score" />
          <div className="pitch-divider h-9" />
          <ScoreBox value={awayVal} onChange={setAwayVal} onBlur={() => save(homeVal, awayVal)}
            disabled={isLocked} ariaLabel="Away score" />
        </div>

        <span className="flex-1 font-semibold text-sm leading-tight" style={{ color: 'var(--text)' }}>
          {match.away_team}
        </span>
      </div>

      {/* AI insight */}
      {match.ai_insight && match.status === 'open' && (
        <div className="px-4 pb-3">
          <div className="flex gap-2 px-3 py-2 rounded-lg text-xs leading-relaxed italic"
            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', borderLeft: '2px solid var(--border)' }}>
            <Sparkles size={11} className="shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
            <span>{match.ai_insight}</span>
          </div>
        </div>
      )}

      {/* Footer: save state / pick / points */}
      {(saveState !== 'idle' || match.prediction || pointsEarned !== null) && (
        <div className="flex items-center justify-between px-4 py-2"
          style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <div className="text-xs flex items-center gap-1">
            {saveState === 'saving' && <><Loader2 size={11} className="animate-spin" style={{ color: 'var(--text-muted)' }} /><span style={{ color: 'var(--text-muted)' }}>Saving…</span></>}
            {saveState === 'saved'  && <><Check size={11} style={{ color: 'var(--accent)' }} /><span style={{ color: 'var(--accent)' }}>Saved</span></>}
            {saveState === 'error'  && <span style={{ color: 'var(--red)' }}>Save failed</span>}
            {saveState === 'idle' && match.prediction && (
              <span style={{ color: 'var(--text-subtle)' }}>
                Your pick: {match.prediction.home_score}–{match.prediction.away_score}
              </span>
            )}
          </div>
          {pointsEarned !== null && <PointsBadge pts={pointsEarned} />}
        </div>
      )}

      {/* Actual result (when finished) */}
      {match.status === 'finished' && match.home_score !== null && (
        <div className="px-4 pb-2 text-center text-xs" style={{ color: 'var(--text-subtle)' }}>
          Final: {match.home_score}–{match.away_score}
        </div>
      )}

      {/* Prediction reveal: aggregate while open, named picks after lock */}
      {reveal && <PredictionRevealPanel match={match} reveal={reveal} />}

      {/* Per-player roast recap (shown after match finishes, once generated) */}
      {recap && match.status === 'finished' && (
        <MatchRecapCard recap={recap} />
      )}
    </div>
  )
}

function ScoreBox({ value, onChange, onBlur, disabled, ariaLabel }: {
  value: string; onChange: (v: string) => void; onBlur: () => void; disabled: boolean; ariaLabel: string
}) {
  return (
    <input type="number" min={0} max={20} value={value} placeholder="–"
      onChange={e => onChange(e.target.value)}
      onBlur={onBlur}
      disabled={disabled}
      aria-label={ariaLabel}
      className="w-10 h-10 rounded-lg text-center text-lg font-bold tabular-nums outline-none transition-all"
      style={{
        background: disabled ? 'var(--surface-2)' : 'var(--bg)',
        border: `1.5px solid ${disabled ? 'var(--border-subtle)' : 'var(--border)'}`,
        color: disabled ? 'var(--text-muted)' : 'var(--text)',
        cursor: disabled ? 'not-allowed' : 'text',
      }}
      onFocus={e => { if (!disabled) e.target.style.borderColor = 'var(--accent)' }}
      onBlurCapture={e => { e.target.style.borderColor = disabled ? 'var(--border-subtle)' : 'var(--border)' }}
    />
  )
}

function PointsBadge({ pts }: { pts: number }) {
  const cfg =
    pts === 3 ? { label: '+3 pts', color: 'var(--accent)',      bg: 'var(--accent-glow)',           border: 'rgba(63,185,80,0.3)' } :
    pts === 1 ? { label: '+1 pt',  color: 'var(--gold)',        bg: 'rgba(210,153,34,0.12)',         border: 'rgba(210,153,34,0.3)' } :
                { label: '0 pts',  color: 'var(--text-subtle)', bg: 'var(--surface-2)',              border: 'var(--border)' }
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      {cfg.label}
    </span>
  )
}
