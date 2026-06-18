import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  enrichOpenMatchesForTournament,
  generatePunditSummaryForMatchDay,
  mergeOpenMatchEnrichmentResults,
  type OpenMatchEnrichmentResult,
} from '@/lib/ai-jobs'

function isAuthorized(req: NextRequest): boolean {
  const syncSecret = process.env.SYNC_SECRET
  const xSecret = req.headers.get('x-sync-secret') ?? ''
  if (!syncSecret && process.env.NODE_ENV !== 'production') return true
  if (syncSecret && xSecret === syncSecret) return true
  return false
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const action: string = body.action ?? 'seed_matches'
  const supabase = createServiceClient()

  if (action === 'seed_matches') {
    const force: boolean = body.force ?? false
    const tournamentCode: string | undefined = body.tournament_code
    const tournamentSeason = Number(body.tournament_season ?? body.season ?? new Date().getFullYear())
    let aiEnrichment: OpenMatchEnrichmentResult

    if (tournamentCode) {
      const { data: activeLeague } = await supabase
        .from('leagues')
        .select('id')
        .eq('tournament_code', tournamentCode)
        .eq('tournament_season', tournamentSeason)
        .is('archived_at', null)
        .limit(1)
        .maybeSingle()

      if (!activeLeague) {
        return NextResponse.json({ skipped: true, reason: 'No active leagues for this tournament' })
      }

      aiEnrichment = await enrichOpenMatchesForTournament(
        tournamentCode,
        tournamentSeason,
        { force },
        supabase
      )
    } else {
      const { data: pairs, error } = await supabase
        .from('leagues')
        .select('tournament_code, tournament_season')
        .is('archived_at', null)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      const uniquePairs = new Map<string, { tournament_code: string; tournament_season: number }>()
      for (const pair of pairs ?? []) {
        uniquePairs.set(`${pair.tournament_code}:${pair.tournament_season}`, pair)
      }

      const results: OpenMatchEnrichmentResult[] = []
      for (const pair of uniquePairs.values()) {
        results.push(await enrichOpenMatchesForTournament(
          pair.tournament_code,
          pair.tournament_season,
          { force },
          supabase
        ))
      }

      aiEnrichment = uniquePairs.size > 0
        ? mergeOpenMatchEnrichmentResults(results)
        : {
          processed: 0,
          difficultyUpdated: 0,
          insightsCreated: 0,
          insightsSkipped: 0,
          errors: 0,
          groqEnabled: !!process.env.GROQ_API_KEY,
        }
    }

    return NextResponse.json({
      seeded: aiEnrichment.processed,
      ...aiEnrichment,
    })
  }

  if (action === 'pundit_summary') {
    const { league_id, match_day } = body
    if (!league_id || !match_day) {
      return NextResponse.json({ error: 'league_id and match_day required' }, { status: 400 })
    }

    const { data: league } = await supabase
      .from('leagues')
      .select('archived_at')
      .eq('id', league_id)
      .maybeSingle()

    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 })
    }
    if (league.archived_at) {
      return NextResponse.json({ error: 'This league is archived and read-only' }, { status: 409 })
    }

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
