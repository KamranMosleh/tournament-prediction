'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, BarChart2, Calendar, Trophy, Shield, Send, Home, Eye } from 'lucide-react'
import type {
  League, Player, Match, MatchPrediction, TournamentPrediction,
  MatchdaySummary, DailySummary, MatchRecap, MatchWithPrediction
} from '@/types'
import { computeLeaderboard, sortLeaderboard } from '@/lib/scoring'
import { InviteCode } from '@/components/ui/InviteCode'
import { Leaderboard } from '@/components/leaderboard/Leaderboard'
import { MatchList } from '@/components/matches/MatchList'
import { TournamentPredictionsForm } from '@/components/predictions/TournamentPredictionsForm'
import { ResultsForm } from '@/components/predictions/ResultsForm'
import { PredictionsRevealTab } from '@/components/predictions/PredictionsRevealTab'
import { createClient } from '@/lib/supabase/client'
import { getPickDeadlines, isDeadlinePassed } from '@/lib/tournament-picks'
import { buildMatchRevealData } from '@/lib/prediction-reveal'
import { LeagueLifecycleDialog } from '@/components/league/LeagueLifecycleDialog'
import { ScoringRulesDialog } from '@/components/league/ScoringRulesDialog'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

type Tab = 'leaderboard' | 'matches' | 'reveal' | 'picks' | 'results'

interface Props {
  league: League
  currentPlayer: Player | null
  players: Player[]
  matches: Match[]
  predictions: MatchPrediction[]
  tournamentPredictions: TournamentPrediction[]
  summaries: MatchdaySummary[]
  dailySummaries: DailySummary[]
  recaps: MatchRecap[]
}

