'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Trophy, User } from 'lucide-react'
import type { League, Match } from '@/types'
import { formatKickoff } from '@/lib/utils'
import { deriveTournamentWinner } from '@/lib/scoring'
import { getPickDeadlines, isDeadlinePassed } from '@/lib/tournament-picks'
import { formatCountryName } from '@/lib/country-flags'
import { CountryName } from '@/components/ui/CountryName'

interface Props {
  matches: Match[]
  league: League
}

export function ResultsForm({ matches, league }: Props) {
  const manualResults = league.sync_source === 'manual'
  const pending = matches.filter(match =>
    match.status === 'locked' || (match.status === 'finished' && match.home_score !== null)
  )
  const locked = matches.filter(match => match.status === 'locked')
  const finished = pending.filter(match => match.status === 'finished')

  return (
    <div className="flex flex-col gap-6">
      <TournamentResultsCard matches={matches} league={league} />

      {manualResults && (
        <section className="flex flex-col gap-4">
          <div
            className="p-3 rounded-lg text-sm"
            style={{
              background: 'rgba(210,153,34,0.1)',
              border: '1px solid rgba(210,153,34,0.25)',
              color: 'var(--gold)',
            }}
          >
            Admin view - enter final scores after each match finishes.
          </div>

          {locked.map(match => (
            <ResultRow key={match.id} match={match} leagueId={league.id} />
          ))}

          {finished.length > 0 && (
            <>
              <h4
                className="text-xs font-semibold uppercase tracking-widest pt-2"
                style={{ color: 'var(--text-muted)' }}
              >
                Already entered (click to correct)
              </h4>
              {finished.map(match => (
                <ResultRow key={match.id} match={match} leagueId={league.id} />
              ))}
            </>
          )}

          {locked.length === 0 && finished.length === 0 && (
            <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
              <p className="font-medium">No matches to update yet</p>
              <p className="text-sm mt-1">Results appear here once matches kick off.</p>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function TournamentResultsCard({ matches, league }: Props) {
  const router = useRouter()
  const deadlines = getPickDeadlines(matches)
  const topScorerUnlocked = isDeadlinePassed(deadlines.semiFinalKickoff)
  const tournamentWinner = deriveTournamentWinner(matches)
  const [topScorer, setTopScorer] = useState(league.official_top_scorer_name ?? '')
  const [savedTopScorer, setSavedTopScorer] = useState(league.official_top_scorer_name ?? '')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    const officialName = league.official_top_scorer_name ?? ''
    setTopScorer(officialName)
    setSavedTopScorer(officialName)
  }, [league.official_top_scorer_name])

  const saveTopScorer = async () => {
    const value = topScorer.trim()
    if (!value || !topScorerUnlocked || state === 'saving') return

    setState('saving')
    setError('')
    try {
      const res = await fetch(`/api/leagues/${league.id}/tournament-results`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ official_top_scorer_name: value }),
      })
      const data = await res.json()
      if (!res.ok) {
        setState('error')
        setError(data.error ?? 'Failed to save official top scorer')
        return
      }
      setTopScorer(data.league.official_top_scorer_name ?? value)
      setSavedTopScorer(data.league.official_top_scorer_name ?? value)
      setState('saved')
      router.refresh()
      setTimeout(() => setState('idle'), 3000)
    } catch {
      setState('error')
      setError('Failed to save official top scorer')
    }
  }

  return (
    <section
      className="rounded-xl p-5"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Trophy size={16} style={{ color: 'var(--gold)' }} />
        <h3 className="font-semibold" style={{ color: 'var(--text)' }}>
          Official tournament results
        </h3>
      </div>
      <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>
        The champion is detected from the completed final. After that match, the top scorer is
        imported automatically when the API has one unique goals leader; use this form when the
        API is tied or unavailable, or to correct the result.
      </p>
      {tournamentWinner && !savedTopScorer && (
        <p
          className="text-xs mb-5 rounded-lg p-3"
          style={{
            background: 'rgba(210,153,34,0.1)',
            border: '1px solid rgba(210,153,34,0.25)',
            color: 'var(--gold)',
          }}
        >
          No automatic top-scorer result is available yet. If the API is tied or unavailable,
          enter the official result manually below.
        </p>
      )}

      <div
        className="flex items-center gap-3 p-3 rounded-lg mb-5"
        style={{ background: 'var(--surface-2)' }}
      >
        <Trophy size={15} style={{ color: 'var(--gold)' }} />
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Tournament winner</p>
          <p className="text-sm font-semibold mt-0.5" style={{ color: tournamentWinner ? 'var(--text)' : 'var(--text-subtle)' }}>
            {tournamentWinner ? <CountryName name={tournamentWinner} /> : 'Awaiting the completed final'}
          </p>
        </div>
      </div>

      <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>
        Official top scorer
      </label>
      {!topScorerUnlocked && (
        <p className="text-xs mb-2" style={{ color: 'var(--gold)' }}>
          Available after the semi-final deadline
          {deadlines.semiFinalKickoff ? ` (${formatDateTime(deadlines.semiFinalKickoff)})` : ''}.
        </p>
      )}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <User
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-subtle)' }}
          />
          <input
            value={topScorer}
            onChange={event => setTopScorer(event.target.value)}
            disabled={!topScorerUnlocked}
            maxLength={100}
            placeholder="Player name"
            className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm outline-none"
            style={{
              background: 'var(--bg)',
              border: '1.5px solid var(--border)',
              color: 'var(--text)',
              cursor: topScorerUnlocked ? 'text' : 'not-allowed',
              opacity: topScorerUnlocked ? 1 : 0.65,
            }}
          />
        </div>
        <button
          type="button"
          onClick={saveTopScorer}
          disabled={!topScorerUnlocked || !topScorer.trim() || state === 'saving'}
          className="flex items-center justify-center gap-1.5 px-3 rounded-lg text-xs font-semibold"
          style={{
            background: topScorerUnlocked && topScorer.trim() ? 'var(--accent)' : 'var(--surface-2)',
            color: topScorerUnlocked && topScorer.trim() ? '#000' : 'var(--text-subtle)',
            cursor: topScorerUnlocked && topScorer.trim() && state !== 'saving' ? 'pointer' : 'not-allowed',
          }}
        >
          {state === 'saving' ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          {state === 'saved' ? 'Saved' : 'Save'}
        </button>
      </div>
      {error && <p className="text-xs mt-2" style={{ color: 'var(--red)' }}>{error}</p>}
      {savedTopScorer && state === 'idle' && (
        <p className="text-xs mt-2" style={{ color: 'var(--text-subtle)' }}>
          Current official result: {savedTopScorer}
        </p>
      )}
    </section>
  )
}

function ResultRow({ match, leagueId }: { match: Match; leagueId: string }) {
  const router = useRouter()
  const [home, setHome] = useState(match.home_score?.toString() ?? '')
  const [away, setAway] = useState(match.away_score?.toString() ?? '')
  const [shootoutWinner, setShootoutWinner] = useState(match.result_winner_team ?? '')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState('')
  const { date, time } = formatKickoff(match.kickoff_time)
  const isPenaltyEligible = match.stage !== 'group'
  const isTiedKnockout =
    isPenaltyEligible &&
    home !== '' &&
    away !== '' &&
    Number(home) === Number(away)
  const ready =
    home !== '' &&
    away !== '' &&
    state !== 'saving' &&
    (!isTiedKnockout || shootoutWinner === match.home_team || shootoutWinner === match.away_team)

  const submit = async () => {
    if (!ready) return
    setState('saving')
    setError('')
    try {
      const res = await fetch('/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match_id: match.id,
          league_id: leagueId,
          home_score: Number(home),
          away_score: Number(away),
          shootout_winner_team: isTiedKnockout ? shootoutWinner : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setState('error')
        setError(data.error ?? 'Failed to save result')
        return
      }
      setShootoutWinner(data.match.result_winner_team ?? '')
      setState('saved')
      router.refresh()
      setTimeout(() => setState('idle'), 3000)
    } catch {
      setState('error')
      setError('Failed to save result')
    }
  }

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{date} - {time}</span>
        {match.status === 'finished' && (
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
            Entered
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="flex-1 min-w-0 text-sm font-medium text-right" style={{ color: 'var(--text)' }}>
          <CountryName name={match.home_team} reverse className="justify-end" />
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <input
            type="number"
            min={0}
            max={20}
            value={home}
            onChange={event => setHome(event.target.value)}
            className="w-10 h-10 rounded-lg text-center text-lg font-bold tabular-nums outline-none"
            style={{ background: 'var(--bg)', border: '1.5px solid var(--border)', color: 'var(--text)' }}
          />
          <span className="font-bold" style={{ color: 'var(--text-subtle)' }}>-</span>
          <input
            type="number"
            min={0}
            max={20}
            value={away}
            onChange={event => setAway(event.target.value)}
            className="w-10 h-10 rounded-lg text-center text-lg font-bold tabular-nums outline-none"
            style={{ background: 'var(--bg)', border: '1.5px solid var(--border)', color: 'var(--text)' }}
          />
        </div>
        <span className="flex-1 min-w-0 text-sm font-medium" style={{ color: 'var(--text)' }}>
          <CountryName name={match.away_team} />
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={!ready}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all shrink-0"
          style={{
            background: ready ? state === 'saved' ? 'var(--accent-glow)' : 'var(--accent)' : 'var(--surface-2)',
            color: ready ? state === 'saved' ? 'var(--accent)' : '#000' : 'var(--text-subtle)',
            cursor: ready ? 'pointer' : 'not-allowed',
          }}
        >
          {state === 'saving' ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          {state === 'saved' ? 'Saved' : 'Save'}
        </button>
      </div>

      {isTiedKnockout && (
        <div className="mt-3">
          <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--gold)' }}>
            Penalty shootout winner
          </label>
          <select
            value={shootoutWinner}
            onChange={event => setShootoutWinner(event.target.value)}
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
            style={{ background: 'var(--bg)', border: '1.5px solid var(--border)', color: 'var(--text)' }}
          >
            <option value="">Select winner</option>
            <option value={match.home_team}>{formatCountryName(match.home_team)}</option>
            <option value={match.away_team}>{formatCountryName(match.away_team)}</option>
          </select>
        </div>
      )}

      {isPenaltyEligible && match.result_winner_team && !isTiedKnockout && (
        <p className="text-xs mt-2 text-center" style={{ color: 'var(--gold)' }}>
          <span className="inline-flex items-center justify-center gap-1">
            {match.stage === 'final' ? 'Champion' : 'Winner'}: <CountryName name={match.result_winner_team} />
          </span>
        </p>
      )}
      {error && <p className="text-xs mt-2 text-center" style={{ color: 'var(--red)' }}>{error}</p>}
    </div>
  )
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
