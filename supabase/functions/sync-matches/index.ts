// Supabase Edge Function - sync-matches
// Deploy: supabase functions deploy sync-matches
// Schedule daily, plus every 10 minutes during active match windows.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SYNC_SECRET = Deno.env.get('SYNC_SECRET') ?? ''
const APP_URL = (Deno.env.get('APP_URL') ?? '').replace(/\/$/, '')
const MATCH_WINDOW_BEFORE_MS = 30 * 60 * 1000
const MATCH_WINDOW_AFTER_MS = 4 * 60 * 60 * 1000

type SyncMode = 'daily' | 'match-window'
type TournamentPair = {
  tournament_code: string
  tournament_season: number
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (!SYNC_SECRET) {
    return jsonResponse({ error: 'SYNC_SECRET is not configured' }, 500)
  }

  if (!APP_URL) {
    return jsonResponse({ error: 'APP_URL is not configured' }, 500)
  }

  const syncSecret = req.headers.get('x-sync-secret') ?? ''
  if (syncSecret !== SYNC_SECRET) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const body = await req.json().catch(() => ({}))
  const mode: SyncMode = body.mode === 'match-window' ? 'match-window' : 'daily'
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // Find all unique (tournament_code, season) pairs that use api sync.
  const { data: leagues } = await supabase
    .from('leagues')
    .select('tournament_code, tournament_season')
    .eq('sync_source', 'api')
    .is('archived_at', null)

  if (!leagues?.length) return jsonResponse({ ok: true, message: 'No api-sync leagues' })

  let pairs = [...new Map(
    (leagues as TournamentPair[]).map(l => [`${l.tournament_code}:${l.tournament_season}`, l])
  ).values()]

  if (mode === 'match-window') {
    const now = Date.now()
    const windowStart = new Date(now - MATCH_WINDOW_AFTER_MS).toISOString()
    const windowEnd = new Date(now + MATCH_WINDOW_BEFORE_MS).toISOString()
    const { data: activeMatches, error } = await supabase
      .from('matches')
      .select('tournament_code, tournament_season')
      .gte('kickoff_time', windowStart)
      .lte('kickoff_time', windowEnd)

    if (error) {
      return jsonResponse({ error: `Failed to check match windows: ${error.message}` }, 500)
    }

    const activePairs = new Set(
      (activeMatches as TournamentPair[] | null)?.map(
        match => `${match.tournament_code}:${match.tournament_season}`
      ) ?? []
    )
    pairs = pairs.filter(pair => activePairs.has(`${pair.tournament_code}:${pair.tournament_season}`))

    if (!pairs.length) {
      return jsonResponse({
        ok: true,
        mode,
        message: 'No active match windows',
        windowStart,
        windowEnd,
      })
    }
  }

  const results = []
  for (const { tournament_code, tournament_season } of pairs) {
    const result: Record<string, unknown> = { tournament_code, tournament_season }

    try {
      const res = await fetch(`${APP_URL}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-sync-secret': SYNC_SECRET },
        body: JSON.stringify({ tournament_code, season: tournament_season }),
      })
      result.sync = { ok: res.ok, status: res.status }
    } catch (e) {
      result.sync = { ok: false, error: String(e) }
    }

    if (mode === 'daily') {
      try {
        const res = await fetch(`${APP_URL}/api/ai`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-sync-secret': SYNC_SECRET },
          body: JSON.stringify({
            action: 'seed_matches',
            force: true,
            tournament_code,
            season: tournament_season,
          }),
        })
        result.aiInsightRefresh = { ok: res.ok, status: res.status }
      } catch (e) {
        result.aiInsightRefresh = { ok: false, error: String(e) }
      }
    }

    results.push(result)
  }

  return jsonResponse({ ok: true, mode, results })
})