export function LeagueHub({
  league,
  currentPlayer,
  players: initialPlayers,
  matches: initialMatches,
  predictions: initialPredictions,
  tournamentPredictions: initialTournamentPredictions,
  summaries: initialSummaries,
  dailySummaries: initialDailySummaries,
  recaps: initialRecaps,
}: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('leaderboard')

  // Live data
  const [players, setPlayers] = useState(initialPlayers)
  const [matches, setMatches] = useState(initialMatches)
  const [predictions, setPredictions] = useState(initialPredictions)
  const [tournamentPredictions] = useState(initialTournamentPredictions)
  const [summaries] = useState(initialSummaries)
  const [dailySummaries, setDailySummaries] = useState(initialDailySummaries)
  const [recaps] = useState(initialRecaps)
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle')
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  // Keep client state aligned with fresh server props (e.g. after router.refresh()).
  useEffect(() => {
    setPlayers(initialPlayers)
    setMatches(initialMatches)
    setPredictions(initialPredictions)
    setDailySummaries(initialDailySummaries)
  }, [initialPlayers, initialMatches, initialPredictions, initialDailySummaries])

  // Stable ref for player IDs to avoid Realtime re-subscribe loop
  const playerIdsRef = useRef(initialPlayers.map(p => p.id))
  useEffect(() => { playerIdsRef.current = players.map(p => p.id) }, [players])

  // Subscribe only to gameplay tables, never private player rows.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`league-${league.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_predictions' }, () => {
        supabase
          .from('match_predictions')
          .select('*')
          .in('player_id', playerIdsRef.current)
          .then(({ data }) => { if (data) setPredictions(data) })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, payload => {
        setMatches(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_summaries', filter: `league_id=eq.${league.id}` }, () => {
        supabase
          .from('daily_summaries')
          .select('*')
          .eq('league_id', league.id)
          .order('summary_date')
          .then(({ data }) => { if (data) setDailySummaries(data as DailySummary[]) })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [league.id]) // stable dependency — no re-subscribe on player changes

  const predictionsByMatch = useMemo(() => {
    const grouped = new Map<string, MatchPrediction[]>()
    for (const p of predictions) {
      const arr = grouped.get(p.match_id) ?? []
      arr.push(p)
      grouped.set(p.match_id, arr)
    }
    return grouped
  }, [predictions])

  const revealMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof buildMatchRevealData>>()
    for (const match of matches) {
      map.set(
        match.id,
        buildMatchRevealData(match, players, predictionsByMatch.get(match.id) ?? [], league.scoring_mode)
      )
    }
    return map
  }, [matches, players, predictionsByMatch, league.scoring_mode])

  const handlePredictionSaved = useCallback((prediction: MatchPrediction) => {
    setPredictions(prev => {
      const index = prev.findIndex(p => p.player_id === prediction.player_id && p.match_id === prediction.match_id)
      if (index === -1) return [...prev, prediction]

      const next = [...prev]
      next[index] = prediction
      return next
    })
  }, [])

  // Not joined
  if (!currentPlayer) {
    return <NotJoined code={league.invite_code} leagueName={league.name} archived={Boolean(league.archived_at)} router={router} />
  }

  // Computed values
  const isArchived = Boolean(league.archived_at)
  const isOwner = currentPlayer.user_id === league.created_by_user_id
  const scores = sortLeaderboard(computeLeaderboard({
    players, predictions, matches, tournamentPredictions,
    scoringMode: league.scoring_mode,
    officialTopScorer: league.official_top_scorer_name,
  }))

  const matchesWithPredictions: MatchWithPrediction[] = matches.map(m => ({
    ...m,
    prediction: predictions.find(p => p.player_id === currentPlayer.id && p.match_id === m.id) ?? null,
  }))

  const myTournamentPick = tournamentPredictions.find(p => p.player_id === currentPlayer.id) ?? null
  const latestDailySummary = dailySummaries.length > 0 ? dailySummaries[dailySummaries.length - 1] : null
  const latestDailySummaryTitle = latestDailySummary
    ? `Latest Recap: ${latestDailySummary.coverage_label ?? `${latestDailySummary.summary_date} games`}`
    : null
  const latestSummary = summaries.length > 0 ? summaries[summaries.length - 1] : null
  const deadlines = getPickDeadlines(matches)
  const winnerLocked = isDeadlinePassed(deadlines.finalKickoff)
  const topScorerLocked = isDeadlinePassed(deadlines.semiFinalKickoff)

  const handleImportFixtures = async () => {
    if (syncState === 'syncing') return
    setSyncState('syncing')
    setSyncMessage(null)

    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          league_id: league.id,
          tournament_code: league.tournament_code,
          season: league.tournament_season,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setSyncState('error')
        setSyncMessage(data.error ?? 'Failed to import fixtures')
        return
      }

      setSyncState('success')
      setSyncMessage(`Imported ${data.matchesUpdated ?? 0} fixtures`)
      router.refresh()
    } catch {
      setSyncState('error')
      setSyncMessage('Failed to import fixtures')
    }
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'leaderboard', label: 'Standings', icon: <BarChart2 size={13} /> },
    { id: 'matches',     label: 'Matches',   icon: <Calendar size={13} /> },
    { id: 'reveal',      label: 'Reveal',    icon: <Eye size={13} /> },
    { id: 'picks',       label: 'My Picks',  icon: <Trophy size={13} /> },
    ...(currentPlayer.is_admin && !isArchived
      ? [{ id: 'results' as Tab, label: 'Results', icon: <Shield size={13} /> }]
      : []),
  ]

  return (
    <div className="min-h-screen flex flex-col">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 isolate"
        style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-2xl mx-auto px-4 pt-3 pb-0">
          {/* Top row */}
          <div className="flex flex-wrap items-start justify-between gap-2 mb-2.5">
            <div className="flex flex-1 items-center gap-2 min-w-40">
              <button onClick={() => router.push('/')} title="All leagues"
                className="flex cursor-pointer items-center gap-1.5 px-2.5 py-1.5 rounded-lg shrink-0 text-xs font-semibold transition-colors"
                style={{
                  background: 'var(--accent-glow)',
                  border: '1px solid rgba(63,185,80,0.3)',
                  color: 'var(--accent)',
                }}>
                <Home size={16} />
                Home
              </button>
              <div className="min-w-0">
                <h1 className="font-bold text-sm leading-tight truncate" style={{ color: 'var(--text)' }}>
                  {league.name}
                </h1>
                <p className="text-xs leading-tight" style={{ color: 'var(--text-muted)' }}>
                  {league.tournament}
                </p>
              </div>
            </div>

            <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
              {isOwner && <LeagueLifecycleDialog league={league} />}
              <ScoringRulesDialog scoringMode={league.scoring_mode} />
              <ThemeToggle />
              {league.telegram_url && (
                <a href={league.telegram_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: 'rgba(88,166,255,0.1)', color: 'var(--blue)', border: '1px solid rgba(88,166,255,0.2)' }}>
                  <Send size={10} /> Chat
                </a>
              )}
              <InviteCode code={league.invite_code} />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex overflow-x-auto">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="flex cursor-pointer shrink-0 items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors relative"
                style={{ color: tab === t.id ? 'var(--text)' : 'var(--text-muted)' }}>
                {t.icon}
                {t.label}
                {tab === t.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
                    style={{ background: 'var(--accent)' }} />
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Tab content */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5">
        {isArchived && (
          <div
            className="mb-4 flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs leading-relaxed"
            style={{ background: 'rgba(210,153,34,0.1)', border: '1px solid rgba(210,153,34,0.3)', color: 'var(--gold)' }}
          >
            <Archive size={14} className="shrink-0 mt-0.5" />
            <span>This league is archived and read-only. Standings and history remain visible, but joining and all updates are disabled.</span>
          </div>
        )}
        {tab === 'leaderboard' && (
          <div className="flex flex-col gap-4">
            {latestDailySummary
              ? <PunditsCard title={latestDailySummaryTitle!} text={latestDailySummary.summary_text} />
              : latestSummary && <PunditsCard title={`Matchday ${summaries.length} Recap`} text={latestSummary.summary_text} />}
            <Leaderboard scores={scores} currentPlayerId={currentPlayer.id} />
          </div>
        )}
        {tab === 'matches' && (
          <MatchList
            matches={matchesWithPredictions}
            playerId={currentPlayer.id}
            recaps={recaps}
            reveals={revealMap}
            isAdmin={currentPlayer.is_admin}
            canImportFixtures={!isArchived && league.sync_source === 'api'}
            onImportFixtures={handleImportFixtures}
            syncState={syncState}
            syncMessage={syncMessage}
            readOnly={isArchived}
            scoringMode={league.scoring_mode}
            onPredictionSaved={handlePredictionSaved}
          />
        )}
        {tab === 'reveal' && (
          <PredictionsRevealTab
            matches={matches}
            reveals={revealMap}
            players={players}
            tournamentPredictions={tournamentPredictions}
          />
        )}
        {tab === 'picks' && (
          <TournamentPredictionsForm
            existing={myTournamentPick}
            allPredictions={tournamentPredictions}
            players={players}
            playerId={currentPlayer.id}
            leagueId={league.id}
            pickDeadlines={deadlines}
            winnerLocked={winnerLocked}
            topScorerLocked={topScorerLocked}
            finalKickoff={deadlines.finalKickoff}
            semiFinalKickoff={deadlines.semiFinalKickoff}
            readOnly={isArchived}
          />
        )}
        {tab === 'results' && currentPlayer.is_admin && (
          <ResultsForm matches={matches} league={league} />
        )}
      </div>
    </div>
  )
}

