'use client'

import { useState, useCallback, useRef } from 'react'
import { Check, Loader2, MapPin, Sparkles } from 'lucide-react'
import type { Match, MatchWithPrediction, MatchPrediction, AIDifficulty, MatchRecap, MatchRevealData, ScoringMode } from '@/types'
import { formatKickoff, timeUntil } from '@/lib/utils'
import { StatusPill } from '@/components/ui/StatusPill'
import { MatchRecapCard } from '@/components/matches/MatchRecapCard'
import { PredictionRevealPanel } from '@/components/matches/PredictionRevealPanel'
import { predictionPoints, type MatchPointKind } from '@/lib/scoring'
import { CountryName } from '@/components/ui/CountryName'
import { formatCountryName } from '@/lib/country-flags'

interface Props {
  match: MatchWithPrediction
  playerId: string
  recap?: MatchRecap | null
  reveal?: MatchRevealData
  tournamentMatches?: Match[]
  readOnly?: boolean
  scoringMode?: ScoringMode
  onPredictionSaved?: (prediction: MatchPrediction) => void
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type SaveResponse = {
  prediction?: MatchPrediction
  verified?: boolean
  error?: string
}
type RecentResult = {
  id: string
  date: string
  opponent: string
  score: string
  result: 'W' | 'D' | 'L'
}

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
  onPredictionSaved,
}: Props) {
  const [homeVal, setHomeVal] = useState(match.prediction?.home_score?.toString() ?? '')
  const [awayVal, setAwayVal] = useState(match.prediction?.away_score?.toString() ?? '')
  const [penaltyWinner, setPenaltyWinner] = useState(match.prediction?.penalty_winner_team ?? '')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [lastVerifiedPrediction, setLastVerifiedPrediction] = useState<MatchPrediction | null>(null)
  const [insightExpanded, setInsightExpanded] = useState(false)
  const saveRequestRef = useRef(0)

  const isLocked = match.status !== 'open' || readOnly
  const { date, time } = formatKickoff(match.kickoff_time)
  const countdown = timeUntil(match.kickoff_time)
  const diff = match.ai_difficulty ? DIFFICULTY_CONFIG[match.ai_difficulty] : null
  const savedAtLabel = match.prediction ? formatSavedAt(match.prediction.submitted_at) : null
  const lastVerifiedSavedAtLabel = lastVerifiedPrediction ? formatSavedAt(lastVerifiedPrediction.submitted_at) : null
  const homeRecentResults = recentResultsForTeam(tournamentMatches, match.home_team, match.kickoff_time, match.id)
  const awayRecentResults = recentResultsForTeam(tournamentMatches, match.away_team, match.kickoff_time, match.id)
  const penaltyEligible = match.stage !== 'group'
  const hasFinishedScore = match.status === 'finished' && match.home_score !== null && match.away_score !== null
  const formScoresAreDraw =
    homeVal !== '' &&
    awayVal !== '' &&
    Number.isInteger(Number(homeVal)) &&
    Number.isInteger(Number(awayVal)) &&
    Number(homeVal) === Number(awayVal)
  const showPenaltyPicker = !isLocked && penaltyEligible && formScoresAreDraw
  const penaltyPickReady = penaltyWinner === match.home_team || penaltyWinner === match.away_team

  // Points earned on finished match
  let pointsEarned: number | null = null
  let pointsKind: MatchPointKind = 'wrong'
  let penaltyBonus = 0
  if (hasFinishedScore && match.prediction) {
    const p = match.prediction
    const scored = predictionPoints({
      predHome: p.home_score,
      predAway: p.away_score,
      realHome: match.home_score!,
      realAway: match.away_score!,
      stage: match.stage,
      mode: scoringMode,
      homeTeam: match.home_team,
      awayTeam: match.away_team,
      predictedPenaltyWinner: p.penalty_winner_team,
      resultWinnerTeam: match.result_winner_team,
      wentToPenalties: match.went_to_penalties,
    })
    pointsEarned = scored.total_points
    pointsKind = scored.kind
    penaltyBonus = scored.penalty_bonus
  }

  const save = useCallback(async (home: string, away: string, nextPenaltyWinner = penaltyWinner) => {
    if (home === '' || away === '' || isLocked) return
    const homeScore = Number(home)
    const awayScore = Number(away)

    if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) {
      setSaveState('error')
      return
    }

    const requiresPenaltyWinner = match.stage !== 'group' && homeScore === awayScore
    const cleanPenaltyWinner = requiresPenaltyWinner ? nextPenaltyWinner : ''
    if (
      requiresPenaltyWinner &&
      cleanPenaltyWinner !== match.home_team &&
      cleanPenaltyWinner !== match.away_team
    ) {
      return
    }
    const penaltyWinnerTeam = requiresPenaltyWinner ? cleanPenaltyWinner : null

    if (
      match.prediction &&
      homeScore === match.prediction.home_score &&
      awayScore === match.prediction.away_score &&
      (match.prediction.penalty_winner_team ?? null) === penaltyWinnerTeam
    ) {
      return
    }

    const requestId = saveRequestRef.current + 1
    saveRequestRef.current = requestId
    setSaveState('saving')
    try {
      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match_id: match.id,
          player_id: playerId,
          home_score: homeScore,
          away_score: awayScore,
          penalty_winner_team: penaltyWinnerTeam,
        }),
      })
      const data = await res.json().catch(() => ({})) as SaveResponse

      if (requestId !== saveRequestRef.current) return

      if (
        !res.ok ||
        !data.verified ||
        !data.prediction ||
        data.prediction.home_score !== homeScore ||
        data.prediction.away_score !== awayScore ||
        (data.prediction.penalty_winner_team ?? null) !== penaltyWinnerTeam
      ) {
        setSaveState('error')
        return
      }

      onPredictionSaved?.(data.prediction)
      setLastVerifiedPrediction(data.prediction)
      setPenaltyWinner(data.prediction.penalty_winner_team ?? '')
      setSaveState('saved')
      setTimeout(() => {
        if (saveRequestRef.current === requestId) setSaveState('idle')
      }, 2500)
    } catch {
      if (requestId === saveRequestRef.current) setSaveState('error')
    }
  }, [match.id, match.home_team, match.away_team, match.stage, match.prediction, playerId, isLocked, onPredictionSaved, penaltyWinner])

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
            disabled={isLocked} ariaLabel="Home score prediction" />
          <div className="pitch-divider h-9" />
          <ScoreBox value={awayVal} onChange={setAwayVal} onBlur={() => save(homeVal, awayVal)}
            disabled={isLocked} ariaLabel="Away score prediction" />
        </div>

        <span className="flex-1 min-w-0 font-semibold text-sm leading-tight" style={{ color: 'var(--text)' }}>
          <CountryName name={match.away_team} />
        </span>
      </div>

      {showPenaltyPicker && (
        <div className="px-4 pb-3">
          <div
            className="flex flex-col gap-2 rounded-lg border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}
          >
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gold)' }}>
              Penalties
            </span>
            <div className="grid grid-cols-2 gap-2 sm:min-w-72">
              {[match.home_team, match.away_team].map(team => {
                const selected = penaltyWinner === team
                return (
                  <button
                    key={team}
                    type="button"
                    onClick={() => {
                      setPenaltyWinner(team)
                      void save(homeVal, awayVal, team)
                    }}
                    aria-pressed={selected}
                    aria-label={`Pick ${formatCountryName(team)} to win on penalties`}
                    className="min-w-0 cursor-pointer rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors"
                    style={{
                      background: selected ? 'var(--accent-glow)' : 'var(--bg)',
                      border: `1.5px solid ${selected ? 'rgba(63,185,80,0.45)' : 'var(--border)'}`,
                      color: selected ? 'var(--accent)' : 'var(--text-muted)',
                    }}
                  >
                    <CountryName name={team} />
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

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
      {(saveState !== 'idle' || match.prediction || pointsEarned !== null || (showPenaltyPicker && !penaltyPickReady)) && (
        <div className="flex items-center justify-between px-4 py-2"
          style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <div className="text-sm flex items-center gap-1">
            {saveState === 'saving' && <><Loader2 size={13} className="animate-spin" style={{ color: 'var(--text-muted)' }} /><span style={{ color: 'var(--text-muted)' }}>Saving…</span></>}
            {saveState === 'saved'  && <><Check size={13} style={{ color: 'var(--accent)' }} /><span style={{ color: 'var(--accent)' }}>{lastVerifiedSavedAtLabel ? `Saved ${lastVerifiedSavedAtLabel}` : 'Saved'}</span></>}
            {saveState === 'error'  && <span style={{ color: 'var(--red)' }}>Save failed</span>}
            {saveState === 'idle' && showPenaltyPicker && !penaltyPickReady && (
              <span style={{ color: 'var(--gold)' }}>Pick shootout winner to save</span>
            )}
            {saveState === 'idle' && !(showPenaltyPicker && !penaltyPickReady) && match.prediction && (
              <span style={{ color: 'var(--text-subtle)' }}>
                Your pick: {match.prediction.home_score}-{match.prediction.away_score}
                {match.prediction.penalty_winner_team && (
                  <>
                    , pens: <CountryName name={match.prediction.penalty_winner_team} />
                  </>
                )}
                {savedAtLabel ? ` · Saved ${savedAtLabel}` : ''}
              </span>
            )}
          </div>
          {pointsEarned !== null && <PointsBadge pts={pointsEarned} kind={pointsKind} penaltyBonus={penaltyBonus} />}
        </div>
      )}

      {/* Actual result (when finished) */}
      {hasFinishedScore && (
        <div className="px-4 pb-3">
          <div
            className="flex flex-wrap items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-base font-bold"
            style={{
              background: match.went_to_penalties ? 'rgba(210,153,34,0.18)' : 'var(--accent-glow)',
              borderColor: match.went_to_penalties ? 'rgba(210,153,34,0.45)' : 'rgba(63,185,80,0.35)',
              color: match.went_to_penalties ? 'var(--gold)' : 'var(--accent)',
            }}
          >
            <span className="text-xs font-black uppercase tracking-wider" style={{ color: match.went_to_penalties ? 'var(--gold)' : 'var(--accent)' }}>
              Final result
            </span>
            <span className="text-lg font-black tabular-nums" style={{ color: 'var(--text)' }}>
              {match.home_score}-{match.away_score}
            </span>
            {match.went_to_penalties && match.result_winner_team && (
              <>
                <span style={{ color: 'var(--text-subtle)' }}>·</span>
                <CountryName name={match.result_winner_team} />
                <span>advanced on pens</span>
              </>
            )}
          </div>
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

function RecentResultsTable({
  homeTeam,
  awayTeam,
  homeResults,
  awayResults,
}: {
  homeTeam: string
  awayTeam: string
  homeResults: RecentResult[]
  awayResults: RecentResult[]
}) {
  if (homeResults.length === 0 && awayResults.length === 0) {
    return (
      <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
        Recent tournament results will appear here once these teams have played.
      </p>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <RecentResultColumn team={homeTeam} results={homeResults} />
      <RecentResultColumn team={awayTeam} results={awayResults} />
    </div>
  )
}

function RecentResultColumn({ team, results }: { team: string; results: RecentResult[] }) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 font-semibold" style={{ color: 'var(--text)' }}>
        <CountryName name={team} />
      </p>
      {results.length === 0 ? (
        <p style={{ color: 'var(--text-subtle)' }}>No recent results</p>
      ) : (
        <div className="flex flex-col gap-1">
          {results.map(result => (
            <div key={result.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate" style={{ color: 'var(--text-muted)' }}>
                {result.date} vs <CountryName name={result.opponent} />
              </span>
              <span className="shrink-0 tabular-nums" style={{ color: resultColor(result.result) }}>
                {result.result} {result.score}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function recentResultsForTeam(
  matches: Match[],
  team: string,
  beforeKickoff: string,
  currentMatchId: string,
  limit = 3
): RecentResult[] {
  const beforeTime = new Date(beforeKickoff).getTime()

  return matches
    .filter(candidate =>
      candidate.id !== currentMatchId &&
      candidate.status === 'finished' &&
      candidate.home_score !== null &&
      candidate.away_score !== null &&
      new Date(candidate.kickoff_time).getTime() < beforeTime &&
      (candidate.home_team === team || candidate.away_team === team)
    )
    .sort((a, b) => new Date(b.kickoff_time).getTime() - new Date(a.kickoff_time).getTime())
    .slice(0, limit)
    .map(candidate => {
      const isHome = candidate.home_team === team
      const ownScore = isHome ? candidate.home_score! : candidate.away_score!
      const opponentScore = isHome ? candidate.away_score! : candidate.home_score!
      const opponent = isHome ? candidate.away_team : candidate.home_team
      const { date } = formatKickoff(candidate.kickoff_time)

      return {
        id: candidate.id,
        date,
        opponent,
        score: `${ownScore}-${opponentScore}`,
        result: ownScore > opponentScore ? 'W' : ownScore < opponentScore ? 'L' : 'D',
      }
    })
}

function resultColor(result: RecentResult['result']): string {
  if (result === 'W') return 'var(--accent)'
  if (result === 'L') return 'var(--red)'
  return 'var(--gold)'
}

function formatSavedAt(iso: string): string | null {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null

  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
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

function PointsBadge({ pts, kind, penaltyBonus }: { pts: number; kind: MatchPointKind; penaltyBonus: number }) {
  const label = penaltyBonus > 0
    ? `+${pts} pts (+${penaltyBonus} pens)`
    : kind === 'outcome'
      ? `+${pts} ${pts === 1 ? 'pt' : 'pts'}`
      : kind === 'wrong'
        ? '0 pts'
        : `+${pts} pts`
  const cfg =
    kind === 'exact' ? { color: 'var(--accent)',      bg: 'var(--accent-glow)',           border: 'rgba(63,185,80,0.3)' } :
    kind === 'difference' ? { color: 'var(--accent)', bg: 'rgba(63,185,80,0.12)', border: 'rgba(63,185,80,0.24)' } :
    kind === 'outcome' ? { color: 'var(--gold)', bg: 'rgba(210,153,34,0.12)', border: 'rgba(210,153,34,0.3)' } :
                         { color: 'var(--text-subtle)', bg: 'var(--surface-2)', border: 'var(--border)' }
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      {label}
    </span>
  )
}
