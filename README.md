# Tournament Predictor

A private football prediction game for friends, built with Next.js, Supabase Auth, Supabase Postgres, and Groq AI.

## How To Play

1. Create an account or sign in.
2. Create a league, or join one with its six-character invite code.
3. Predict match scores before kickoff.
4. Choose the tournament winner and top scorer before their deadlines.
5. Follow standings, prediction reveals, and match recaps.

The signed-out home page is an authentication gate. Create/join controls and active or archived league lists appear only after sign-in.

Invite links preserve their destination through sign-in, signup, and email confirmation. For example, a user opening `/join/ABC123` returns to that invitation after authentication.

## Quick Start

```bash
npm install
cp .env.example .env.local
npm run dev
```

For a fresh Supabase project, run `supabase/schema.sql`.

For an existing deployment, deploy the account-first application first, then run:

```text
supabase/account_first_privacy_migration.sql
```

See [Account-First Privacy](docs/ACCOUNT_FIRST_PRIVACY.md) for the exact dashboard steps and verification queries.

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-safe Supabase key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only database access |
| `FOOTBALL_DATA_API_KEY` | football-data.org match sync |
| `GROQ_API_KEY` | AI insights and recaps |
| `SYNC_SECRET` | Shared scheduler authorization secret |

Never expose `SUPABASE_SERVICE_ROLE_KEY` in browser code or prefix it with `NEXT_PUBLIC_`.

## Identity And Privacy

- Supabase Auth cookies are the only player identity mechanism.
- Every player membership is linked to `auth.users` through `players.user_id`.
- Browser localStorage and legacy `session_token` values are not used for authentication.
- Anonymous database reads and all direct gameplay writes are blocked by RLS.
- Authenticated users may read gameplay data, while mutations go through authenticated Next.js API routes.
- Scheduled sync and AI automation use `SYNC_SECRET`, not player authentication.

## Game Rules

Match prediction scoring:

- Exact score: 3 points
- Correct outcome: 1 point
- Wrong outcome: 0 points

In multiplied mode, stage multipliers are group x1, round of 16 x2, quarter-final x3, semi-final x4, third place x4, and final x5.

Tournament winner and top-scorer picks use time-weighted bonuses. Earlier correct picks earn more, and each pick locks at its configured tournament deadline.

Prediction visibility:

- Open matches show anonymous aggregate trends.
- Locked matches reveal named predictions.
- Finished matches also show points earned.

## Project Layout

```text
app/
  page.tsx                    Server-authenticated home gate/dashboard
  auth/                       Sign in, signup, callback, password flows
  join/[code]/page.tsx        Invite-aware account gate
  league/[code]/page.tsx      Authenticated league data loader
  api/                        Account-verified mutation and sync routes

components/
  home/HomeDashboard.tsx      Signed-in create/join and league lists
  join/JoinLeagueForm.tsx     Authenticated invite acceptance
  layout/LeagueHub.tsx        Main gameplay tabs and Realtime updates

lib/
  auth.ts                     Account/player verification
  auth-redirect.ts            Safe internal redirect handling
  supabase/                   Browser, cookie, and service-role clients

supabase/
  schema.sql                  Full schema for a fresh project
  account_first_privacy_migration.sql
  functions/sync-matches/     Scheduled Edge Function
```

## Production Scheduling

Vercel Hobby hosts the Next.js app. Supabase `pg_cron` and `pg_net` invoke the Edge Function, which calls the Vercel sync API. There is no Vercel Cron configuration.

See [Supabase and Vercel Sync Setup](docs/SUPABASE_VERCEL_SYNC_SETUP.md).

## Documentation

- [Workflow and Architecture](docs/APP_WORKFLOW_AND_ARCHITECTURE.md)
- [Account-First Privacy](docs/ACCOUNT_FIRST_PRIVACY.md)
- [League Archive and Delete](docs/LEAGUE_LIFECYCLE.md)
- [Supabase and Vercel Sync Setup](docs/SUPABASE_VERCEL_SYNC_SETUP.md)
