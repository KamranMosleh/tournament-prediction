import type { Match, MatchPrediction, TournamentPrediction, PlayerScore, Player, MatchStage, ScoringMode } from '@/types'
import {
  getPickDeadlines,
  isDeadlinePassed,
  topScorerPointsForSubmittedAt,
  winnerPointsForSubmittedAt,
} from '@/lib/tournament-picks'

export const BASE_MATCH_POINTS = {
  exact: 3,
  difference: 2,
  outcome: 1,
  wrong: 0,
} as const

export const PENALTY_BONUS_POINTS: Readonly<Record<ScoringMode, number>> = {
  flat: 1,
  multiplied: 2,
}

export const STAGE_MULTIPLIERS: Readonly<Record<MatchStage, number>> = {
  group: 1,
  round_of_32: 2,
  round_of_16: 2,
  quarter_final: 3,
  semi_final: 4,
  third_place: 4,
  final: 5,
}

export type MatchPointKind = keyof typeof BASE_MATCH_POINTS

export interface PredictionPointsResult {
  normal_points: number
  penalty_bonus: number
  total_points: number
  kind: MatchPointKind
}

function predictedWinnerTeam(predHome: number, predAway: number, homeTeam?: string | null, awayTeam?: string | null): string | null {
  if (!homeTeam || !awayTeam || predHome === predAway) return null
  return predHome > predAway ? homeTeam : awayTeam
}

function matchPointKind(
  predHome: number,
  predAway: number,
  realHome: number,
  realAway: number
): MatchPointKind {
  const predictedDifference = predHome - predAway
  const realDifference = realHome - realAway

  if (predHome === realHome && predAway === realAway) return 'exact'
  if (predictedDifference === realDifference) return 'difference'
  if (Math.sign(predictedDifference) === Math.sign(realDifference)) return 'outcome'
  return 'wrong'
}

function predictionPointKind({
  predHome,
  predAway,
  realHome,
  realAway,
  stage,
  homeTeam,
  awayTeam,
  resultWinnerTeam,
  wentToPenalties,
}: {
  predHome: number
  predAway: number
  realHome: number
  realAway: number
  stage: MatchStage
  homeTeam?: string | null
  awayTeam?: string | null
  resultWinnerTeam?: string | null
  wentToPenalties?: boolean | null
}): MatchPointKind {
  const scoreKind = matchPointKind(predHome, predAway, realHome, realAway)
  if (scoreKind !== 'wrong') return scoreKind

  const predictedWinner = predictedWinnerTeam(predHome, predAway, homeTeam, awayTeam)
  if (
    stage !== 'group' &&
    wentToPenalties === true &&
    predictedWinner &&
    resultWinnerTeam?.trim() &&
    footballNamesMatch(predictedWinner, resultWinnerTeam)
  ) {
    return 'outcome'
  }

  return scoreKind
}

export function matchPoints(
  predHome: number, predAway: number,
  realHome: number, realAway: number,
  stage: MatchStage,
  mode: ScoringMode = 'multiplied'
): number {
  const base = BASE_MATCH_POINTS[matchPointKind(predHome, predAway, realHome, realAway)]
  return mode === 'multiplied' ? base * STAGE_MULTIPLIERS[stage] : base
}

