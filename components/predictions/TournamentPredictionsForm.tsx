'use client'

import { useState } from 'react'
import { Trophy, User, Check, Loader2, Lock } from 'lucide-react'
import type { Player, TournamentPrediction } from '@/types'
import {
  type PickDeadlines,
  topScorerPointsForSubmittedAt,
  winnerPointsForSubmittedAt,
} from '@/lib/tournament-picks'

const WORLD_CUP_2026_TEAMS = [
  'Argentina', 'Australia', 'Belgium', 'Brazil', 'Cameroon', 'Canada',
  'Chile', 'Colombia', 'Croatia', 'Denmark', 'Ecuador', 'Egypt',
  'England', 'France', 'Germany', 'Ghana', 'Honduras', 'Hungary',
  'Iran', 'Italy', 'Japan', 'Mexico', 'Morocco', 'Netherlands',
  'New Zealand', 'Nigeria', 'Panama', 'Paraguay', 'Peru', 'Poland',
  'Portugal', 'Qatar', 'Saudi Arabia', 'Senegal', 'Serbia', 'Slovenia',
  'South Korea', 'Spain', 'Switzerland', 'Turkey', 'Ukraine', 'Uruguay',
  'USA', 'Venezuela',
]

interface Props {
  existing: TournamentPrediction | null
  allPredictions: TournamentPrediction[]
  players: Player[]
  playerId: string
  leagueId: string
  pickDeadlines: PickDeadlines
  winnerLocked: boolean
  topScorerLocked: boolean
  finalKickoff: string | null
  semiFinalKickoff: string | null
  readOnly?: boolean
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function TournamentPredictionsForm({
  existing,
  allPredictions,
  players,
  playerId,
  leagueId,
  pickDeadlines,
  winnerLocked,
  topScorerLocked,
  finalKickoff,
  semiFinalKickoff,
  readOnly = false,
}: Props) {
  const [winner, setWinner] = useState(existing?.winner_team ?? '')
  const [scorer, setScorer] = useState(existing?.top_scorer_name ?? '')
  const [winnerSaveState, setWinnerSaveState] = useState<SaveState>('idle')
  const [scorerSaveState, setScorerSaveState] = useState<SaveState>('idle')
  const [filterText, setFilterText] = useState('')

  const filteredTeams = WORLD_CUP_2026_TEAMS.filter(t =>
    t.toLowerCase().includes(filterText.toLowerCase())
  )

  const saveWinner = async () => {
    if (!winner || winnerLocked) return
    setWinnerSaveState('saving')
    try {
      const res = await fetch('/api/tournament-predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: playerId, league_id: leagueId, winner_team: winner }),
      })
      setWinnerSaveState(res.ok ? 'saved' : 'error')
      if (res.ok) setTimeout(() => setWinnerSaveState('idle'), 3000)
    } catch {
      setWinnerSaveState('error')
    }
  }

