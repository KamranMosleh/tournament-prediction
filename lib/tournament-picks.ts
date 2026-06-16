import type { Match } from '@/types'

interface PickDeadlines {
  firstKickoff: string | null
  roundOf16Kickoff: string | null
  quarterFinalKickoff: string | null
  semiFinalKickoff: string | null
  finalKickoff: string | null
}

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

  if (deadlines.firstKickoff && t < new Date(deadlines.firstKickoff).getTime()) return 15
  if (deadlines.roundOf16Kickoff && t < new Date(deadlines.roundOf16Kickoff).getTime()) return 12
  if (deadlines.quarterFinalKickoff && t < new Date(deadlines.quarterFinalKickoff).getTime()) return 9
  if (deadlines.semiFinalKickoff && t < new Date(deadlines.semiFinalKickoff).getTime()) return 6
  if (deadlines.finalKickoff && t < new Date(deadlines.finalKickoff).getTime()) return 3

  return 0
}

export function topScorerPointsForSubmittedAt(submittedAt: string | null | undefined, deadlines: PickDeadlines): number {
  if (!submittedAt) return 0
  const t = new Date(submittedAt).getTime()

  if (deadlines.firstKickoff && t < new Date(deadlines.firstKickoff).getTime()) return 10
  if (deadlines.roundOf16Kickoff && t < new Date(deadlines.roundOf16Kickoff).getTime()) return 8
  if (deadlines.quarterFinalKickoff && t < new Date(deadlines.quarterFinalKickoff).getTime()) return 6
  if (deadlines.semiFinalKickoff && t < new Date(deadlines.semiFinalKickoff).getTime()) return 4

  return 0
}
