import { createServiceClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'
import { groqComplete, groqCompleteJSON, insightPrompt, punditsPrompt, dailyPunditPrompt, matchRecapPrompt, type PlayerPredictionInput } from '@/lib/groq'
import { getMatchContext, formatContext, deriveDifficulty } from '@/lib/football-context'
import { computeLeaderboard, sortLeaderboard, predictionPoints } from '@/lib/scoring'
import { formatCoverageLabel, getVenueLocalDateInfo } from '@/lib/venue-date'
import type {
  League,
  Match,
  MatchPrediction,
  Player,
  PlayerRoast,
  PlayerScore,
  TournamentPrediction,
} from '@/types'

type ServiceClient = ReturnType<typeof createServiceClient>

export type SummaryGenerationResult = {
  status: 'created' | 'updated' | 'skipped' | 'error'
  reason?: string
}

type ExistingMatchRecap = {
  id: string
  roasts: PlayerRoast[] | null
}

export type BatchGenerationResult = {
  created: number
  updated: number
  skipped: number
  errors: number
}

export type OpenMatchEnrichmentResult = {
  processed: number
  difficultyUpdated: number
  insightsCreated: number
  insightsSkipped: number
  errors: number
  groqEnabled: boolean
}

export type OpenMatchEnrichmentOptions = {
  force?: boolean
}

function emptyOpenMatchEnrichmentResult(groqEnabled: boolean): OpenMatchEnrichmentResult {
  return {
    processed: 0,
    difficultyUpdated: 0,
    insightsCreated: 0,
    insightsSkipped: 0,
    errors: 0,
    groqEnabled,
  }
}

function isResolvedTeamName(teamName: string): boolean {
  const normalized = teamName.trim().toUpperCase()

  return !!normalized && ![
    'TBD',
    'TBA',
    'TO BE DETERMINED',
    'TO BE DECIDED',
    'TO BE CONFIRMED',
    'TO BE ANNOUNCED',
  ].includes(normalized)
}

function hasResolvedMatchup(homeTeam: string, awayTeam: string): boolean {
  return isResolvedTeamName(homeTeam) && isResolvedTeamName(awayTeam)
}

function insightContainsPlaceholder(insight: string | null): boolean {
  return !!insight && /\b(?:TBD|TBA)\b|to be (?:determined|decided|confirmed|announced)/i.test(insight)
}

export function mergeOpenMatchEnrichmentResults(
  results: OpenMatchEnrichmentResult[]
): OpenMatchEnrichmentResult {
  return results.reduce<OpenMatchEnrichmentResult>(
    (total, res) => ({
      processed: total.processed + res.processed,
      difficultyUpdated: total.difficultyUpdated + res.difficultyUpdated,
      insightsCreated: total.insightsCreated + res.insightsCreated,
      insightsSkipped: total.insightsSkipped + res.insightsSkipped,
      errors: total.errors + res.errors,
      groqEnabled: total.groqEnabled || res.groqEnabled,
    }),
    emptyOpenMatchEnrichmentResult(false)
  )
}

export async function enrichOpenMatchesForTournament(
  tournamentCode: string,
  tournamentSeason: number,
  options: OpenMatchEnrichmentOptions = {},
  supabaseArg?: ServiceClient
): Promise<OpenMatchEnrichmentResult> {
  const supabase = supabaseArg ?? createServiceClient()
  const hasGroq = !!process.env.GROQ_API_KEY
  const result = emptyOpenMatchEnrichmentResult(hasGroq)

  const { data: matches, error } = await supabase
    .from('matches')
    .select('id, home_team, away_team, tournament_code, tournament_season, stage, ai_insight')
    .eq('tournament_code', tournamentCode)
    .eq('tournament_season', tournamentSeason)
    .eq('status', 'open')
    .order('kickoff_time', { ascending: true })

  if (error) {
    result.errors++
    return result
  }

  for (const match of (matches ?? []) as Pick<
    Match,
    'id' | 'home_team' | 'away_team' | 'tournament_code' | 'tournament_season' | 'stage' | 'ai_insight'
  >[]) {
    result.processed++

    try {
      const ctx = await getMatchContext(
        match.home_team,
        match.away_team,
        match.tournament_code,
        match.tournament_season,
        supabase
      )
      const difficulty = deriveDifficulty(ctx)
      const teamsResolved = hasResolvedMatchup(match.home_team, match.away_team)
      const hasStalePlaceholderInsight = teamsResolved && insightContainsPlaceholder(match.ai_insight)
      const shouldGenerateInsight = teamsResolved && (
        options.force ||
        !match.ai_insight ||
        hasStalePlaceholderInsight
      )

      let insight: string | null = null
      if (shouldGenerateInsight) {
        if (hasGroq) {
          const tournament = `${match.tournament_code} ${match.tournament_season}`
          const liveContext = formatContext(match.home_team, match.away_team, ctx)

          insight = await groqComplete(
            insightPrompt(match.home_team, match.away_team, tournament, match.stage, liveContext || undefined),
            120
          )
          if (insightContainsPlaceholder(insight)) insight = null

          // Groq's public rate limit is modest; keep automated batches gentle.
          await new Promise(r => setTimeout(r, 2100))
        }

        if (!insight) result.insightsSkipped++
      } else {
        result.insightsSkipped++
      }

      const update: {
        ai_difficulty: ReturnType<typeof deriveDifficulty>
        ai_insight?: string | null
        ai_insight_generated_at?: string | null
      } = { ai_difficulty: difficulty }

      if (insight !== null) {
        update.ai_insight = insight
        update.ai_insight_generated_at = new Date().toISOString()
      } else if (hasStalePlaceholderInsight) {
        update.ai_insight = null
        update.ai_insight_generated_at = null
      }

      const { error: updateError } = await supabase
        .from('matches')
        .update(update)
        .eq('id', match.id)

      if (updateError) {
        result.errors++
        continue
      }

      result.difficultyUpdated++
      if (insight !== null) result.insightsCreated++
    } catch {
      result.errors++
    }
  }

  return result
}

async function isMatchDayComplete(
  supabase: ServiceClient,
  tournamentCode: string,
  tournamentSeason: number,
  matchDay: number
): Promise<boolean> {
  const { data: dayMatches } = await supabase
    .from('matches')
    .select('id, status')
    .eq('tournament_code', tournamentCode)
    .eq('tournament_season', tournamentSeason)
    .eq('match_day', matchDay)

  if (!dayMatches?.length) return false
  return dayMatches.every((m: { status: string }) => m.status === 'finished')
}

export async function generatePunditSummaryForMatchDay(
  leagueId: string,
  matchDay: number,
  supabaseArg?: ServiceClient
): Promise<SummaryGenerationResult> {
  if (!process.env.GROQ_API_KEY) {
    return { status: 'skipped', reason: 'GROQ_API_KEY not set' }
  }

  const supabase = supabaseArg ?? createServiceClient()

  const { data: existing } = await supabase
    .from('matchday_summaries')
    .select('id')
    .eq('league_id', leagueId)
    .eq('match_day', matchDay)
    .single()

  if (existing) return { status: 'skipped', reason: 'already exists' }

  const { data: league } = await supabase
    .from('leagues')
    .select('*')
    .eq('id', leagueId)
    .single()

  if (!league) return { status: 'error', reason: 'League not found' }

  const isComplete = await isMatchDayComplete(
    supabase,
    league.tournament_code,
    league.tournament_season,
    matchDay
  )

  if (!isComplete) {
    return { status: 'skipped', reason: 'matchday not fully finished' }
  }

  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .eq('tournament_code', league.tournament_code)
    .eq('tournament_season', league.tournament_season)
    .eq('match_day', matchDay)
    .eq('status', 'finished')

  if (!matches?.length) {
    return { status: 'skipped', reason: 'no finished matches' }
  }

  const { data: scoringMatches } = await supabase
    .from('matches')
    .select('*')
    .eq('tournament_code', league.tournament_code)
    .eq('tournament_season', league.tournament_season)

  const { data: players } = await supabase
    .from('players')
    .select('*')
    .eq('league_id', leagueId)

  const typedPlayers = (players ?? []) as Player[]
  const playerIds = typedPlayers.map((p: Player) => p.id)
  const { data: predictions } = playerIds.length > 0
    ? await supabase.from('match_predictions').select('*').in('player_id', playerIds)
    : { data: [] }

  const { data: tournamentPreds } = await supabase
    .from('tournament_predictions')
    .select('*')
    .eq('league_id', leagueId)

  const typedLeague = league as League
  const typedMatches = matches as Match[]
  const typedScoringMatches = (scoringMatches ?? []) as Match[]
  const typedPredictions = (predictions ?? []) as MatchPrediction[]
  const typedTournamentPreds = (tournamentPreds ?? []) as TournamentPrediction[]

  const results = typedMatches
    .map(formatMatchResultLine)
    .join(', ')

  const scores = sortLeaderboard(computeLeaderboard({
    players: typedPlayers,
    predictions: typedPredictions,
    matches: typedScoringMatches,
    tournamentPredictions: typedTournamentPreds,
    scoringMode: typedLeague.scoring_mode,
    officialTopScorer: typedLeague.official_top_scorer_name,
  }))

  const previousScores = computeLeaderboardBeforeCoverage({
    players: typedPlayers,
    predictions: typedPredictions,
    matches: typedScoringMatches,
    coveredMatches: typedMatches,
    tournamentPredictions: typedTournamentPreds,
    league: typedLeague,
  })
  const leaderboardContext = buildLeaderboardPromptSections(scores, previousScores)

  const summary = await groqComplete(
    punditsPrompt(matchDay, results, leaderboardContext.leaderboard, leaderboardContext.movement),
    250
  )
  if (!summary) return { status: 'error', reason: 'Groq returned null' }

  const { error: insertError } = await supabase
    .from('matchday_summaries')
    .insert({ league_id: leagueId, match_day: matchDay, summary_text: summary })

  if (insertError) {
    // Unique violation can happen when concurrent jobs race for the same matchday.
    if (insertError.code === '23505') {
      return { status: 'skipped', reason: 'already exists' }
    }
    return { status: 'error', reason: insertError.message }
  }

  return { status: 'created' }
}

export async function autoGeneratePunditSummariesForLeagueMatchDay(
  leagueId: string,
  matchDay: number,
  supabaseArg?: ServiceClient
): Promise<SummaryGenerationResult> {
  return generatePunditSummaryForMatchDay(leagueId, matchDay, supabaseArg)
}

export async function autoGeneratePunditSummariesForTournament(
  tournamentCode: string,
  tournamentSeason: number,
  supabaseArg?: ServiceClient
): Promise<BatchGenerationResult> {
  const supabase = supabaseArg ?? createServiceClient()

  const { data: leagues } = await supabase
    .from('leagues')
    .select('id')
    .eq('tournament_code', tournamentCode)
    .eq('tournament_season', tournamentSeason)
    .is('archived_at', null)

  if (!leagues?.length) return { created: 0, updated: 0, skipped: 0, errors: 0 }

  const { data: allMatches } = await supabase
    .from('matches')
    .select('match_day, status')
    .eq('tournament_code', tournamentCode)
    .eq('tournament_season', tournamentSeason)
    .not('match_day', 'is', null)

  if (!allMatches?.length) return { created: 0, updated: 0, skipped: 0, errors: 0 }

  const dayStats = new Map<number, { total: number; finished: number }>()
  for (const row of allMatches as Array<{ match_day: number; status: string }>) {
    const stat = dayStats.get(row.match_day) ?? { total: 0, finished: 0 }
    stat.total += 1
    if (row.status === 'finished') stat.finished += 1
    dayStats.set(row.match_day, stat)
  }

  const completeDays = [...dayStats.entries()]
    .filter(([, stat]) => stat.total > 0 && stat.finished === stat.total)
    .map(([day]) => day)
    .sort((a, b) => a - b)

  if (!completeDays.length) return { created: 0, updated: 0, skipped: 0, errors: 0 }

  let created = 0
  let updated = 0
  let skipped = 0
  let errors = 0

  for (const league of leagues as Array<{ id: string }>) {
    for (const day of completeDays) {
      const res = await generatePunditSummaryForMatchDay(league.id, day, supabase)
      if (res.status === 'created') created++
      else if (res.status === 'updated') updated++
      else if (res.status === 'skipped') skipped++
      else errors++
    }
  }

  return { created, updated, skipped, errors }
}

type DailyCoverageGroup = {
  localDate: string
  coverageKey: string
  coverageLabel: string
  matches: Match[]
}

type ExistingDailySummary = {
  id: string
  coverage_fingerprint: string | null
}

type RankedPlayerScore = PlayerScore & { rank: number }

type LeaderboardMovement = {
  player_id: string
  display_name: string
  previousRank: number
  currentRank: number
  rankDelta: number
  previousPoints: number
  currentPoints: number
  pointsDelta: number
}

function rankScores(scores: PlayerScore[]): Map<string, RankedPlayerScore> {
  const ranks = new Map<string, RankedPlayerScore>()
  scores.forEach((score, index) => {
    ranks.set(score.player_id, { ...score, rank: index + 1 })
  })
  return ranks
}

function beforeCoverageDate(coveredMatches: Match[]): Date {
  const kickoffTimes = coveredMatches
    .map(match => new Date(match.kickoff_time).getTime())
    .filter(time => Number.isFinite(time))

  return kickoffTimes.length > 0
    ? new Date(Math.min(...kickoffTimes) - 1)
    : new Date()
}

function matchesBeforeCoverage(matches: Match[], coveredMatches: Match[]): Match[] {
  const coveredIds = new Set(coveredMatches.map(match => match.id))

  return matches.map(match => coveredIds.has(match.id)
    ? {
        ...match,
        status: 'locked' as const,
        home_score: null,
        away_score: null,
        result_winner_team: null,
        went_to_penalties: false,
      }
    : match
  )
}

function computeLeaderboardBeforeCoverage({
  players,
  predictions,
  matches,
  coveredMatches,
  tournamentPredictions,
  league,
}: {
  players: Player[]
  predictions: MatchPrediction[]
  matches: Match[]
  coveredMatches: Match[]
  tournamentPredictions: TournamentPrediction[]
  league: League
}): PlayerScore[] {
  return sortLeaderboard(computeLeaderboard({
    players,
    predictions,
    matches: matchesBeforeCoverage(matches, coveredMatches),
    tournamentPredictions,
    scoringMode: league.scoring_mode,
    officialTopScorer: league.official_top_scorer_name,
    now: beforeCoverageDate(coveredMatches),
  }))
}

function buildLeaderboardMovements(
  currentScores: PlayerScore[],
  previousScores: PlayerScore[]
): LeaderboardMovement[] {
  const previousRanks = rankScores(previousScores)

  return currentScores.map((score, index) => {
    const previous = previousRanks.get(score.player_id)
    const currentRank = index + 1
    const previousRank = previous?.rank ?? currentRank
    const previousPoints = previous?.total_points ?? 0

    return {
      player_id: score.player_id,
      display_name: score.display_name,
      previousRank,
      currentRank,
      rankDelta: previousRank - currentRank,
      previousPoints,
      currentPoints: score.total_points,
      pointsDelta: score.total_points - previousPoints,
    }
  })
}

function formatPointDelta(delta: number): string {
  const abs = Math.abs(delta)
  const suffix = abs === 1 ? 'pt' : 'pts'
  const sign = delta > 0 ? '+' : delta < 0 ? '-' : ''
  return `${sign}${abs}${suffix}`
}

function formatRankDelta(delta: number): string {
  const abs = Math.abs(delta)
  const suffix = abs === 1 ? 'place' : 'places'
  if (delta > 0) return `up ${abs} ${suffix}`
  if (delta < 0) return `down ${abs} ${suffix}`
  return 'held position'
}

function formatLeaderboardRow(movement: LeaderboardMovement): string {
  const rankText = movement.rankDelta === 0
    ? `held #${movement.currentRank}`
    : `was #${movement.previousRank}, now #${movement.currentRank}, ${formatRankDelta(movement.rankDelta)}`

  return `${movement.currentRank}. ${movement.display_name} ${movement.currentPoints}pts (${rankText}, ${formatPointDelta(movement.pointsDelta)})`
}

function describeMovement(movement: LeaderboardMovement): string {
  const rankText = movement.rankDelta === 0
    ? `held #${movement.currentRank}`
    : `moved ${formatRankDelta(movement.rankDelta)} from #${movement.previousRank} to #${movement.currentRank}`

  return `${movement.display_name} ${rankText} with ${formatPointDelta(movement.pointsDelta)} (${movement.previousPoints}pts -> ${movement.currentPoints}pts)`
}

function selectBiggestRankMover(movements: LeaderboardMovement[]): LeaderboardMovement | null {
  return movements
    .filter(movement => movement.rankDelta !== 0)
    .sort((a, b) =>
      Math.abs(b.rankDelta) - Math.abs(a.rankDelta) ||
      Number(b.rankDelta > 0) - Number(a.rankDelta > 0) ||
      b.pointsDelta - a.pointsDelta ||
      a.currentRank - b.currentRank
    )[0] ?? null
}

function selectBiggestPointGain(movements: LeaderboardMovement[]): LeaderboardMovement | null {
  return movements
    .filter(movement => movement.pointsDelta > 0)
    .sort((a, b) =>
      b.pointsDelta - a.pointsDelta ||
      Math.abs(b.rankDelta) - Math.abs(a.rankDelta) ||
      a.currentRank - b.currentRank
    )[0] ?? null
}

function buildLeaderboardPromptSections(
  currentScores: PlayerScore[],
  previousScores: PlayerScore[]
): { leaderboard: string; movement: string } {
  const movements = buildLeaderboardMovements(currentScores, previousScores)
  const leader = movements[0] ?? null
  const rankMover = selectBiggestRankMover(movements)
  const pointGain = selectBiggestPointGain(movements)
  const featuredMover = rankMover ?? pointGain

  const leaderboard = movements
    .slice(0, 5)
    .map(formatLeaderboardRow)
    .join('\n')

  const movementLines: string[] = []
  if (leader) {
    movementLines.push(`Current leader: ${leader.display_name} at #1 with ${leader.currentPoints}pts.`)
  }

  if (rankMover) {
    movementLines.push(`Biggest mover by rank: ${describeMovement(rankMover)}.`)
  } else if (pointGain) {
    movementLines.push(`No rank movement. Biggest point gain: ${describeMovement(pointGain)}.`)
  } else {
    movementLines.push('No rank movement or point gains from these games.')
  }

  if (leader && featuredMover && leader.player_id === featuredMover.player_id) {
    movementLines.push(`${leader.display_name} is both the current leader and featured mover; mention them once, not in separate repeated sentences.`)
  } else if (leader && featuredMover) {
    movementLines.push(`The current leader and featured mover are different; do not call ${leader.display_name} the biggest mover.`)
  }

  return {
    leaderboard: leaderboard || 'No leaderboard data available.',
    movement: movementLines.join('\n'),
  }
}

function leaderboardFingerprint(scores: PlayerScore[]): Array<Pick<
  PlayerScore,
  'player_id' | 'display_name' | 'match_points' | 'tournament_points' | 'total_points' | 'exact_scores' | 'predictions_submitted'
>> {
  return scores.map(score => ({
    player_id: score.player_id,
    display_name: score.display_name,
    match_points: score.match_points,
    tournament_points: score.tournament_points,
    total_points: score.total_points,
    exact_scores: score.exact_scores,
    predictions_submitted: score.predictions_submitted,
  }))
}

function isFinishedWithScore(match: Match): boolean {
  return match.status === 'finished' && match.home_score !== null && match.away_score !== null
}

function appendPenaltyResult(label: string, match: Match): string {
  return match.went_to_penalties && match.result_winner_team
    ? `${label} (${match.result_winner_team} won on pens)`
    : label
}

function formatActualResult(match: Match): string {
  return appendPenaltyResult(`${match.home_score}-${match.away_score}`, match)
}

function formatMatchResultLine(match: Match): string {
  return appendPenaltyResult(`${match.home_team} ${match.home_score}-${match.away_score} ${match.away_team}`, match)
}

function buildDailyCoverageGroups(matches: Match[]): DailyCoverageGroup[] {
  const grouped = new Map<string, Match[]>()

  for (const match of matches) {
    const { localDate } = getVenueLocalDateInfo(match)
    const rows = grouped.get(localDate) ?? []
    rows.push(match)
    grouped.set(localDate, rows)
  }

  return [...grouped.entries()]
    .map(([localDate, groupMatches]) => ({
      localDate,
      coverageKey: `venue-date:${localDate}`,
      coverageLabel: formatCoverageLabel(localDate),
      matches: [...groupMatches].sort(
        (a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime()
      ),
    }))
    .sort((a, b) => a.localDate.localeCompare(b.localDate))
}

function selectDailyCoverageGroup(matches: Match[], localDate?: string): DailyCoverageGroup | null {
  const eligibleGroups = buildDailyCoverageGroups(matches)
    .filter(group => group.matches.length > 0 && group.matches.every(isFinishedWithScore))

  if (localDate) {
    return eligibleGroups.find(group => group.localDate === localDate) ?? null
  }

  return eligibleGroups.at(-1) ?? null
}

function formatDailyResultLine(match: Match): string {
  const info = getVenueLocalDateInfo(match)
  const location = match.venue && info.city ? `, ${match.venue}, ${info.city}` : ''
  return `${formatMatchResultLine(match)}${location}`
}

function formatMatchPrediction(prediction: MatchPrediction): string {
  const score = `${prediction.home_score}-${prediction.away_score}`
  return prediction.penalty_winner_team
    ? `${score}, pens: ${prediction.penalty_winner_team}`
    : score
}

function normalizeScoreLabel(value: string): string {
  return value
    .replace(/[\u2012-\u2015]/g, '-')
    .replace(/\s+/g, '')
    .trim()
}

function existingRecapMatchesPrompt(
  existing: ExistingMatchRecap | null,
  actualResult: string,
  promptPlayers: PlayerPredictionInput[]
): boolean {
  if (!existing?.roasts || existing.roasts.length === 0) return false

  const normalizedActual = normalizeScoreLabel(actualResult)
  const roastsByPlayer = new Map(existing.roasts.map(roast => [roast.player_name, roast]))

  return promptPlayers.every(player => {
    const roast = roastsByPlayer.get(player.name)

    return (
      !!roast &&
      typeof roast.actual === 'string' &&
      normalizeScoreLabel(roast.actual) === normalizedActual &&
      (roast.prediction ?? null) === (player.prediction ?? null) &&
      roast.points === player.points
    )
  })
}

function buildDailyCoverageFingerprint(
  league: League,
  group: DailyCoverageGroup,
  scores: ReturnType<typeof sortLeaderboard>,
  previousScores: ReturnType<typeof sortLeaderboard>
): string {
  const payload = {
    version: 2,
    coverageKey: group.coverageKey,
    matches: group.matches.map(match => ({
      id: match.id,
      status: match.status,
      home_score: match.home_score,
      away_score: match.away_score,
      result_winner_team: match.result_winner_team,
      went_to_penalties: match.went_to_penalties,
    })),
    scoringMode: league.scoring_mode,
    officialTopScorer: league.official_top_scorer_name ?? '',
    leaderboard: leaderboardFingerprint(scores),
    previousLeaderboard: leaderboardFingerprint(previousScores),
  }

  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

async function findExistingDailySummary(
  supabase: ServiceClient,
  leagueId: string,
  group: DailyCoverageGroup
): Promise<ExistingDailySummary | null> {
  const { data: byCoverage } = await supabase
    .from('daily_summaries')
    .select('id, coverage_fingerprint')
    .eq('league_id', leagueId)
    .eq('coverage_key', group.coverageKey)
    .maybeSingle()

  if (byCoverage) return byCoverage as ExistingDailySummary

  const { data: byDate } = await supabase
    .from('daily_summaries')
    .select('id, coverage_fingerprint')
    .eq('league_id', leagueId)
    .eq('summary_date', group.localDate)
    .maybeSingle()

  return (byDate as ExistingDailySummary | null) ?? null
}

export async function generateLatestDailyPunditSummaryForLeague(
  leagueId: string,
  localDate?: string,
  supabaseArg?: ServiceClient
): Promise<SummaryGenerationResult> {
  if (!process.env.GROQ_API_KEY) {
    return { status: 'skipped', reason: 'GROQ_API_KEY not set' }
  }

  const supabase = supabaseArg ?? createServiceClient()

  const { data: league } = await supabase
    .from('leagues')
    .select('*')
    .eq('id', leagueId)
    .maybeSingle()

  if (!league) return { status: 'error', reason: 'League not found' }
  if ((league as League).archived_at) return { status: 'skipped', reason: 'league archived' }

  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .eq('tournament_code', league.tournament_code)
    .eq('tournament_season', league.tournament_season)
    .order('kickoff_time', { ascending: true })

  const allMatches = (matches ?? []) as Match[]
  const group = selectDailyCoverageGroup(allMatches, localDate)
  if (!group) {
    return {
      status: 'skipped',
      reason: localDate ? 'no complete venue-date coverage for date' : 'no complete venue-date coverage',
    }
  }

  const { data: players } = await supabase
    .from('players')
    .select('*')
    .eq('league_id', leagueId)

  const typedPlayers = (players ?? []) as Player[]
  const playerIds = typedPlayers.map((p: Player) => p.id)
  const { data: predictions } = playerIds.length > 0
    ? await supabase.from('match_predictions').select('*').in('player_id', playerIds)
    : { data: [] }

  const { data: tournamentPreds } = await supabase
    .from('tournament_predictions')
    .select('*')
    .eq('league_id', leagueId)

  const typedLeague = league as League
  const typedPredictions = (predictions ?? []) as MatchPrediction[]
  const typedTournamentPreds = (tournamentPreds ?? []) as TournamentPrediction[]
  const scores = sortLeaderboard(computeLeaderboard({
    players: typedPlayers,
    predictions: typedPredictions,
    matches: allMatches,
    tournamentPredictions: typedTournamentPreds,
    scoringMode: typedLeague.scoring_mode,
    officialTopScorer: typedLeague.official_top_scorer_name,
  }))

  const previousScores = computeLeaderboardBeforeCoverage({
    players: typedPlayers,
    predictions: typedPredictions,
    matches: allMatches,
    coveredMatches: group.matches,
    tournamentPredictions: typedTournamentPreds,
    league: typedLeague,
  })

  const fingerprint = buildDailyCoverageFingerprint(typedLeague, group, scores, previousScores)
  const existing = await findExistingDailySummary(supabase, leagueId, group)
  if (existing?.coverage_fingerprint === fingerprint) {
    return { status: 'skipped', reason: 'already current' }
  }

  const results = group.matches.map(formatDailyResultLine).join('\n')
  const leaderboardContext = buildLeaderboardPromptSections(scores, previousScores)

  const summary = await groqComplete(
    dailyPunditPrompt(group.coverageLabel, results, leaderboardContext.leaderboard, leaderboardContext.movement),
    250
  )
  if (!summary) return { status: 'error', reason: 'Groq returned null' }

  const payload = {
    league_id: leagueId,
    summary_date: group.localDate,
    coverage_key: group.coverageKey,
    coverage_label: group.coverageLabel,
    covered_match_ids: group.matches.map(match => match.id),
    coverage_fingerprint: fingerprint,
    match_count: group.matches.length,
    summary_text: summary,
    generated_at: new Date().toISOString(),
  }

  if (existing) {
    const { error: updateError } = await supabase
      .from('daily_summaries')
      .update(payload)
      .eq('id', existing.id)

    if (updateError) return { status: 'error', reason: updateError.message }
    return { status: 'updated' }
  }

  const { error: insertError } = await supabase
    .from('daily_summaries')
    .insert(payload)

  if (insertError) {
    if (insertError.code === '23505') return { status: 'skipped', reason: 'already exists' }
    return { status: 'error', reason: insertError.message }
  }

  return { status: 'created' }
}

export async function generateDailyPunditSummaryForLeagueDate(
  leagueId: string,
  summaryDate: string,
  supabaseArg?: ServiceClient
): Promise<SummaryGenerationResult> {
  return generateLatestDailyPunditSummaryForLeague(leagueId, summaryDate, supabaseArg)
}

export async function autoGenerateDailyPunditSummariesForTournament(
  tournamentCode: string,
  tournamentSeason: number,
  summaryDate?: string,
  supabaseArg?: ServiceClient
): Promise<BatchGenerationResult> {
  const supabase = supabaseArg ?? createServiceClient()

  const { data: leagues } = await supabase
    .from('leagues')
    .select('id')
    .eq('tournament_code', tournamentCode)
    .eq('tournament_season', tournamentSeason)
    .is('archived_at', null)

  if (!leagues?.length) return { created: 0, updated: 0, skipped: 0, errors: 0 }

  let created = 0
  let updated = 0
  let skipped = 0
  let errors = 0

  for (const league of leagues as Array<{ id: string }>) {
    const res = await generateLatestDailyPunditSummaryForLeague(league.id, summaryDate, supabase)
    if (res.status === 'created') created++
    else if (res.status === 'updated') updated++
    else if (res.status === 'skipped') skipped++
    else errors++
  }

  return { created, updated, skipped, errors }
}

// ─────────────────────────────────────────────────────────────
// Per-match recap with per-player roasts
// ─────────────────────────────────────────────────────────────

export async function generateMatchRecap(
  leagueId: string,
  matchId: string,
  supabaseArg?: ServiceClient
): Promise<SummaryGenerationResult> {
  const supabase = supabaseArg ?? createServiceClient()
  const hasGroq = !!process.env.GROQ_API_KEY

  const { data: league } = await supabase
    .from('leagues')
    .select('scoring_mode')
    .eq('id', leagueId)
    .single()

  if (!league) return { status: 'error', reason: 'League not found' }

  // Match must be finished with scores
  const { data: match } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single()

  if (!match || match.status !== 'finished' || match.home_score === null || match.away_score === null) {
    return { status: 'skipped', reason: 'match not finished' }
  }

  const actualResult = formatActualResult(match as Match)
  const { data: existing } = await supabase
    .from('match_recaps')
    .select('id, roasts')
    .eq('league_id', leagueId)
    .eq('match_id', matchId)
    .maybeSingle()

  const existingRecap = (existing as ExistingMatchRecap | null) ?? null

  // All players in this league
  const { data: players } = await supabase
    .from('players')
    .select('*')
    .eq('league_id', leagueId)

  if (!players?.length) return { status: 'skipped', reason: 'no players in league' }

  const playerIds = (players as Player[]).map(p => p.id)

  // Predictions for this specific match from league players
  const { data: predictions } = await supabase
    .from('match_predictions')
    .select('*')
    .eq('match_id', matchId)
    .in('player_id', playerIds)

  const predMap = new Map<string, MatchPrediction>(
    ((predictions ?? []) as MatchPrediction[]).map(p => [p.player_id, p])
  )

  // Build per-player prompt input and roast skeleton
  const promptPlayers: PlayerPredictionInput[] = (players as Player[]).map(p => {
    const pred = predMap.get(p.id)
    const pts = pred
      ? predictionPoints({
          predHome: pred.home_score,
          predAway: pred.away_score,
          realHome: match.home_score,
          realAway: match.away_score,
          stage: match.stage,
          mode: league.scoring_mode,
          homeTeam: match.home_team,
          awayTeam: match.away_team,
          predictedPenaltyWinner: pred.penalty_winner_team,
          resultWinnerTeam: match.result_winner_team,
          wentToPenalties: match.went_to_penalties,
        }).total_points
      : 0
    return {
      name: p.display_name,
      prediction: pred ? formatMatchPrediction(pred) : null,
      points: pts,
    }
  })

  if (existingRecapMatchesPrompt(existingRecap, actualResult, promptPlayers)) {
    return { status: 'skipped', reason: 'already current' }
  }

  if (!hasGroq) {
    if (existingRecap) {
      const { error: deleteError } = await supabase
        .from('match_recaps')
        .delete()
        .eq('id', existingRecap.id)

      if (deleteError) return { status: 'error', reason: deleteError.message }
      return { status: 'updated', reason: 'stale recap removed; GROQ_API_KEY not set' }
    }

    return { status: 'skipped', reason: 'GROQ_API_KEY not set' }
  }

  // Ask Groq for structured JSON response
  interface RecapResponse {
    headline: string
    roasts: Array<{ player_name: string; roast: string }>
  }

  const parsed = await groqCompleteJSON<RecapResponse>(
    matchRecapPrompt(match.home_team, match.away_team, actualResult, promptPlayers),
    600
  )

  if (!parsed?.headline || !Array.isArray(parsed.roasts)) {
    return { status: 'error', reason: 'Groq returned invalid JSON' }
  }

  // Merge AI roast text with our own computed stats
  const roasts: PlayerRoast[] = promptPlayers.map(pp => {
    const aiRoast = parsed.roasts.find(r => r.player_name === pp.name)
    return {
      player_name: pp.name,
      prediction: pp.prediction,
      actual: actualResult,
      points: pp.points,
      roast: aiRoast?.roast ?? '…',
    }
  })

  if (existingRecap) {
    const { error: updateError } = await supabase
      .from('match_recaps')
      .update({
        headline: parsed.headline,
        roasts,
        generated_at: new Date().toISOString(),
      })
      .eq('id', existingRecap.id)

    if (updateError) return { status: 'error', reason: updateError.message }
    return { status: 'updated' }
  }

  const { error: insertError } = await supabase
    .from('match_recaps')
    .insert({
      league_id: leagueId,
      match_id: matchId,
      headline: parsed.headline,
      roasts,
    })

  if (insertError) {
    if (insertError.code === '23505') return { status: 'skipped', reason: 'already exists' }
    return { status: 'error', reason: insertError.message }
  }

  return { status: 'created' }
}

/** After a match finishes, generate recaps for every league following that tournament. */
export async function autoGenerateMatchRecapsForMatch(
  matchId: string,
  tournamentCode: string,
  tournamentSeason: number,
  supabaseArg?: ServiceClient
): Promise<{ created: number; updated: number; skipped: number; errors: number }> {
  const supabase = supabaseArg ?? createServiceClient()

  const { data: leagues } = await supabase
    .from('leagues')
    .select('id')
    .eq('tournament_code', tournamentCode)
    .eq('tournament_season', tournamentSeason)
    .is('archived_at', null)

  if (!leagues?.length) return { created: 0, updated: 0, skipped: 0, errors: 0 }

  let created = 0, updated = 0, skipped = 0, errors = 0
  for (const league of leagues as Array<{ id: string }>) {
    const res = await generateMatchRecap(league.id, matchId, supabase)
    if (res.status === 'created') created++
    else if (res.status === 'updated') updated++
    else if (res.status === 'skipped') skipped++
    else errors++
  }
  return { created, updated, skipped, errors }
}

/** After a bulk sync, generate recaps for all finished matches that still lack one. */
export async function autoGenerateMatchRecapsForTournament(
  tournamentCode: string,
  tournamentSeason: number,
  supabaseArg?: ServiceClient
): Promise<{ created: number; updated: number; skipped: number; errors: number }> {
  const supabase = supabaseArg ?? createServiceClient()

  const { data: leagues } = await supabase
    .from('leagues')
    .select('id')
    .eq('tournament_code', tournamentCode)
    .eq('tournament_season', tournamentSeason)

  if (!leagues?.length) return { created: 0, updated: 0, skipped: 0, errors: 0 }

  const { data: finishedMatches } = await supabase
    .from('matches')
    .select('id')
    .eq('tournament_code', tournamentCode)
    .eq('tournament_season', tournamentSeason)
    .eq('status', 'finished')

  if (!finishedMatches?.length) return { created: 0, updated: 0, skipped: 0, errors: 0 }

  let created = 0, updated = 0, skipped = 0, errors = 0
  for (const league of leagues as Array<{ id: string }>) {
    for (const match of finishedMatches as Array<{ id: string }>) {
      const res = await generateMatchRecap(league.id, match.id, supabase)
      if (res.status === 'created') created++
      else if (res.status === 'updated') updated++
      else if (res.status === 'skipped') skipped++
      else errors++
    }
  }
  return { created, updated, skipped, errors }
}
