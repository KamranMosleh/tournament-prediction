# ⚽ Tournament Predictor

Predict football match scores with friends. No accounts needed — create a league, share a code, compete.

Built with Next.js 14, Supabase, Tailwind CSS, and Groq AI.

## Quick start

```bash
# 1. Install
npm install

# 2. Copy env template and fill in your keys (see below)
cp .env.example .env.local

# 3. Run the database schema
#    → Open supabase/schema.sql in your Supabase SQL editor and Run

# 4. Start
npm run dev
```

## Environment variables

| Variable | How to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API |
| `FOOTBALL_DATA_API_KEY` | [football-data.org/client/register](https://www.football-data.org/client/register) — free |
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) — free |
| `CRON_SECRET` | Vercel sets this automatically (see Vercel docs) |

## Project layout

```
app/
  page.tsx                    Landing page
  join/[code]/page.tsx        Join via shared link
  league/[code]/page.tsx      League hub (server component)
  api/
    leagues/                  Create league
    players/                  Join / session recovery
    predictions/              Save match prediction
    tournament-predictions/   Save tournament picks
    results/                  Admin manual results
    sync/                     Auto-sync from football-data.org
    ai/                       Generate AI insights via Groq

components/
  layout/LeagueHub.tsx        Main game UI (tabs, realtime)
  leaderboard/Leaderboard.tsx Ranked scores with form %
  matches/MatchCard.tsx       Score inputs + AI insight
  matches/MatchList.tsx       Grouped by stage
  predictions/                Tournament picks + admin results
  ui/                         Avatar, InviteCode, StatusPill

lib/
  scoring.ts                  Round-multiplier points engine
  groq.ts                     Groq AI client + prompts
  supabase/                   Client and server Supabase clients
  utils.ts                    Helpers + localStorage session map

supabase/
  schema.sql                  Full DB schema (run once)
  functions/sync-matches/     Edge Function for cron scheduling
```

## Docs

Full architecture, data model, feature spec, and API setup guides live in `docs/`.