export function predictionPoints({
  predHome,
  predAway,
  realHome,
  realAway,
  stage,
  mode = 'multiplied',
  homeTeam,
  awayTeam,
  predictedPenaltyWinner,
  resultWinnerTeam,
  wentToPenalties,
}: {
  predHome: number
  predAway: number
  realHome: number
  realAway: number
  stage: MatchStage
  mode?: ScoringMode
  homeTeam?: string | null
  awayTeam?: string | null
  predictedPenaltyWinner?: string | null
  resultWinnerTeam?: string | null
  wentToPenalties?: boolean | null
}): PredictionPointsResult {
  const kind = predictionPointKind({
    predHome,
    predAway,
    realHome,
    realAway,
    stage,
    homeTeam,
    awayTeam,
    resultWinnerTeam,
    wentToPenalties,
  })
  const base = BASE_MATCH_POINTS[kind]
  const normalPoints = mode === 'multiplied' ? base * STAGE_MULTIPLIERS[stage] : base
  const penaltyBonus =
    stage !== 'group' &&
    predHome === predAway &&
    wentToPenalties === true &&
    !!predictedPenaltyWinner?.trim() &&
    !!resultWinnerTeam?.trim() &&
    footballNamesMatch(predictedPenaltyWinner, resultWinnerTeam)
      ? PENALTY_BONUS_POINTS[mode]
      : 0

  return {
    normal_points: normalPoints,
    penalty_bonus: penaltyBonus,
    total_points: normalPoints + penaltyBonus,
    kind,
  }
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

const KYLIAN_MBAPPE_ALIASES = new Set([
  'kylianmbappe',
  'kylianmbape',
  'killianmbappe',
  'killianmbape',
  'kilianmbappe',
  'kilianmbape',
  'mbappe',
  'mbape',
])

export function topScorerNamesMatch(left: string, right: string): boolean {
  const normalizedLeft = normalizeFootballName(left)
  const normalizedRight = normalizeFootballName(right)

  if (!normalizedLeft || !normalizedRight) return false
  if (normalizedLeft === normalizedRight) return true

  return KYLIAN_MBAPPE_ALIASES.has(normalizedLeft) &&
    KYLIAN_MBAPPE_ALIASES.has(normalizedRight)
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
    let correctDifference = 0
    let correctOutcome = 0
    let wrongOutcome = 0
    let predictionsSubmitted = 0
    let formPoints = 0
    let formMaxPoints = 0
    let totalGoalError = 0
    let goalErrorCount = 0

    for (const match of finishedMatches) {
      const maxPoints = scoringMode === 'multiplied'
        ? STAGE_MULTIPLIERS[match.stage] * BASE_MATCH_POINTS.exact
        : BASE_MATCH_POINTS.exact
      const maxPenaltyBonus = match.went_to_penalties === true && match.stage !== 'group'
        ? PENALTY_BONUS_POINTS[scoringMode]
        : 0
      const isAfterJoin = player.joined_match_day == null ||
        match.match_day == null ||
        match.match_day >= player.joined_match_day

      if (isAfterJoin) formMaxPoints += maxPoints + maxPenaltyBonus

      const pred = predictions.find(p => p.player_id === player.id && p.match_id === match.id)
      if (!pred) continue

      predictionsSubmitted++
      const predResult = predictionPoints({
        predHome: pred.home_score,
        predAway: pred.away_score,
        realHome: match.home_score!,
        realAway: match.away_score!,
        stage: match.stage,
        mode: scoringMode,
        homeTeam: match.home_team,
        awayTeam: match.away_team,
        predictedPenaltyWinner: pred.penalty_winner_team,
        resultWinnerTeam: match.result_winner_team,
        wentToPenalties: match.went_to_penalties,
      })
      const pts = predResult.total_points
      totalMatchPoints += pts
      totalGoalError += Math.abs(pred.home_score - match.home_score!) + Math.abs(pred.away_score - match.away_score!)
      goalErrorCount++

      const kind = predResult.kind
      if (kind === 'exact') exactScores++
      else if (kind === 'difference') correctDifference++
      else if (kind === 'outcome') correctOutcome++
      else if (kind === 'wrong') wrongOutcome++

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
      if (topScorerAwardable && officialTopScorer && topScorerNamesMatch(tp.top_scorer_name, officialTopScorer)) {
        tournamentPoints += topScorerPointsForSubmittedAt(scorerSubmittedAt, pickDeadlines)
      }
    }

    const averageGoalError = goalErrorCount > 0 ? totalGoalError / goalErrorCount : null
    const goalErrorScore = averageGoalError === null
      ? null
      : Math.max(0, Math.round(100 - averageGoalError * 25))

    return {
      player_id: player.id,
      display_name: player.display_name,
      joined_match_day: player.joined_match_day,
      match_points: totalMatchPoints,
      tournament_points: tournamentPoints,
      total_points: totalMatchPoints + tournamentPoints,
      exact_scores: exactScores,
      correct_difference: correctDifference,
      correct_outcome: correctOutcome,
      wrong_outcome: wrongOutcome,
      predictions_submitted: predictionsSubmitted,
      form_points: formPoints,
      form_max_points: formMaxPoints,
      average_goal_error: averageGoalError,
      goal_error_score: goalErrorScore,
    }
  })
}

export function sortLeaderboard(scores: PlayerScore[]): PlayerScore[] {
  return [...scores].sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points
    return b.exact_scores - a.exact_scores
  })
}
