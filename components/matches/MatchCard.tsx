'use client'

import { useState, useCallback } from 'react'
import { Check, Loader2, MapPin, Sparkles } from 'lucide-react'
import type { Match, MatchWithPrediction, AIDifficulty, MatchRecap, MatchRevealData, ScoringMode } from '@/types'
import { formatKickoff, timeUntil } from '@/lib/utils'
import { StatusPill } from '@/components/ui/StatusPill'
import { MatchRecapCard } from '@/components/matches/MatchRecapCard'
import { PredictionRevealPanel } from '@/components/matches/PredictionRevealPanel'
import { matchPoints } from '@/lib/scoring'
import { CountryName } from '@/components/ui/CountryName'

interface Props {
  match: MatchWithPrediction
  playerId: string
  recap?: MatchRecap | null
  reveal?: MatchRevealData
  tournamentMatches?: Match[]
  readOnly?: boolean
  scoringMode?: ScoringMode
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const DIFFICULTY_CONFIG: Record<AIDifficulty, { label: string; color: string; bg: string }> = {
  Easy:          { label: 'Easy to call',   color: 'var(--accent)', bg: 'var(--accent-glow)' },
  Tricky:        { label: 'Tricky',         color: 'var(--gold)',   bg: 'rgba(210,153,34,0.12)' },
  Unpredictable: { label: 'Unpredictable',  color: 'var(--red)',    bg: 'rgba(248,81,73,0.1)' },
}

export function MatchCard({
  match,
  playerId,
  recap,
  reveal,
  tournamentMatches = [],
  readOnly = false,
  scoringMode = 'multiplied',
}: Props) {
  const [homeVal, setHomeVal] = useState(match.prediction?.home_score?.toString() ?? '')
  const [awayVal, setAwayVal] = useState(match.prediction?.away_score?.toString() ?? '')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [insightExpanded, setInsightExpanded] = useState(false)

  const isLocked = match.status !== 'open' || readOnly
  const { date, time } = formatKickoff(match.kickoff_time)
  const countdown = timeUntil(match.kickoff_time)
  const diff = match.ai_difficulty ? DIFFICULTY_CONFIG[match.ai_difficulty] : null
  const homeRecentResults = getRecentTeamResults(tournamentMatches, match.home_team, match.id)
  const awayRecentResults = getRecentTeamResults(tournamentMatches, match.away_team, match.id)

  // Points earned on finished match
  let pointsEarned: number | null = null
  let pointsKind: 'exact' | 'difference' | 'outcome' | 'wrong' = 'wrong'
  if (match.status === 'finished' && match.prediction && match.home_score !== null && match.away_score !== null) {
    const p = match.prediction
    pointsEarned = matchPoints(
      p.home_score,
      p.away_score,
      match.home_score,
      match.away_score,
      match.stage,
      scoringMode
    )
    const predictedDifference = p.home_score - p.away_score
    const realDifference = match.home_score - match.away_score

    if (p.home_score === match.home_score && p.away_score === match.away_score) {
      pointsKind = 'exact'
    } else if (predictedDifference === realDifference) {
      pointsKind = 'difference'
    } else if (Math.sign(predictedDifference) === Math.sign(realDifference)) {
      pointsKind = 'outcome'
    }
  }

  const save = useCallback(async (home: string, away: string) => {
    if (home === '' || away === '' || isLocked) return
    setSaveState('saving')
    try {
      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: match.id, player_id: playerId, home_score: Number(home), away_score: Number(away) }),
      })
      setSaveState(res.ok ? 'saved' : 'error')
      if (res.ok) setTimeout(() => setSaveState('idle'), 2500)
    } catch { setSaveState('error') }
  }, [match.id, playerId, isLocked])

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
        <span className="flex-1 min-w-0 font-semibold text-sm text-right leading-tight" style={{ color: 'var(--text)' }}>
          <CountryName name={match.home_team} reverse className="justify-end" />
        </span>

        <div className="flex items-center gap-1.5 shrink-0">
          <ScoreBox value={homeVal} onChange={setHomeVal} onBlur={() => save(homeVal, awayVal)}
            disabled={isLocked} ariaLabel="Home score" />
          <div className="pitch-divider h-9" />
          <ScoreBox value={awayVal} onChange={setAwayVal} onBlur={() => save(homeVal, awayVal)}
            disabled={isLocked} ariaLabel="Away score" />
        </div>

        <span className="flex-1 min-w-0 font-semibold text-sm leading-tight" style={{ color: 'var(--text)' }}>
          <CountryName name={match.away_team} />
        </span>
      </div>

      {/* AI insight */}
      {match.ai_insight && match.status === 'open' && (
        <div className="px-4 pb-3">
          <div
            className="rounded-lg border"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}
          >
            <button
              type="button"
              onClick={() => setInsightExpanded(v => !v)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              <span className="flex items-center gap-2 min-w-0">
                <Sparkles size={11} className="shrink-0" style={{ color: 'var(--accent)' }} />
                <span className="truncate">Prematch Insight</span>
              </span>
              <span className="shrink-0" style={{ color: 'var(--text-subtle)' }}>
                {insightExpanded ? '▲' : '▼'}
              </span>
            </button>

            {insightExpanded && (
              <div className="px-3 pb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                <RecentResultsTable
                  homeTeam={match.home_team}
                  awayTeam={match.away_team}
                  homeResults={homeRecentResults}
                  awayResults={awayRecentResults}
                />
                <p className="mt-3 leading-relaxed italic">{match.ai_insight}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer: save state / pick / points */}
      {(saveState !== 'idle' || match.prediction || pointsEarned !== null) && (
        <div className="flex items-center justify-between px-4 py-2"
          style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <div className="text-sm flex items-center gap-1">
            {saveState === 'saving' && <><Loader2 size={13} className="animate-spin" style={{ color: 'var(--text-muted)' }} /><span style={{ color: 'var(--text-muted)' }}>Saving…</span></>}
            {saveState === 'saved'  && <><Check size={13} style={{ color: 'var(--accent)' }} /><span style={{ color: 'var(--accent)' }}>Saved</span></>}
            {saveState === 'error'  && <span style={{ color: 'var(--red)' }}>Save failed</span>}
            {saveState === 'idle' && match.prediction && (
              <span style={{ color: 'var(--text-subtle)' }}>
                Your pick: {match.prediction.home_score}–{match.prediction.away_score}
              </span>
            )}
          </div>
          {pointsEarned !== null && <PointsBadge pts={pointsEarned} kind={pointsKind} />}
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

type RecentTeamResult = {
  id: string
  badge: 'W' | 'D' | 'L'
  opponent: string
  score: string
}

function getRecentTeamResults(matches: Match[], team: string, currentMatchId: string): RecentTeamResult[] {
  return matches
    .filter(m =>
      m.id !== currentMatchId &&
      m.status === 'finished' &&
      m.home_score !== null &&
      m.away_score !== null &&
      (m.home_team === team || m.away_team === team)
    )
    .sort((a, b) => new Date(b.kickoff_time).getTime() - new Date(a.kickoff_time).getTime())
    .slice(0, 3)
    .map(m => {
      const isHome = m.home_team === team
      const teamScore = isHome ? m.home_score! : m.away_score!
      const opponentScore = isHome ? m.away_score! : m.home_score!
      const opponent = isHome ? m.away_team : m.home_team
      const badge = teamScore === opponentScore ? 'D' : teamScore > opponentScore ? 'W' : 'L'

      return {
        id: m.id,
        badge,
        opponent,
        score: `${teamScore}-${opponentScore}`,
      }
    })
}

function RecentResultsTable({
  homeTeam,
  awayTeam,
  homeResults,
  awayResults,
}: {
  homeTeam: string
  awayTeam: string
  homeResults: RecentTeamResult[]
  awayResults: RecentTeamResult[]
}) {
  const rowCount = Math.max(homeResults.length, awayResults.length, 1)

  return (
    <div className="overflow-hidden rounded-md border" style={{ borderColor: 'var(--border-subtle)' }}>
      <div className="grid grid-cols-2 text-[11px] font-semibold" style={{ color: 'var(--text)' }}>
        <div className="px-2 py-1.5 min-w-0 truncate" style={{ borderRight: '1px solid var(--border-subtle)' }}>
          {homeTeam}
        </div>
        <div className="px-2 py-1.5 min-w-0 truncate">{awayTeam}</div>
      </div>
      <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
        {Array.from({ length: rowCount }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-2"
            style={index > 0 ? { borderTop: '1px solid var(--border-subtle)' } : undefined}
          >
            <RecentResultCell result={homeResults[index]} />
            <RecentResultCell result={awayResults[index]} withDivider />
          </div>
        ))}
      </div>
    </div>
  )
}

function RecentResultCell({ result, withDivider = false }: { result?: RecentTeamResult; withDivider?: boolean }) {
  return (
    <div
      className="flex min-w-0 items-center gap-1.5 px-2 py-1.5"
      style={withDivider ? { borderLeft: '1px solid var(--border-subtle)' } : undefined}
    >
      {result ? (
        <>
          <span
            className="shrink-0 rounded px-1 text-[10px] font-bold"
            style={{
              background:
                result.badge === 'W'
                  ? 'var(--accent-glow)'
                  : result.badge === 'D'
                    ? 'rgba(210,153,34,0.12)'
                    : 'rgba(248,81,73,0.1)',
              color:
                result.badge === 'W'
                  ? 'var(--accent)'
                  : result.badge === 'D'
                    ? 'var(--gold)'
                    : 'var(--red)',
            }}
          >
            {result.badge}
          </span>
          <span className="shrink-0 tabular-nums" style={{ color: 'var(--text)' }}>
            {result.score}
          </span>
          <span className="min-w-0 truncate" title={result.opponent}>
            vs {result.opponent}
          </span>
        </>
      ) : (
        <span style={{ color: 'var(--text-subtle)' }}>No tournament results yet</span>
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

function PointsBadge({ pts, kind }: { pts: number; kind: 'exact' | 'difference' | 'outcome' | 'wrong' }) {
  const cfg =
    kind === 'exact' ? { label: `+${pts} pts`, color: 'var(--accent)',      bg: 'var(--accent-glow)',           border: 'rgba(63,185,80,0.3)' } :
    kind === 'difference' ? { label: `+${pts} pts`, color: 'var(--accent)', bg: 'rgba(63,185,80,0.12)', border: 'rgba(63,185,80,0.24)' } :
    kind === 'outcome' ? { label: `+${pts} ${pts === 1 ? 'pt' : 'pts'}`, color: 'var(--gold)', bg: 'rgba(210,153,34,0.12)', border: 'rgba(210,153,34,0.3)' } :
                         { label: '0 pts', color: 'var(--text-subtle)', bg: 'var(--surface-2)', border: 'var(--border)' }
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      {cfg.label}
    </span>
  )
}
