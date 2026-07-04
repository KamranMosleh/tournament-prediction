'use client'

import { useEffect, useRef, useState } from 'react'
import { CalendarClock, Eye, EyeOff, Layers3 } from 'lucide-react'
import { MatchCard } from './MatchCard'
import { stageLabel, stageOrder } from '@/lib/utils'
import type { MatchWithPrediction, MatchPrediction, MatchRecap, MatchRevealData, MatchStage, ScoringMode } from '@/types'

interface Props {
  matches: MatchWithPrediction[]
  playerId: string
  recaps?: MatchRecap[]
  reveals?: Map<string, MatchRevealData>
  isAdmin?: boolean
  canImportFixtures?: boolean
  onImportFixtures?: () => void
  syncState?: 'idle' | 'syncing' | 'success' | 'error'
  syncMessage?: string | null
  readOnly?: boolean
  scoringMode?: ScoringMode
  onPredictionSaved?: (prediction: MatchPrediction) => void
}

export function MatchList({
  matches,
  playerId,
  recaps = [],
  reveals = new Map<string, MatchRevealData>(),
  isAdmin = false,
  canImportFixtures = false,
  onImportFixtures,
  syncState = 'idle',
  syncMessage = null,
  readOnly = false,
  scoringMode = 'multiplied',
  onPredictionSaved,
}: Props) {
  const [sortByKickoff, setSortByKickoff] = useState(true)
  const [showFinished, setShowFinished] = useState(() => hasMatchToday(matches))
  const todayMatchRef = useRef<HTMLDivElement | null>(null)
  const initialTodayScrollDoneRef = useRef(false)

  if (matches.length === 0) {
    return (
      <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
        <div className="text-4xl mb-3">📅</div>
        <p className="font-medium">No matches yet</p>
        <p className="text-sm mt-1">The fixture list hasn't been added yet.</p>
        {isAdmin && canImportFixtures && (
          <div className="mt-5 flex flex-col items-center gap-2">
            <button
              onClick={onImportFixtures}
              disabled={!onImportFixtures || syncState === 'syncing'}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{
                background: 'var(--accent)',
                color: '#000',
                opacity: syncState === 'syncing' ? 0.7 : 1,
                cursor: syncState === 'syncing' ? 'not-allowed' : 'pointer',
              }}
            >
              {syncState === 'syncing' ? 'Importing fixtures…' : 'Import Fixtures'}
            </button>
            {syncMessage && (
              <p
                className="text-xs"
                style={{ color: syncState === 'error' ? 'var(--red)' : 'var(--text-subtle)' }}
              >
                {syncMessage}
              </p>
            )}
          </div>
        )}
      </div>
    )
  }

  // Build match-id → recap lookup for O(1) access in render
  const recapMap = new Map(recaps.map(r => [r.match_id, r]))
  const finishedMatches = matches.filter(match => match.status === 'finished')
  const visibleMatches = showFinished
    ? matches
    : matches.filter(match => match.status !== 'finished')
  const finishedCount = finishedMatches.length
  const showingAllFinished = showFinished
  const todayKey = localDateKey(new Date())
  const todayMatchCount = matches.filter(match => localDateKey(match.kickoff_time) === todayKey).length

  // Group by stage
  const grouped = new Map<MatchStage, MatchWithPrediction[]>()
  for (const m of visibleMatches) {
    const arr = grouped.get(m.stage) ?? []
    arr.push(m)
    grouped.set(m.stage, arr)
  }

  const sortedStages = [...grouped.entries()].sort(
    ([a], [b]) => stageOrder(a) - stageOrder(b)
  )
  const chronologicalMatches = [...visibleMatches].sort(
    (a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime()
  )
  const firstTodayMatchId = chronologicalMatches.find(match => localDateKey(match.kickoff_time) === todayKey)?.id ?? null

  useEffect(() => {
    if (initialTodayScrollDoneRef.current || todayMatchCount === 0) return

    if (!showFinished) {
      setShowFinished(true)
      return
    }

    if (!sortByKickoff) {
      setSortByKickoff(true)
      return
    }

    if (!firstTodayMatchId) return

    initialTodayScrollDoneRef.current = true
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        todayMatchRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' })
      })
    })
  }, [firstTodayMatchId, showFinished, sortByKickoff, todayMatchCount])

  const jumpToToday = () => {
    setShowFinished(true)
    setSortByKickoff(true)

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        todayMatchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <div
        className="sticky z-20 -mx-4 flex flex-wrap items-center justify-between gap-2 px-4 py-2"
        style={{
          top: 'var(--league-header-height, 0px)',
          background: 'var(--bg)',
          borderBottom: '1px solid var(--border-subtle)',
          boxShadow: '0 8px 18px rgba(0,0,0,0.08)',
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          {finishedCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setShowFinished(value => !value)
              }}
              aria-pressed={showingAllFinished}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
              style={{
                background: showingAllFinished ? 'var(--surface)' : 'var(--accent-glow)',
                border: `1px solid ${showingAllFinished ? 'var(--border)' : 'rgba(63,185,80,0.35)'}`,
                color: showingAllFinished ? 'var(--text-muted)' : 'var(--accent)',
              }}
            >
              {showingAllFinished ? <EyeOff size={14} /> : <Eye size={14} />}
              {showingAllFinished ? 'Hide finished games' : `Show finished games (${finishedCount})`}
            </button>
          )}
          <button
            type="button"
            onClick={() => setSortByKickoff(value => !value)}
            aria-pressed={sortByKickoff}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
            style={{
              background: sortByKickoff ? 'var(--accent-glow)' : 'var(--surface)',
              border: `1px solid ${sortByKickoff ? 'rgba(63,185,80,0.35)' : 'var(--border)'}`,
              color: sortByKickoff ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >
            {sortByKickoff ? <Layers3 size={14} /> : <CalendarClock size={14} />}
            {sortByKickoff ? 'Group by stage' : 'Kick-off order'}
          </button>
        </div>
        {todayMatchCount > 0 && (
          <button
            type="button"
            onClick={jumpToToday}
            aria-label="Scroll to today's matches and show finished games"
            className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
            }}
          >
            <CalendarClock size={14} />
            Scroll to Today ({todayMatchCount})
          </button>
        )}
      </div>

      {visibleMatches.length === 0 ? (
        <div
          className="rounded-xl px-4 py-12 text-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
        >
          <p className="font-medium" style={{ color: 'var(--text)' }}>No upcoming games</p>
          <p className="text-sm mt-1">All available matches are finished.</p>
          <button
            type="button"
            onClick={() => {
              setShowFinished(true)
            }}
            className="mt-4 cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold"
            style={{ background: 'var(--accent)', color: '#000' }}
          >
            Show finished games
          </button>
        </div>
      ) : sortByKickoff ? (
        <section>
          <h3
            className="text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-3"
            style={{ color: 'var(--text-muted)' }}
          >
            <span>All matches by kick-off</span>
            <span className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span style={{ color: 'var(--text-subtle)' }}>{chronologicalMatches.length} matches</span>
          </h3>
          <div className="flex flex-col gap-3">
            {chronologicalMatches.map(match => (
              <div
                key={match.id}
                ref={match.id === firstTodayMatchId ? todayMatchRef : undefined}
                style={match.id === firstTodayMatchId ? { scrollMarginTop: 'calc(var(--league-header-height, 0px) + 64px)' } : undefined}
              >
                <MatchCard
                  match={match}
                  playerId={playerId}
                  recap={recapMap.get(match.id)}
                  reveal={reveals.get(match.id)}
                  tournamentMatches={matches}
                  readOnly={readOnly}
                  scoringMode={scoringMode}
                  onPredictionSaved={onPredictionSaved}
                />
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div className="flex flex-col gap-8">
          {sortedStages.map(([stage, stageMatches]) => (
            <section key={stage}>
              <h3 className="text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-3"
                style={{ color: 'var(--text-muted)' }}>
                <span>{stageLabel(stage)}</span>
                <span className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                <span style={{ color: 'var(--text-subtle)' }}>{stageMatches.length} matches</span>
              </h3>

              {/* Group sub-sections */}
              {stage === 'group'
                ? <GroupStageSection matches={stageMatches} allMatches={matches} playerId={playerId} recapMap={recapMap} revealMap={reveals} readOnly={readOnly} scoringMode={scoringMode} onPredictionSaved={onPredictionSaved} />
                : (
                  <div className="flex flex-col gap-3">
                    {[...stageMatches]
                      .sort((a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime())
                      .map(m => (
                        <MatchCard
                          key={m.id}
                          match={m}
                          playerId={playerId}
                          recap={recapMap.get(m.id)}
                          reveal={reveals.get(m.id)}
                          tournamentMatches={matches}
                          readOnly={readOnly}
                          scoringMode={scoringMode}
                          onPredictionSaved={onPredictionSaved}
                        />
                      ))}
                  </div>
                )
              }
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function GroupStageSection({
  matches,
  allMatches,
  playerId,
  recapMap,
  revealMap,
  readOnly = false,
  scoringMode = 'multiplied',
  onPredictionSaved,
}: {
  matches: MatchWithPrediction[]
  allMatches: MatchWithPrediction[]
  playerId: string
  recapMap: Map<string, MatchRecap>
  revealMap: Map<string, MatchRevealData>
  readOnly?: boolean
  scoringMode?: ScoringMode
  onPredictionSaved?: (prediction: MatchPrediction) => void
}) {
  const byGroup = new Map<string, MatchWithPrediction[]>()
  for (const m of matches) {
    const g = m.group_name ?? 'TBD'
    const arr = byGroup.get(g) ?? []
    arr.push(m)
    byGroup.set(g, arr)
  }

  const sortedGroups = [...byGroup.entries()].sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="flex flex-col gap-6">
      {sortedGroups.map(([group, groupMatches]) => (
        <div key={group}>
          <p className="text-xs mb-2 font-medium" style={{ color: 'var(--text-subtle)' }}>
            Group {group}
          </p>
          <div className="flex flex-col gap-3">
            {groupMatches
              .sort((a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime())
              .map(m => (
                <MatchCard
                  key={m.id}
                  match={m}
                  playerId={playerId}
                  recap={recapMap.get(m.id)}
                  reveal={revealMap.get(m.id)}
                  tournamentMatches={allMatches}
                  readOnly={readOnly}
                  scoringMode={scoringMode}
                  onPredictionSaved={onPredictionSaved}
                />
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function localDateKey(input: string | Date): string {
  const date = input instanceof Date ? input : new Date(input)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function hasMatchToday(matches: MatchWithPrediction[]): boolean {
  const todayKey = localDateKey(new Date())
  return matches.some(match => localDateKey(match.kickoff_time) === todayKey)
}
