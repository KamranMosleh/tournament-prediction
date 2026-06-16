'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart2, Calendar, Trophy, Shield, Send, Home } from 'lucide-react'
import type {
  League, Player, Match, MatchPrediction, TournamentPrediction,
  MatchdaySummary, MatchRecap, Session, MatchWithPrediction
} from '@/types'
import { getSession } from '@/lib/utils'
import { computeLeaderboard, sortLeaderboard } from '@/lib/scoring'
import { InviteCode } from '@/components/ui/InviteCode'
import { Leaderboard } from '@/components/leaderboard/Leaderboard'
import { MatchList } from '@/components/matches/MatchList'
import { TournamentPredictionsForm } from '@/components/predictions/TournamentPredictionsForm'
import { ResultsForm } from '@/components/predictions/ResultsForm'
import { createClient } from '@/lib/supabase/client'
import { getPickDeadlines, isDeadlinePassed } from '@/lib/tournament-picks'

type Tab = 'leaderboard' | 'matches' | 'picks' | 'results'

interface Props {
  league: League
  players: Player[]
  matches: Match[]
  predictions: MatchPrediction[]
  tournamentPredictions: TournamentPrediction[]
  summaries: MatchdaySummary[]
  recaps: MatchRecap[]
}

export function LeagueHub({
  league,
  players: initialPlayers,
  matches: initialMatches,
  predictions: initialPredictions,
  tournamentPredictions: initialTournamentPredictions,
  summaries: initialSummaries,
  recaps: initialRecaps,
}: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('leaderboard')

  // Session — undefined = still loading, null = not joined
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  // Live data
  const [players, setPlayers] = useState(initialPlayers)
  const [matches, setMatches] = useState(initialMatches)
  const [predictions, setPredictions] = useState(initialPredictions)
  const [tournamentPredictions] = useState(initialTournamentPredictions)
  const [summaries] = useState(initialSummaries)
  const [recaps] = useState(initialRecaps)
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle')
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  // Keep client state aligned with fresh server props (e.g. after router.refresh()).
  useEffect(() => {
    setPlayers(initialPlayers)
    setMatches(initialMatches)
    setPredictions(initialPredictions)
  }, [initialPlayers, initialMatches, initialPredictions])

  // Stable ref for player IDs to avoid Realtime re-subscribe loop
  const playerIdsRef = useRef(initialPlayers.map(p => p.id))
  useEffect(() => { playerIdsRef.current = players.map(p => p.id) }, [players])

  // Load session from localStorage — runs once
  useEffect(() => {
    setSession(getSession(league.invite_code) ?? null)
  }, [league.invite_code])

  // Supabase Realtime — subscribe once, use ref for player IDs
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'players' }, payload => {
        if (payload.new.league_id === league.id) {
          setPlayers(prev => [...prev, payload.new as Player])
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [league.id]) // stable dependency — no re-subscribe on player changes

  // Loading state
  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
      </div>
    )
  }

  // Not joined
  if (session === null) {
    return <NotJoined code={league.invite_code} leagueName={league.name} router={router} />
  }

  // Computed values
  const scores = sortLeaderboard(computeLeaderboard({
    players, predictions, matches, tournamentPredictions,
    scoringMode: league.scoring_mode,
  }))

  const matchesWithPredictions: MatchWithPrediction[] = matches.map(m => ({
    ...m,
    prediction: predictions.find(p => p.player_id === session.player_id && p.match_id === m.id) ?? null,
  }))

  const myTournamentPick = tournamentPredictions.find(p => p.player_id === session.player_id) ?? null
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
        headers: {
          'Content-Type': 'application/json',
          'x-session-token': session.session_token,
        },
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
    { id: 'picks',       label: 'My Picks',  icon: <Trophy size={13} /> },
    ...(session.is_admin && league.sync_source === 'manual'
      ? [{ id: 'results' as Tab, label: 'Results', icon: <Shield size={13} /> }]
      : []),
  ]

  return (
    <div className="min-h-screen flex flex-col">
      {/* Sticky header */}
      <header className="sticky top-0 z-20 backdrop-blur-sm"
        style={{ background: 'rgba(13,17,23,0.92)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-2xl mx-auto px-4 pt-3 pb-0">
          {/* Top row */}
          <div className="flex items-start justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <button onClick={() => router.push('/')} title="All leagues"
                className="p-1.5 rounded-lg shrink-0 transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <Home size={14} />
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

            <div className="flex items-center gap-2 shrink-0">
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
          <div className="flex">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors relative"
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
        {tab === 'leaderboard' && (
          <div className="flex flex-col gap-4">
            {latestSummary && <PunditsCard summary={latestSummary} />}
            <Leaderboard scores={scores} currentPlayerId={session.player_id} />
          </div>
        )}
        {tab === 'matches' && (
          <MatchList
            matches={matchesWithPredictions}
            playerId={session.player_id}
            sessionToken={session.session_token}
            recaps={recaps}
            isAdmin={session.is_admin}
            canImportFixtures={league.sync_source === 'api'}
            onImportFixtures={handleImportFixtures}
            syncState={syncState}
            syncMessage={syncMessage}
          />
        )}
        {tab === 'picks' && (
          <TournamentPredictionsForm
            existing={myTournamentPick}
            playerId={session.player_id}
            leagueId={league.id}
            sessionToken={session.session_token}
            winnerLocked={winnerLocked}
            topScorerLocked={topScorerLocked}
            finalKickoff={deadlines.finalKickoff}
            semiFinalKickoff={deadlines.semiFinalKickoff}
          />
        )}
        {tab === 'results' && session.is_admin && (
          <ResultsForm matches={matches} sessionToken={session.session_token} />
        )}
      </div>
    </div>
  )
}

function PunditsCard({ summary }: { summary: MatchdaySummary }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="rounded-xl p-4 cursor-pointer select-none"
      onClick={() => setExpanded(e => !e)}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          🎙 Matchday {summary.match_day} Recap
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
        {summary.summary_text}
      </p>
    </div>
  )
}

function NotJoined({ code, leagueName, router }: { code: string; leagueName: string; router: ReturnType<typeof useRouter> }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-xs text-center">
        <div className="text-5xl mb-4">⚽</div>
        <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text)' }}>{leagueName}</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>You haven't joined this league yet.</p>
        <button onClick={() => router.push(`/join/${code}`)}
          className="w-full py-2.5 rounded-xl font-semibold text-sm mb-2"
          style={{ background: 'var(--accent)', color: '#000' }}>
          Join This League
        </button>
        <button onClick={() => router.push('/')}
          className="w-full py-2.5 rounded-xl text-sm"
          style={{ color: 'var(--text-muted)' }}>
          Back to Home
        </button>
      </div>
    </div>
  )
}
