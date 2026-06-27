import { predictionPoints } from '@/lib/scoring'
import type {
  Match,
  MatchPrediction,
  MatchRevealData,
  Player,
  ScoringMode,
} from '@/types'

function outcomeBucket(home: number, away: number): 'home_win' | 'draw' | 'away_win' {
  if (home > away) return 'home_win'
  if (home < away) return 'away_win'
  return 'draw'
}

export function buildMatchRevealData(
  match: Match,
  players: Player[],
  predictions: MatchPrediction[],
  scoringMode: ScoringMode
): MatchRevealData {
  const byPlayer = new Map(predictions.map(p => [p.player_id, p]))

  const scoreCount = new Map<string, number>()
  const outcomeCounts = { home_win: 0, draw: 0, away_win: 0 }

  for (const p of predictions) {
    const score = `${p.home_score}-${p.away_score}`
    scoreCount.set(score, (scoreCount.get(score) ?? 0) + 1)
    const bucket = outcomeBucket(p.home_score, p.away_score)
    outcomeCounts[bucket] += 1
  }

  const topScores = [...scoreCount.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([score, count]) => ({ score, count }))

  const entries = players
    .map(player => {
      const pred = byPlayer.get(player.id)
      if (!pred) return null

      const points =
        match.status === 'finished' && match.home_score !== null && match.away_score !== null
          ? predictionPoints({
              predHome: pred.home_score,
              predAway: pred.away_score,
              realHome: match.home_score,
              realAway: match.away_score,
              stage: match.stage,
              mode: scoringMode,
              predictedPenaltyWinner: pred.penalty_winner_team,
              resultWinnerTeam: match.result_winner_team,
              wentToPenalties: match.went_to_penalties,
            }).total_points
          : null

      return {
        player_id: player.id,
        player_name: player.display_name,
        score: formatPredictionScore(pred),
        points,
      }
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)

  return {
    aggregate: {
      total_players: players.length,
      predicted_count: predictions.length,
      missing_count: Math.max(players.length - predictions.length, 0),
      top_scores: topScores,
      outcome_counts: outcomeCounts,
    },
    entries,
  }
}

function formatPredictionScore(prediction: MatchPrediction): string {
  const score = `${prediction.home_score}-${prediction.away_score}`
  return prediction.penalty_winner_team
    ? `${score}, pens: ${prediction.penalty_winner_team}`
    : score
}