  const saveTopScorer = async () => {
    if (!scorer || topScorerLocked) return
    setScorerSaveState('saving')
    try {
      const res = await fetch('/api/tournament-predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: playerId, league_id: leagueId, top_scorer_name: scorer }),
      })
      setScorerSaveState(res.ok ? 'saved' : 'error')
      if (res.ok) setTimeout(() => setScorerSaveState('idle'), 3000)
    } catch {
      setScorerSaveState('error')
    }
  }

  const allLocked = winnerLocked && topScorerLocked
  const now = new Date()
  const nowIso = now.toISOString()
  const winnerKeepPoints = winnerPointsForSubmittedAt(existing?.winner_submitted_at ?? existing?.submitted_at, pickDeadlines)
  const winnerChangePoints = winnerPointsForSubmittedAt(nowIso, pickDeadlines)
  const scorerKeepPoints = topScorerPointsForSubmittedAt(existing?.top_scorer_submitted_at ?? existing?.submitted_at, pickDeadlines)
  const scorerChangePoints = topScorerPointsForSubmittedAt(nowIso, pickDeadlines)
  const nextDeadline = [
    pickDeadlines.firstKickoff,
    pickDeadlines.roundOf16Kickoff,
    pickDeadlines.quarterFinalKickoff,
    pickDeadlines.semiFinalKickoff,
    pickDeadlines.finalKickoff,
  ]
    .filter((deadline): deadline is string => {
      if (!deadline) return false
      return new Date(deadline).getTime() > now.getTime()
    })
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ?? null
  const afterNextDeadlineIso = nextDeadline
    ? new Date(new Date(nextDeadline).getTime() + 1).toISOString()
    : null
  const nextWinnerPoints = afterNextDeadlineIso
    ? winnerPointsForSubmittedAt(afterNextDeadlineIso, pickDeadlines)
    : null
  const nextScorerPoints = afterNextDeadlineIso
    ? topScorerPointsForSubmittedAt(afterNextDeadlineIso, pickDeadlines)
    : null
  const winnerSaved = Boolean(existing?.winner_team)
  const scorerSaved = Boolean(existing?.top_scorer_name)
  const livePointParts = [
    !winnerLocked ? `Winner = ${winnerChangePoints} pts` : null,
    !topScorerLocked ? `Top scorer = ${scorerChangePoints} pts` : null,
  ].filter(Boolean).join(', ')
  const savedPointParts = [
    winnerSaved ? `Winner = ${winnerKeepPoints} pts` : null,
    scorerSaved ? `Top scorer = ${scorerKeepPoints} pts` : null,
  ].filter(Boolean).join(', ')
  const nextPointParts = [
    !winnerLocked && nextWinnerPoints !== null ? `Winner = ${nextWinnerPoints} pts` : null,
    !topScorerLocked && nextScorerPoints !== null ? `Top scorer = ${nextScorerPoints} pts` : null,
  ].filter(Boolean).join(', ')
  const currentSavedPointParts = savedPointParts || livePointParts
  const nextDropText = nextDeadline && nextPointParts
    ? `at the next score tier deadline, which is ${fmt(nextDeadline)}, new changes drop to ${nextPointParts}.`
    : 'new changes drop after each tournament deadline.'
  const scoreNote = winnerSaved || scorerSaved
    ? `Careful when changing saved picks: changing a pick resets that pick to the current bonus tier. Current correct saved picks score ${currentSavedPointParts}; ${nextDropText}`
    : `Correct picks saved now score ${livePointParts}; ${nextDropText}`
  const winnerPointHint = winnerSaved && winnerKeepPoints !== winnerChangePoints
    ? `Correct winner points: keep current = ${winnerKeepPoints}, change now = ${winnerChangePoints}.`
    : `Correct winner points: ${winnerChangePoints}.`
  const scorerPointHint = scorerSaved && scorerKeepPoints !== scorerChangePoints
    ? `Correct top scorer points: keep current = ${scorerKeepPoints}, change now = ${scorerChangePoints}.`
    : `Correct top scorer points: ${scorerChangePoints}.`

  const leaguePickRows = players.map(p => {
    const pick = allPredictions.find(tp => tp.player_id === p.id)
    return {
      player: p.display_name,
      winner: pick?.winner_team || '—',
      scorer: pick?.top_scorer_name || '—',
    }
  })

  if (readOnly) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Lock size={16} style={{ color: 'var(--gold)' }} />
            <h3 className="font-semibold" style={{ color: 'var(--text)' }}>Archived league - read-only</h3>
          </div>
          {existing ? (
            <div className="flex flex-col gap-3">
              <PredRow icon={<Trophy size={14} style={{ color: 'var(--gold)' }} />} label="Tournament winner" value={existing.winner_team || 'Not submitted'} />
              <PredRow icon={<User size={14} style={{ color: 'var(--blue)' }} />} label="Golden Boot" value={existing.top_scorer_name || 'Not submitted'} />
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No tournament picks submitted.</p>
          )}
        </div>
        <LeaguePicksCard rows={leaguePickRows} />
      </div>
    )
  }

  if (allLocked) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Lock size={16} style={{ color: 'var(--gold)' }} />
            <h3 className="font-semibold" style={{ color: 'var(--text)' }}>Tournament Picks — Fully Locked</h3>
          </div>
          {existing ? (
            <div className="flex flex-col gap-3">
              <PredRow icon={<Trophy size={14} style={{ color: 'var(--gold)' }} />} label="Tournament winner" value={existing.winner_team || 'Not submitted'} />
              <PredRow icon={<User size={14} style={{ color: 'var(--blue)' }} />} label="Golden Boot" value={existing.top_scorer_name || 'Not submitted'} />
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No tournament picks submitted.</p>
          )}
        </div>

        <LeaguePicksCard rows={leaguePickRows} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-1">
          <Trophy size={16} style={{ color: 'var(--gold)' }} />
          <h3 className="font-semibold" style={{ color: 'var(--text)' }}>Tournament Picks</h3>
        </div>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          Winner stays open until final kick-off. Top scorer locks at semi-final kick-off.
        </p>
        <p className="text-xs mb-6 px-3 py-2 rounded-lg" style={{ background: 'rgba(210,153,34,0.08)', border: '1px solid rgba(210,153,34,0.2)', color: 'var(--gold)' }}>
          ⏰ {scoreNote}
        </p>

      {/* Winner select */}
      <div className="mb-5">
        <label className="text-xs font-medium uppercase tracking-wider block mb-2" style={{ color: 'var(--text-muted)' }}>
          🏆 Tournament Winner — up to 15 pts
        </label>
        {winnerLocked && (
          <p className="text-xs mb-2" style={{ color: 'var(--gold)' }}>
            Locked at final kick-off{finalKickoff ? ` (${fmt(finalKickoff)})` : ''}
          </p>
        )}
        <div className="relative">
          <input
            type="text"
            placeholder="Search team…"
            value={winner || filterText}
            onChange={e => {
              if (winner) setWinner('')
              setFilterText(e.target.value)
            }}
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
            style={{
              background: 'var(--bg)',
              border: '1.5px solid var(--border)',
              color: 'var(--text)',
              opacity: winnerLocked ? 0.7 : 1,
              cursor: winnerLocked ? 'not-allowed' : 'text',
            }}
            disabled={winnerLocked}
            onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
            onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
          />
          {!winnerLocked && !winner && filterText && (
            <div className="absolute z-10 w-full mt-1 rounded-lg overflow-hidden shadow-xl"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', maxHeight: '200px', overflowY: 'auto' }}>
              {filteredTeams.slice(0, 12).map(team => (
                <button
                  key={team}
                  onClick={() => { setWinner(team); setFilterText('') }}
                  className="w-full text-left px-3 py-2 text-sm transition-colors"
                  style={{ color: 'var(--text)' }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.background = 'var(--accent-glow)' }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent' }}
                >
                  {team}
                </button>
              ))}
              {filteredTeams.length === 0 && (
                <div className="px-3 py-2 text-sm" style={{ color: 'var(--text-muted)' }}>No teams found</div>
              )}
            </div>
          )}
        </div>
        {winner && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm font-medium" style={{ color: 'var(--accent)' }}>✓ {winner}</span>
            {!winnerLocked && (
              <button onClick={() => setWinner('')} className="text-xs" style={{ color: 'var(--text-muted)' }}>change</button>
            )}
          </div>
        )}
        <button
          onClick={saveWinner}
          disabled={!winner || winnerLocked || winnerSaveState === 'saving'}
          className="mt-3 w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all"
          style={{
            background: !winner || winnerLocked ? 'var(--surface-2)' : 'var(--accent)',
            color: !winner || winnerLocked ? 'var(--text-subtle)' : '#000',
            cursor: !winner || winnerLocked ? 'not-allowed' : 'pointer',
          }}
        >
          {winnerSaveState === 'saving' && <Loader2 size={14} className="animate-spin" />}
          {winnerSaveState === 'saved' && <Check size={14} />}
          {winnerSaveState === 'saved' ? 'Winner saved!' : winnerSaveState === 'saving' ? 'Saving…' : 'Save winner'}
        </button>
        {winnerSaveState === 'error' && (
          <p className="text-xs text-center mt-2" style={{ color: 'var(--red)' }}>Failed to save winner.</p>
        )}
          {!winnerLocked && (
            <p className="text-xs mt-2 text-center" style={{ color: 'var(--text-subtle)' }}>
              {winnerPointHint}
            </p>
          )}
      </div>

        {/* Golden Boot */}
        <div>
          <label className="text-xs font-medium uppercase tracking-wider block mb-2" style={{ color: 'var(--text-muted)' }}>
            ⚽ Golden Boot (Top Scorer) — up to 10 pts
          </label>
          {topScorerLocked && (
            <p className="text-xs mb-2" style={{ color: 'var(--gold)' }}>
              Locked at semi-final kick-off{semiFinalKickoff ? ` (${fmt(semiFinalKickoff)})` : ''}
            </p>
          )}
          <input
            type="text"
            placeholder="Player name…"
            value={scorer}
            onChange={e => setScorer(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
            style={{
              background: 'var(--bg)',
              border: '1.5px solid var(--border)',
              color: 'var(--text)',
              opacity: topScorerLocked ? 0.7 : 1,
              cursor: topScorerLocked ? 'not-allowed' : 'text',
            }}
            disabled={topScorerLocked}
            onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
            onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
          />
          <button
            onClick={saveTopScorer}
            disabled={!scorer || topScorerLocked || scorerSaveState === 'saving'}
            className="mt-3 w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all"
            style={{
              background: !scorer || topScorerLocked ? 'var(--surface-2)' : 'var(--accent)',
              color: !scorer || topScorerLocked ? 'var(--text-subtle)' : '#000',
              cursor: !scorer || topScorerLocked ? 'not-allowed' : 'pointer',
            }}
          >
            {scorerSaveState === 'saving' && <Loader2 size={14} className="animate-spin" />}
            {scorerSaveState === 'saved' && <Check size={14} />}
            {scorerSaveState === 'saved' ? 'Top scorer saved!' : scorerSaveState === 'saving' ? 'Saving…' : 'Save top scorer'}
          </button>
          {scorerSaveState === 'error' && (
            <p className="text-xs text-center mt-2" style={{ color: 'var(--red)' }}>Failed to save top scorer.</p>
          )}
          {!topScorerLocked && (
            <p className="text-xs mt-2 text-center" style={{ color: 'var(--text-subtle)' }}>
              {scorerPointHint}
            </p>
          )}
        </div>
      </div>

      <LeaguePicksCard rows={leaguePickRows} />
    </div>
  )
}

function fmt(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function PredRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--surface-2)' }}>
      {icon}
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="ml-auto font-medium text-sm" style={{ color: 'var(--text)' }}>{value}</span>
    </div>
  )
}

function LeaguePicksCard({ rows }: { rows: Array<{ player: string; winner: string; scorer: string }> }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h4 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
        League picks (visible to everyone)
      </h4>
      <div className="flex flex-col gap-2">
        {rows.map(row => (
          <div key={row.player} className="text-xs" style={{ color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{row.player}</span>
            {' · '}
            Winner: {row.winner}
            {' · '}
            Top scorer: {row.scorer}
          </div>
        ))}
      </div>
    </div>
  )
}
