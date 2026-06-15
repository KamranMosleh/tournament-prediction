// Supabase Edge Function — sync-matches
// Deploy: supabase functions deploy sync-matches
// Schedule via pg_cron calling this function every 5 minutes (see SUPABASE_SETUP.md)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SYNC_SECRET = Deno.env.get('SYNC_SECRET') ?? ''

Deno.serve(async (req) => {
  // Auth
  const auth = req.headers.get('Authorization') ?? ''
  if (SYNC_SECRET && auth !== `Bearer ${SYNC_SECRET}` && !auth.startsWith('Bearer eyJ')) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // Find all unique (tournament_code, season) pairs that use api sync
  const { data: leagues } = await supabase
    .from('leagues')
    .select('tournament_code, tournament_season')
    .eq('sync_source', 'api')

  if (!leagues?.length) return new Response(JSON.stringify({ ok: true, message: 'No api-sync leagues' }))

  const pairs = [...new Map(leagues.map(l => [`${l.tournament_code}:${l.tournament_season}`, l])).values()]

  const results = []
  for (const { tournament_code, tournament_season } of pairs) {
    try {
      // Delegate to the Next.js /api/sync endpoint
      // (Edge Function acts as the cron trigger)
      const appUrl = Deno.env.get('APP_URL') ?? 'https://your-app.vercel.app'
      const res = await fetch(`${appUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-sync-secret': SYNC_SECRET },
        body: JSON.stringify({ tournament_code, season: tournament_season }),
      })
      results.push({ tournament_code, tournament_season, ok: res.ok, status: res.status })
    } catch (e) {
      results.push({ tournament_code, tournament_season, ok: false, error: String(e) })
    }
  }

  return new Response(JSON.stringify({ results }), { headers: { 'Content-Type': 'application/json' } })
})
