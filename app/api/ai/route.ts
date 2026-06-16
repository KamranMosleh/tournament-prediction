import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { groqComplete, insightPrompt } from '@/lib/groq'
import { getMatchContext, formatContext, deriveDifficulty } from '@/lib/football-context'
import { generatePunditSummaryForMatchDay } from '@/lib/ai-jobs'
import type { Match } from '@/types'

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
    const { league_id, match_day } = body
    if (!league_id || !match_day)
      return NextResponse.json({ error: 'league_id and match_day required' }, { status: 400 })

    const res = await generatePunditSummaryForMatchDay(league_id, Number(match_day), supabase)
    if (res.status === 'created') {
      return NextResponse.json({ ok: true, created: true })
    }
    if (res.status === 'skipped') {
      return NextResponse.json({ skipped: true, reason: res.reason ?? 'skipped' })
    }
    return NextResponse.json({ error: res.reason ?? 'Failed to generate summary' }, { status: 503 })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
