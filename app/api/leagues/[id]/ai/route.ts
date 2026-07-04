import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { generateLatestDailyPunditSummaryForLeague, generateMatchRecap } from '@/lib/ai-jobs'
import { createServiceClient } from '@/lib/supabase/server'

type RouteContext = {
  params: Promise<{ id: string }>
}

type AiAction = 'daily-summary' | 'match-roasts'

async function getOwnedLeague(id: string) {
  const user = await getCurrentUser()
  if (!user) {
    return { response: NextResponse.json({ error: 'Sign in required' }, { status: 401 }) }
  }

  const supabase = createServiceClient()
  const { data: league } = await supabase
    .from('leagues')
    .select('id, tournament_code, tournament_season, created_by_user_id, archived_at')
    .eq('id', id)
    .maybeSingle()

  if (!league) {
    return { response: NextResponse.json({ error: 'League not found' }, { status: 404 }) }
  }

  if (!league.created_by_user_id || league.created_by_user_id !== user.id) {
    return { response: NextResponse.json({ error: 'Only the league owner can do this' }, { status: 403 }) }
  }

  if (league.archived_at) {
    return { response: NextResponse.json({ error: 'This league is archived and read-only' }, { status: 409 }) }
  }

  return { supabase, league }
}

function isAiAction(value: unknown): value is AiAction {
  return value === 'daily-summary' || value === 'match-roasts'
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const owned = await getOwnedLeague(id)
    if ('response' in owned) return owned.response

    const body = await req.json().catch(() => ({}))
    if (!isAiAction(body.action)) {
      return NextResponse.json({ error: 'Action must be daily-summary or match-roasts' }, { status: 400 })
    }

    if (body.action === 'daily-summary') {
      const result = await generateLatestDailyPunditSummaryForLeague(id, undefined, owned.supabase, { force: true })
      return NextResponse.json({ action: body.action, result })
    }

    const { data: matches, error } = await owned.supabase
      .from('matches')
      .select('id')
      .eq('tournament_code', owned.league.tournament_code)
      .eq('tournament_season', owned.league.tournament_season)
      .eq('status', 'finished')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .order('kickoff_time', { ascending: false })
      .limit(3)

    if (error) {
      return NextResponse.json({ error: 'Failed to load latest finished matches' }, { status: 500 })
    }

    const result = { created: 0, updated: 0, skipped: 0, errors: 0 }
    for (const match of matches ?? []) {
      const res = await generateMatchRecap(id, match.id, owned.supabase, { force: true })
      if (res.status === 'created') result.created++
      else if (res.status === 'updated') result.updated++
      else if (res.status === 'skipped') result.skipped++
      else result.errors++
    }

    return NextResponse.json({ action: body.action, result })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
