import type { Match } from '@/types'

export interface PickDeadlines {
  firstKickoff: string | null
  roundOf16Kickoff: string | null
  quarterFinalKickoff: string | null
  semiFinalKickoff: string | null
  finalKickoff: string | null
}

export const WINNER_BONUS_TIERS = [
  { before: 'firstKickoff', label: 'Before first kick-off', points: 30 },
  { before: 'roundOf16Kickoff', label: 'Before round of 16', points: 24 },
  { before: 'quarterFinalKickoff', label: 'Before quarter-finals', points: 18 },
  { before: 'semiFinalKickoff', label: 'Before semi-finals', points: 12 },
  { before: 'finalKickoff', label: 'Before final', points: 6 },
] as const satisfies ReadonlyArray<{
  before: keyof PickDeadlines
  label: string
  points: number
}>

export const TOP_SCORER_BONUS_TIERS = [
  { before: 'firstKickoff', label: 'Before first kick-off', points: 20 },
  { before: 'roundOf16Kickoff', label: 'Before round of 16', points: 16 },
  { before: 'quarterFinalKickoff', label: 'Before quarter-finals', points: 12 },
  { before: 'semiFinalKickoff', label: 'Before semi-finals', points: 8 },
] as const satisfies ReadonlyArray<{
  before: keyof PickDeadlines
  label: string
  points: number
}>

function earliestKickoff(matches: Match[], stage: Match['stage']): string | null {
  const atStage = matches
    .filter(m => m.stage === stage)
    .map(m => m.kickoff_time)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
  return atStage[0] ?? null
}

export function getPickDeadlines(matches: Match[]): PickDeadlines {
  const sortedKickoffs = matches
    .map(m => m.kickoff_time)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

  return {
    firstKickoff: sortedKickoffs[0] ?? null,
    roundOf16Kickoff: earliestKickoff(matches, 'round_of_16'),
    quarterFinalKickoff: earliestKickoff(matches, 'quarter_final'),
    semiFinalKickoff: earliestKickoff(matches, 'semi_final'),
    finalKickoff: earliestKickoff(matches, 'final'),
  }
}

export function isDeadlinePassed(deadline: string | null, now = new Date()): boolean {
  if (!deadline) return false
  return now.getTime() >= new Date(deadline).getTime()
}

export function winnerPointsForSubmittedAt(submittedAt: string | null | undefined, deadlines: PickDeadlines): number {
  if (!submittedAt) return 0
  const t = new Date(submittedAt).getTime()

  for (const tier of WINNER_BONUS_TIERS) {
    const deadline = deadlines[tier.before]
    if (deadline && t < new Date(deadline).getTime()) return tier.points
  }

  return 0
}

export function topScorerPointsForSubmittedAt(submittedAt: string | null | undefined, deadlines: PickDeadlines): number {
  if (!submittedAt) return 0
  const t = new Date(submittedAt).getTime()

  for (const tier of TOP_SCORER_BONUS_TIERS) {
    const deadline = deadlines[tier.before]
    if (deadline && t < new Date(deadline).getTime()) return tier.points
  }

  return 0
}
