// Supabase Edge Function - sync-matches
// Deploy: supabase functions deploy sync-matches
// Schedule via pg_cron calling this function every 5 minutes.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SYNC_SECRET = Deno.env.get('SYNC_SECRET') ?? ''
const APP_URL = (Deno.env.get('APP_URL') ?? '').replace(/\/$/, '')

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

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // Find all unique (tournament_code, season) pairs that use api sync.
  const { data: leagues } = await supabase
    .from('leagues')
    .select('tournament_code, tournament_season')
    .eq('sync_source', 'api')

  if (!leagues?.length) return jsonResponse({ ok: true, message: 'No api-sync leagues' })

  const pairs = [...new Map(leagues.map(l => [`${l.tournament_code}:${l.tournament_season}`, l])).values()]

  const results = []
  for (const { tournament_code, tournament_season } of pairs) {
    try {
      const res = await fetch(`${APP_URL}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-sync-secret': SYNC_SECRET },
        body: JSON.stringify({ tournament_code, season: tournament_season }),
      })
      results.push({ tournament_code, tournament_season, ok: res.ok, status: res.status })
    } catch (e) {
      results.push({ tournament_code, tournament_season, ok: false, error: String(e) })
    }
  }

  return jsonResponse({ results })
})
