import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { groqComplete, insightPrompt, punditsPrompt } from '@/lib/groq'
import { getMatchContext, formatContext, deriveDifficulty } from '@/lib/football-context'
import type { Match, Player, MatchPrediction, TournamentPrediction } from '@/types'

function isAuthorized(req: NextRequest): boolean {
  const syncSecret = process.env.SYNC_SECRET
  const cronSecret = process.env.CRON_SECRET
  const auth    = req.headers.get('authorization') ?? ''
  const xSecret = req.headers.get('x-sync-secret') ?? ''
  if (!syncSecret && !cronSecret) return true
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true
  if (syncSecret && xSecret === syncSecret) return true
  return false
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const action: string = body.action ?? 'seed_matches'
  const supabase = createServiceClient()

  // ── Seed AI content for matches ───────────────────────────────────────
  if (action === 'seed_matches') {
    const force: boolean = body.force ?? false

    let query = supabase
      .from('matches')
      .select('id, home_team, away_team, tournament_code, tournament_season, stage')
      .eq('status', 'open')
      .limit(50)

    // Without force: only unseed matches
    if (!force) {
      query = query.is('ai_insight', null) as typeof query
    }

    const { data: matches } = await query

    if (!matches?.length) return NextResponse.json({ seeded: 0 })

    const hasGroq = !!process.env.GROQ_API_KEY
    let seeded = 0

    for (const match of matches as Pick<Match, 'id' | 'home_team' | 'away_team' | 'tournament_code' | 'tournament_season' | 'stage'>[]) {
      const tournament = `${match.tournament_code} ${match.tournament_season}`

      // 1. Fetch real form data from our own DB (no extra API calls)
      const ctx = await getMatchContext(
        match.home_team,
        match.away_team,
        match.tournament_code,
        match.tournament_season
      )

      // 2. Derive difficulty from real data — no AI call needed
      const difficulty = deriveDifficulty(ctx)

      // 3. Build context string for the prompt
      const liveContext = formatContext(match.home_team, match.away_team, ctx)

      // 4. Generate insight with Groq (skipped gracefully if no key)
      let insight: string | null = null
      if (hasGroq) {
        insight = await groqComplete(
          insightPrompt(match.home_team, match.away_team, tournament, match.stage, liveContext || undefined),
          120
        )
        // Rate limit: 30 req/min → pause 2.1s between calls
        await new Promise(r => setTimeout(r, 2100))
      }

      await supabase.from('matches').update({
        ai_difficulty: difficulty,
        ...(insight !== null && { ai_insight: insight }),
        ai_insight_generated_at: new Date().toISOString(),
      }).eq('id', match.id)

      seeded++
    }

    return NextResponse.json({ seeded, groqEnabled: hasGroq })
  }

  // ── Pundit summary for completed matchday ─────────────────────────────
  if (action === 'pundit_summary') {
    if (!process.env.GROQ_API_KEY)
      return NextResponse.json({ skipped: true, reason: 'GROQ_API_KEY not set' })

    const { league_id, match_day } = body
    if (!league_id || !match_day)
      return NextResponse.json({ error: 'league_id and match_day required' }, { status: 400 })

    // Skip if already generated
    const { data: existing } = await supabase
      .from('matchday_summaries')
      .select('id')
      .eq('league_id', league_id)
      .eq('match_day', match_day)
      .single()
    if (existing) return NextResponse.json({ skipped: true, reason: 'already exists' })

    const { data: league } = await supabase.from('leagues').select('*').eq('id', league_id).single()
    if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 })

    const { data: matches } = await supabase
      .from('matches')
      .select('*')
      .eq('tournament_code', league.tournament_code)
      .eq('tournament_season', league.tournament_season)
      .eq('match_day', match_day)
      .eq('status', 'finished')

    if (!matches?.length)
      return NextResponse.json({ skipped: true, reason: 'no finished matches' })

    const { data: players } = await supabase.from('players').select('*').eq('league_id', league_id)
    const playerIds = (players ?? []).map((p: Player) => p.id)

    const { data: predictions } = playerIds.length > 0
      ? await supabase.from('match_predictions').select('*').in('player_id', playerIds)
      : { data: [] }

    const { data: tournamentPreds } = await supabase
      .from('tournament_predictions').select('*').eq('league_id', league_id)

    // Build prompt data
    const results = (matches as Match[])
      .map(m => `${m.home_team} ${m.home_score}–${m.away_score} ${m.away_team}`)
      .join(', ')

    const { computeLeaderboard, sortLeaderboard } = await import('@/lib/scoring')
    const scores = sortLeaderboard(computeLeaderboard({
      players:               (players ?? []) as Player[],
      predictions:           (predictions ?? []) as MatchPrediction[],
      matches:               matches as Match[],
      tournamentPredictions: (tournamentPreds ?? []) as TournamentPrediction[],
      scoringMode:           league.scoring_mode,
    }))

    const leaderboardStr = scores
      .slice(0, 5)
      .map((s, i) => `${i + 1}. ${s.display_name} ${s.total_points}pts`)
      .join(', ')

    const summary = await groqComplete(punditsPrompt(match_day, results, leaderboardStr), 250)
    if (!summary) return NextResponse.json({ error: 'Groq returned null' }, { status: 503 })

    const { data: inserted } = await supabase
      .from('matchday_summaries')
      .insert({ league_id, match_day, summary_text: summary })
      .select()
      .single()

    return NextResponse.json({ summary: inserted })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
