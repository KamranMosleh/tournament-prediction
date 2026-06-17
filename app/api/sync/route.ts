import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import {
  autoGeneratePunditSummariesForTournament,
  autoGenerateMatchRecapsForTournament,
  enrichOpenMatchesForTournament,
} from '@/lib/ai-jobs'
import type { MatchStage, MatchStatus } from '@/types'

const FD_BASE = 'https://api.football-data.org/v4'

function mapStage(stage: string, group: string | null): { stage: MatchStage; group_name: string | null } {
  const s = stage.toUpperCase()
  if (s.includes('GROUP')) return { stage: 'group', group_name: group?.replace('GROUP_', '') ?? null }
  if (s.includes('ROUND_OF_16') || s.includes('LAST_16')) return { stage: 'round_of_16', group_name: null }
  if (s.includes('QUARTER')) return { stage: 'quarter_final', group_name: null }
  if (s.includes('SEMI')) return { stage: 'semi_final', group_name: null }
  if (s.includes('THIRD')) return { stage: 'third_place', group_name: null }
  if (s.includes('FINAL')) return { stage: 'final', group_name: null }
  return { stage: 'group', group_name: group ?? null }
}

function mapStatus(status: string): MatchStatus {
  const s = status.toUpperCase()
  if (['FINISHED', 'AWARDED'].includes(s)) return 'finished'
  if (['IN_PLAY', 'PAUSED', 'HALFTIME', 'EXTRA_TIME', 'PENALTY'].includes(s)) return 'locked'
  return 'open'
}

async function isAuthorized(req: NextRequest, supabase: ReturnType<typeof createServiceClient>, leagueId?: string): Promise<boolean> {
  // Legacy Vercel Cron support: Authorization: Bearer <CRON_SECRET>
  const cronSecret = process.env.CRON_SECRET
  const syncSecret = process.env.SYNC_SECRET
  const auth = req.headers.get('authorization') ?? ''
  const xSecret = req.headers.get('x-sync-secret') ?? ''
  const sessionToken = req.headers.get('x-session-token') ?? ''

  // Allow if no secrets configured (dev mode)
  if (!cronSecret && !syncSecret) return true
  // Legacy Vercel Cron
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true
  // Manual call with x-sync-secret header
  if (syncSecret && xSecret === syncSecret) return true

  const user = await getCurrentUser()
  if (user) {
    let query = supabase
      .from('players')
      .select('is_admin, league_id')
      .eq('user_id', user.id)
      .eq('is_admin', true)

    if (leagueId) query = query.eq('league_id', leagueId)

    const { data: player } = await query.maybeSingle()
    if (player?.is_admin) return true
  }

  // Admin users can manually trigger fixture import from the app UI
  if (sessionToken) {
    const { data: player } = await supabase
      .from('players')
      .select('is_admin, league_id')
      .eq('session_token', sessionToken)
      .single()

    if (player?.is_admin && (!leagueId || player.league_id === leagueId)) return true
  }

  return false
}

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  const body = await req.json().catch(() => ({}))
  const leagueId: string | undefined = body.league_id

  if (!(await isAuthorized(req, supabase, leagueId)))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tournamentCode: string = body.tournament_code ?? 'WC'
  const season: number = body.season ?? new Date().getFullYear()

  const key = process.env.FOOTBALL_DATA_API_KEY
  if (!key)
    return NextResponse.json({ error: 'FOOTBALL_DATA_API_KEY not configured' }, { status: 500 })

  const start = Date.now()
  let matchesUpdated = 0, matchesLocked = 0, matchesFinished = 0

  try {
    const res = await fetch(`${FD_BASE}/competitions/${tournamentCode}/matches?season=${season}`, {
      headers: { 'X-Auth-Token': key },
    })
    if (!res.ok) throw new Error(`football-data.org ${res.status}`)
    const data = await res.json()

    for (const m of data.matches ?? []) {
      const { stage, group_name } = mapStage(m.stage ?? '', m.group ?? null)
      const status = mapStatus(m.status ?? '')
      const isFinished = status === 'finished'

      const { error } = await supabase.from('matches').upsert({
        tournament_code: tournamentCode,
        tournament_season: season,
        external_match_id: m.id,
        stage,
        group_name,
        home_team: m.homeTeam?.shortName ?? m.homeTeam?.name ?? 'TBD',
        away_team: m.awayTeam?.shortName ?? m.awayTeam?.name ?? 'TBD',
        kickoff_time: m.utcDate,
        status,
        home_score: isFinished ? (m.score?.fullTime?.home ?? null) : null,
        away_score: isFinished ? (m.score?.fullTime?.away ?? null) : null,
        match_day: m.matchday ?? null,
        venue: m.venue ?? null,
        last_synced_at: new Date().toISOString(),
      }, { onConflict: 'external_match_id' })

      if (!error) {
        matchesUpdated++
        if (status === 'locked') matchesLocked++
        if (status === 'finished') matchesFinished++
      }
    }

    await supabase.from('sync_log').insert({
      tournament_code: tournamentCode,
      tournament_season: season,
      matches_updated: matchesUpdated,
      matches_locked: matchesLocked,
      matches_finished: matchesFinished,
      duration_ms: Date.now() - start,
    })

    // Auto-generate cached AI content after authoritative match writes.
    const [aiSummaries, aiRecaps, aiEnrichment] = await Promise.all([
      autoGeneratePunditSummariesForTournament(tournamentCode, season, supabase),
      autoGenerateMatchRecapsForTournament(tournamentCode, season, supabase),
      enrichOpenMatchesForTournament(tournamentCode, season, {}, supabase),
    ])

    return NextResponse.json({ ok: true, matchesUpdated, matchesLocked, matchesFinished, aiSummaries, aiRecaps, aiEnrichment })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    try {
      await supabase.from('sync_log').insert({
        tournament_code: tournamentCode,
        tournament_season: season,
        error: msg,
        duration_ms: Date.now() - start,
      })
    } catch { /* ignore log failure */ }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET() {
  const supabase = createServiceClient()
  const { data } = await supabase.from('sync_log').select('*').order('synced_at', { ascending: false }).limit(10)
  return NextResponse.json({ recent: data ?? [] })
}
