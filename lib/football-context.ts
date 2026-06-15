import { createServiceClient } from '@/lib/supabase/server'
import type { Match } from '@/types'

interface TeamForm {
  recentResults: string[]
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  matchesPlayed: number
}

export interface MatchContext {
  homeForm: TeamForm | null
  awayForm: TeamForm | null
  headToHead: string[]
  hasData: boolean
}

/**
 * Queries finished matches from the local Supabase DB to build
 * real form and head-to-head context for two teams.
 * No extra API calls — uses data already synced by /api/sync.
 */
export async function getMatchContext(
  homeTeam: string,
  awayTeam: string,
  tournamentCode: string,
  tournamentSeason: number
): Promise<MatchContext> {
  const supabase = createServiceClient()

  const { data } = await supabase
    .from('matches')
    .select('id,home_team,away_team,home_score,away_score,stage,kickoff_time')
    .eq('tournament_code', tournamentCode)
    .eq('tournament_season', tournamentSeason)
    .eq('status', 'finished')
    .order('kickoff_time', { ascending: false })

  const matches = (data ?? []) as Pick<
    Match,
    'id' | 'home_team' | 'away_team' | 'home_score' | 'away_score' | 'stage' | 'kickoff_time'
  >[]

  if (!matches.length) {
    return { homeForm: null, awayForm: null, headToHead: [], hasData: false }
  }

  function buildForm(teamName: string): TeamForm | null {
    const teamMatches = matches
      .filter(m => m.home_team === teamName || m.away_team === teamName)
      .slice(0, 5)

    if (!teamMatches.length) return null

    let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0
    const recentResults: string[] = []

    for (const m of teamMatches) {
      const isHome = m.home_team === teamName
      const scored    = isHome ? m.home_score! : m.away_score!
      const conceded  = isHome ? m.away_score! : m.home_score!
      const opponent  = isHome ? m.away_team  : m.home_team

      goalsFor     += scored
      goalsAgainst += conceded

      if (scored > conceded) {
        wins++
        recentResults.push(`W ${scored}-${conceded} vs ${opponent}`)
      } else if (scored === conceded) {
        draws++
        recentResults.push(`D ${scored}-${conceded} vs ${opponent}`)
      } else {
        losses++
        recentResults.push(`L ${scored}-${conceded} vs ${opponent}`)
      }
    }

    return {
      recentResults,
      wins, draws, losses,
      goalsFor, goalsAgainst,
      matchesPlayed: teamMatches.length,
    }
  }

  // Head-to-head between these two teams in this tournament
  const h2h = matches
    .filter(m =>
      (m.home_team === homeTeam && m.away_team === awayTeam) ||
      (m.home_team === awayTeam && m.away_team === homeTeam)
    )
    .slice(0, 3)
    .map(m => `${m.home_team} ${m.home_score}–${m.away_score} ${m.away_team}`)

  const homeForm = buildForm(homeTeam)
  const awayForm = buildForm(awayTeam)

  return {
    homeForm,
    awayForm,
    headToHead: h2h,
    hasData: !!(homeForm || awayForm),
  }
}

/**
 * Formats context into a concise string block to inject into the AI prompt.
 */
export function formatContext(
  homeTeam: string,
  awayTeam: string,
  ctx: MatchContext
): string {
  if (!ctx.hasData) return ''

  const lines: string[] = []

  if (ctx.homeForm) {
    const f = ctx.homeForm
    lines.push(
      `${homeTeam} in this tournament (${f.matchesPlayed} matches): ` +
      `${f.wins}W ${f.draws}D ${f.losses}L, ` +
      `${f.goalsFor} goals scored, ${f.goalsAgainst} conceded. ` +
      `Recent: ${f.recentResults.join(' → ')}.`
    )
  }

  if (ctx.awayForm) {
    const f = ctx.awayForm
    lines.push(
      `${awayTeam} in this tournament (${f.matchesPlayed} matches): ` +
      `${f.wins}W ${f.draws}D ${f.losses}L, ` +
      `${f.goalsFor} goals scored, ${f.goalsAgainst} conceded. ` +
      `Recent: ${f.recentResults.join(' → ')}.`
    )
  }

  if (ctx.headToHead.length > 0) {
    lines.push(`Head-to-head this tournament: ${ctx.headToHead.join(', ')}.`)
  }

  return lines.join('\n')
}

/**
 * Determines AI difficulty from real form data rather than asking the model to guess.
 * Returns Easy / Tricky / Unpredictable based on win-rate gap between the two teams.
 */
export function deriveDifficulty(ctx: MatchContext): 'Easy' | 'Tricky' | 'Unpredictable' {
  const { homeForm, awayForm } = ctx

  // No data — can't determine
  if (!homeForm && !awayForm) return 'Unpredictable'

  // One team has no data (probably just joined the tournament)
  if (!homeForm || !awayForm) return 'Tricky'

  const homeRate = homeForm.matchesPlayed > 0
    ? (homeForm.wins + homeForm.draws * 0.5) / homeForm.matchesPlayed
    : 0.5
  const awayRate = awayForm.matchesPlayed > 0
    ? (awayForm.wins + awayForm.draws * 0.5) / awayForm.matchesPlayed
    : 0.5

  const gap = Math.abs(homeRate - awayRate)

  // Both teams inconsistent (lots of draws/losses)
  const bothInconsistent =
    homeForm.wins < homeForm.losses &&
    awayForm.wins < awayForm.losses

  if (bothInconsistent) return 'Unpredictable'
  if (gap >= 0.4) return 'Easy'     // clear favourite
  if (gap >= 0.15) return 'Tricky'  // competitive
  return 'Unpredictable'             // very even
}
