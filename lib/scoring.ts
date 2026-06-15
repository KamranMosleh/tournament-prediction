import type { Match, MatchPrediction, TournamentPrediction, PlayerScore, Player, MatchStage, ScoringMode } from '@/types'
import { getPickDeadlines, topScorerPointsForSubmittedAt, winnerPointsForSubmittedAt } from '@/lib/tournament-picks'

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

interface ScoreInput {
  players: Player[]
  predictions: MatchPrediction[]
  matches: Match[]
  tournamentPredictions: TournamentPrediction[]
  scoringMode?: ScoringMode
  tournamentWinner?: string | null
  goldenBoot?: string | null
}

export function computeLeaderboard({
  players,
  predictions,
  matches,
  tournamentPredictions,
  scoringMode = 'multiplied',
  tournamentWinner,
  goldenBoot,
}: ScoreInput): PlayerScore[] {
  const finishedMatches = matches.filter(m =>
    m.status === 'finished' && m.home_score !== null && m.away_score !== null
  )
  const pickDeadlines = getPickDeadlines(matches)

  return players.map(player => {
    let totalMatchPoints = 0
    let exactScores = 0
    let predictionsSubmitted = 0
    let formPoints = 0
    let formMaxPoints = 0

    for (const match of finishedMatches) {
      const pts3 = STAGE_MULTIPLIERS[match.stage] * 3
      const isAfterJoin = player.joined_match_day == null ||
        match.match_day == null ||
        match.match_day >= player.joined_match_day

      if (isAfterJoin) formMaxPoints += pts3

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

      if (tournamentWinner && tp.winner_team.toLowerCase() === tournamentWinner.toLowerCase()) {
        tournamentPoints += winnerPointsForSubmittedAt(winnerSubmittedAt, pickDeadlines)
      }
      if (goldenBoot && tp.top_scorer_name.toLowerCase() === goldenBoot.toLowerCase()) {
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