function PunditsCard({ title, text }: { title: string; text: string }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="rounded-xl p-4 cursor-pointer select-none"
      onClick={() => setExpanded(e => !e)}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          {title}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>{expanded ? '▲' : '▼'}</span>
      </div>
      <p className="text-sm leading-relaxed" style={{
        color: 'var(--text-muted)',
        display: '-webkit-box',
        overflow: 'hidden',
        WebkitLineClamp: expanded ? 'unset' : 2,
        WebkitBoxOrient: 'vertical',
      } as React.CSSProperties}>
        {text}
      </p>
    </div>
  )
}

function NotJoined({ code, leagueName, archived, router }: {
  code: string
  leagueName: string
  archived: boolean
  router: ReturnType<typeof useRouter>
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-xs text-center">
        <div className="text-5xl mb-4">⚽</div>
        <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text)' }}>{leagueName}</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          {archived ? 'This league is archived and is not accepting new members.' : "You haven't joined this league yet."}
        </p>
        {!archived && (
          <button onClick={() => router.push(`/join/${code}`)}
            className="w-full py-2.5 rounded-xl font-semibold text-sm mb-2"
            style={{ background: 'var(--accent)', color: '#000' }}>
            Join This League
          </button>
        )}
        <button onClick={() => router.push('/')}
          className="w-full py-2.5 rounded-xl text-sm"
          style={{ color: 'var(--text-muted)' }}>
          Back to Home
        </button>
      </div>
    </div>
  )
}
