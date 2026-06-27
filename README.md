# Tournament Predictor

A private football prediction game for friends, built with Next.js, Supabase Auth, Supabase Postgres, and Groq AI.

## Table of Contents

- [How To Play](#how-to-play)
- [Current UI Behavior](#current-ui-behavior)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Authentication Email Delivery](#authentication-email-delivery)
- [Identity And Privacy](#identity-and-privacy)
- [Game Rules](#game-rules)
- [Project Layout](#project-layout)
- [Production Scheduling](#production-scheduling)
- [Documentation](#documentation)

## How To Play

1. Create an account or sign in.
2. Create a league, or join one with its six-character invite code.
3. Predict match scores before kickoff.
4. Choose the tournament winner and top scorer before their deadlines.
5. Follow standings, prediction reveals, and match recaps.

The signed-out home page is an authentication gate. Create/join controls and active or archived league lists appear only after sign-in.

Invite links preserve their destination through sign-in, signup, and email confirmation. For example, a user opening `/join/ABC123` returns to that invitation after authentication.

## Current UI Behavior

- The signed-in dashboard places active leagues first, with **Join a League** beneath them and **Create a League** alongside on wider screens. Archived leagues remain available as read-only history.
- Each league has **Standings**, **Matches**, **Reveal**, and **My Picks** tabs. Active league admins also see **Results**.
- The league header provides Home navigation, scoring Rules, the optional Telegram/WhatsApp chat link, and the invite code.
- The **Matches** tab opens in chronological kick-off order. Finished games are hidden by default so upcoming and locked games are easier to find.
- Players can reveal finished games and switch between chronological ordering and stage grouping. These view choices are local UI state and reset when the match list is remounted.
- Match cards accept score predictions while open, become read-only at kick-off, reveal named picks after locking, and display earned points and generated match recaps after finishing.
- Match and prediction changes are received through Supabase Realtime so standings and match views update without a full page reload.
- The **Reveal** tab supports match-status filtering and explains when anonymous trends, named picks, and earned points become visible.
- The **My Picks** tab shows the current tournament bonus tier, lock deadlines, saved league picks, and the point effect of changing an existing pick.
- The **Results** tab lets admins enter the official top scorer. Manual-sync leagues also allow admins to enter and correct match results, including selecting a penalty-shootout winner for tied knockout games.
- The interface is responsive: header controls and match-view buttons wrap on narrow screens, while tabs remain horizontally scrollable.

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

## Authentication Email Delivery

Supabase's built-in email sender is intended only for initial testing. It has a very low project-wide limit, so multiple account confirmations or password resets can produce an `email rate limit exceeded` error.

Before inviting players:

1. In Supabase, open **Authentication > Emails > SMTP Settings**.
2. Enable custom SMTP using a transactional email provider such as Resend, Postmark, SendGrid, or Brevo.
3. In **Authentication > Rate Limits**, set an email limit appropriate for the league.
4. In **Authentication > URL Configuration**, confirm the production site URL and redirect URLs are allowed.
5. Test signup and password reset with an address that is not a member of the Supabase organization.

Keep email confirmation enabled. Disabling it avoids confirmation emails but allows accounts to be created for email addresses the person does not control.

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
- Correct score difference: 2 points
- Correct outcome with the wrong score difference: 1 point
- Wrong outcome: 0 points

In multiplied mode, stage multipliers are group x1, round of 32 x2, round of 16 x2, quarter-final x3, semi-final x4, third place x4, and final x5.
In flat mode, every stage remains 3/2/1/0 with no multiplier.
For non-group matches, a draw prediction can include a penalty shootout winner. If the real match goes to penalties and the predicted shootout winner is correct, the player gets a small bonus: +1 in flat mode or +2 in multiplied mode. No penalty bonus is awarded if the match is won before penalties.

Tournament picks use time-weighted bonuses:

- Correct winner: 30 points before the first kickoff, then 24 before the round of 16, 18 before the quarter-finals, 12 before the semi-finals, and 6 before the final.
- Correct top scorer: 20 points before the first kickoff, then 16 before the round of 16, 12 before the quarter-finals, and 8 before the semi-finals.
- Changing a saved pick moves that pick to the bonus tier active at the time of the change.
- Winner picks lock at final kickoff. Top-scorer picks lock at semi-final kickoff.
- Winner bonuses are awarded after the final is completed. Top-scorer bonuses are awarded after the lock deadline once a league admin records the official top scorer.
- The champion is derived automatically from the completed final.
- Team and player names are compared without case, accents, repeated spaces, hyphens, or apostrophes.

Total points are match points plus tournament-pick bonuses. If total points are tied, the player with more exact-score predictions ranks first.

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
