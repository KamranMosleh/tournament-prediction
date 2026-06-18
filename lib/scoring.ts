import type { Match, MatchPrediction, TournamentPrediction, PlayerScore, Player, MatchStage, ScoringMode } from '@/types'
import {
  getPickDeadlines,
  isDeadlinePassed,
  topScorerPointsForSubmittedAt,
  winnerPointsForSubmittedAt,
} from '@/lib/tournament-picks'

const STAGE_MULTIPLIERS: Record<MatchStage, number> = {
  group: 1,
  round_of_16: 2,
  quarter_final: 3,
  semi_final: 4,
  third_place: 4,
  final: 5,
}

export function matchPoints(
  predHome: number, predAway: number,
  realHome: number, realAway: number,
  stage: MatchStage,
  mode: ScoringMode = 'multiplied'
): number {
  let base = 0
  if (predHome === realHome && predAway === realAway) {
    base = 3
  } else if (Math.sign(predHome - predAway) === Math.sign(realHome - realAway)) {
    base = 1
  }
  return mode === 'multiplied' ? base * STAGE_MULTIPLIERS[stage] : base
}

export function normalizeFootballName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/['’`-]/g, '')
    .replace(/\s+/g, '')
    .trim()
}

export function footballNamesMatch(left: string, right: string): boolean {
  const normalizedLeft = normalizeFootballName(left)
  const normalizedRight = normalizeFootballName(right)
  return normalizedLeft.length > 0 && normalizedLeft === normalizedRight
}

export function deriveTournamentWinner(matches: Match[]): string | null {
  const final = matches
    .filter(match => match.stage === 'final')
    .sort((a, b) => new Date(b.kickoff_time).getTime() - new Date(a.kickoff_time).getTime())
    .find(match => match.status === 'finished')

  if (!final) return null
  if (final.result_winner_team?.trim()) return final.result_winner_team.trim()
  if (final.home_score === null || final.away_score === null || final.home_score === final.away_score) {
    return null
  }
  return final.home_score > final.away_score ? final.home_team : final.away_team
}

interface ScoreInput {
  players: Player[]
  predictions: MatchPrediction[]
  matches: Match[]
  tournamentPredictions: TournamentPrediction[]
  scoringMode?: ScoringMode
  officialTopScorer?: string | null
  now?: Date
}

export function computeLeaderboard({
  players,
  predictions,
  matches,
  tournamentPredictions,
  scoringMode = 'multiplied',
  officialTopScorer,
  now = new Date(),
}: ScoreInput): PlayerScore[] {
  const finishedMatches = matches.filter(m =>
    m.status === 'finished' && m.home_score !== null && m.away_score !== null
  )
  const pickDeadlines = getPickDeadlines(matches)
  const tournamentWinner = deriveTournamentWinner(matches)
  const winnerAwardable = Boolean(tournamentWinner) && isDeadlinePassed(pickDeadlines.finalKickoff, now)
  const topScorerAwardable = Boolean(officialTopScorer) && isDeadlinePassed(pickDeadlines.semiFinalKickoff, now)

  return players.map(player => {
    let totalMatchPoints = 0
    let exactScores = 0
    let predictionsSubmitted = 0
    let formPoints = 0
    let formMaxPoints = 0

    for (const match of finishedMatches) {
      const maxPoints = scoringMode === 'multiplied' ? STAGE_MULTIPLIERS[match.stage] * 3 : 3
      const isAfterJoin = player.joined_match_day == null ||
        match.match_day == null ||
        match.match_day >= player.joined_match_day

      if (isAfterJoin) formMaxPoints += maxPoints

      const pred = predictions.find(p => p.player_id === player.id && p.match_id === match.id)
      if (!pred) continue

      predictionsSubmitted++
      const pts = matchPoints(pred.home_score, pred.away_score, match.home_score!, match.away_score!, match.stage, scoringMode)
      totalMatchPoints += pts
      if (pred.home_score === match.home_score && pred.away_score === match.away_score) exactScores++
      if (isAfterJoin) formPoints += pts
    }

    let tournamentPoints = 0
    const tp = tournamentPredictions.find(p => p.player_id === player.id)
    if (tp) {
      const winnerSubmittedAt = tp.winner_submitted_at ?? tp.submitted_at
      const scorerSubmittedAt = tp.top_scorer_submitted_at ?? tp.submitted_at

      if (winnerAwardable && tournamentWinner && footballNamesMatch(tp.winner_team, tournamentWinner)) {
        tournamentPoints += winnerPointsForSubmittedAt(winnerSubmittedAt, pickDeadlines)
      }
      if (topScorerAwardable && officialTopScorer && footballNamesMatch(tp.top_scorer_name, officialTopScorer)) {
        tournamentPoints += topScorerPointsForSubmittedAt(scorerSubmittedAt, pickDeadlines)
      }
    }

    return {
      player_id: player.id,
      display_name: player.display_name,
      joined_match_day: player.joined_match_day,
      match_points: totalMatchPoints,
      tournament_points: tournamentPoints,
      total_points: totalMatchPoints + tournamentPoints,
      exact_scores: exactScores,
      predictions_submitted: predictionsSubmitted,
      form_points: formPoints,
      form_max_points: formMaxPoints,
    }
  })
}

export function sortLeaderboard(scores: PlayerScore[]): PlayerScore[] {
  return [...scores].sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points
    return b.exact_scores - a.exact_scores
  })
}
