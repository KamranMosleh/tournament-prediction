import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getVerifiedPlayer } from '@/lib/auth'
import { getPickDeadlines, isDeadlinePassed } from '@/lib/tournament-picks'
import type { Match } from '@/types'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await req.json().catch(() => ({}))
    const topScorerName = typeof body.official_top_scorer_name === 'string'
      ? body.official_top_scorer_name.trim()
      : ''

    if (!topScorerName) {
      return NextResponse.json({ error: 'Top scorer name is required' }, { status: 400 })
    }
    if (topScorerName.length > 100) {
      return NextResponse.json({ error: 'Top scorer name is too long' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const verified = await getVerifiedPlayer(supabase, { leagueId: id, requireAdmin: true })
    if (!verified) {
      return NextResponse.json({ error: 'Forbidden - admins only' }, { status: 403 })
    }

    const { data: league } = await supabase
      .from('leagues')
      .select('id, tournament_code, tournament_season, archived_at')
      .eq('id', id)
      .maybeSingle()

    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 })
    }
    if (league.archived_at) {
      return NextResponse.json({ error: 'This league is archived and read-only' }, { status: 409 })
    }

    const { data: matches } = await supabase
      .from('matches')
      .select('*')
      .eq('tournament_code', league.tournament_code)
      .eq('tournament_season', league.tournament_season)

    const deadlines = getPickDeadlines((matches ?? []) as Match[])
    if (!deadlines.semiFinalKickoff) {
      return NextResponse.json({ error: 'Semi-final deadline is not available yet' }, { status: 409 })
    }
    if (!isDeadlinePassed(deadlines.semiFinalKickoff)) {
      return NextResponse.json(
        { error: 'The official top scorer can be entered after the semi-finals begin' },
        { status: 409 }
      )
    }

    const { data: updatedLeague, error } = await supabase
      .from('leagues')
      .update({ official_top_scorer_name: topScorerName })
      .eq('id', id)
      .select()
      .single()

    if (error || !updatedLeague) {
      return NextResponse.json({ error: 'Failed to save official top scorer' }, { status: 500 })
    }

    return NextResponse.json({ league: updatedLeague })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
