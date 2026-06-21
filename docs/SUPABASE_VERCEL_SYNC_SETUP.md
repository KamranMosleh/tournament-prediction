# Supabase and Vercel Sync Setup

This app stays on Vercel Hobby for hosting, while Supabase handles production scheduling.

## Why Vercel Cron Was Removed

The original `vercel.json` requested `/api/sync` every 5 minutes with:

```text
*/5 * * * *
```

Vercel Hobby only supports cron jobs that run once per day. A 5-minute schedule therefore caused Vercel to reject the deployment and ask for a Pro upgrade.

Removing `CRON_SECRET` or `SYNC_SECRET` would not solve that deployment error because Vercel reads the schedule from `vercel.json`, independently of environment variables. Removing both secrets would also weaken `/api/sync` authorization.

The solution is to keep the Next.js app on Vercel Hobby, remove Vercel Cron, and use Supabase `pg_cron` + `pg_net` for scheduling.

## Sync Policy

The production policy is intentionally conservative for football-data.org free usage:

- A baseline sync runs once per day.
- Daily mode force-refreshes open-match AI insights after syncing, so latest results are included.
- A match-window check runs every 10 minutes.
- The match-window check calls football-data.org only when an unfinished match is between 30 minutes before kickoff and 6 hours after kickoff.
- Outside that window, the Edge Function returns `No active match windows` without calling football-data.org.

The flow is:

```text
Supabase pg_cron -> Supabase Edge Function -> Vercel /api/sync -> football-data.org + Supabase tables
                                                    -> Vercel /api/ai force refresh for daily insights
```

The free football-data.org plan currently permits 10 calls per minute, but its scores are delayed. This policy stays comfortably below the rate limit without pretending to provide true live scores.

## Required Vercel Settings

Set these environment variables in the Vercel project:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser/client Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser/client Supabase key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase key that bypasses RLS |
| `FOOTBALL_DATA_API_KEY` | football-data.org match sync |
| `GROQ_API_KEY` | AI insights and recaps |
| `SYNC_SECRET` | Shared secret for scheduled and manual sync calls |

`CRON_SECRET` is not required. The repository has no Vercel cron configuration, so Vercel Hobby can deploy the app normally.

## Supabase Edge Function

Create or update an Edge Function named exactly:

```text
sync-matches
```

Use the code from `supabase/functions/sync-matches/index.ts`.

Under `Edge Functions -> Secrets`, set:

```text
APP_URL=https://<your-vercel-app-domain>
SYNC_SECRET=<same-value-as-vercel>
```

`APP_URL` must not have a trailing slash. Supabase automatically supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to hosted Edge Functions.

Under the `sync-matches` function settings:

1. Turn off **Verify JWT with legacy secret**.
2. Save the setting.

The function performs its own authorization by requiring the `x-sync-secret` header.

## Supabase Scheduler SQL

Open `Supabase Dashboard -> SQL Editor -> New query`.

### 1. Enable extensions and store scheduler secrets

Run this after replacing `<same-sync-secret-as-vercel>`. It can safely create the Vault secrets or update them if they already exist:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault cascade;

do $$
declare
  project_url_id uuid;
  sync_secret_id uuid;
begin
  select id
  into project_url_id
  from vault.decrypted_secrets
  where name = 'project_url'
  limit 1;

  if project_url_id is null then
    perform vault.create_secret(
      'https://hizjqmgfxioaspgvqzql.supabase.co',
      'project_url'
    );
  else
    perform vault.update_secret(
      project_url_id,
      'https://hizjqmgfxioaspgvqzql.supabase.co',
      'project_url'
    );
  end if;

  select id
  into sync_secret_id
  from vault.decrypted_secrets
  where name = 'sync_secret'
  limit 1;

  if sync_secret_id is null then
    perform vault.create_secret(
      '<same-sync-secret-as-vercel>',
      'sync_secret'
    );
  else
    perform vault.update_secret(
      sync_secret_id,
      '<same-sync-secret-as-vercel>',
      'sync_secret'
    );
  end if;
end $$;
```

These Vault values are separate from Edge Function Secrets. Do not store the service-role key in Vault for this scheduler.

### 2. Remove old schedules and create the new policy

Run:

```sql
do $$
declare
  scheduled_job record;
begin
  for scheduled_job in
    select jobid
    from cron.job
    where jobname in (
      'sync-matches-every-5-min',
      'sync-matches-daily',
      'sync-matches-match-window'
    )
  loop
    perform cron.unschedule(scheduled_job.jobid);
  end loop;
end $$;

select cron.schedule(
  'sync-matches-daily',
  '17 4 * * *',
  $$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'project_url'
      limit 1
    ) || '/functions/v1/sync-matches',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'sync_secret'
        limit 1
      )
    ),
    body := '{"mode":"daily"}'::jsonb,
    timeout_milliseconds := 120000
  ) as request_id;
  $$
);

select cron.schedule(
  'sync-matches-match-window',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'project_url'
      limit 1
    ) || '/functions/v1/sync-matches',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'sync_secret'
        limit 1
      )
    ),
    body := '{"mode":"match-window"}'::jsonb,
    timeout_milliseconds := 120000
  ) as request_id;
  $$
);
```

The daily job runs at `04:17 UTC`. The second job checks for active match windows every 10 minutes.

## Manual Verification

Test a daily sync:

```bash
curl -i -X POST "https://<project-ref>.supabase.co/functions/v1/sync-matches" \
  -H "x-sync-secret: <sync-secret>" \
  -H "Content-Type: application/json" \
  -d '{"mode":"daily"}'
```

For daily mode, expect each tournament result to include both `sync` and `aiInsightRefresh` statuses. The AI refresh calls `/api/ai` with:

```json
{
  "action": "seed_matches",
  "force": true
}
```

Test the match-window guard:

```bash
curl -i -X POST "https://<project-ref>.supabase.co/functions/v1/sync-matches" \
  -H "x-sync-secret: <sync-secret>" \
  -H "Content-Type: application/json" \
  -d '{"mode":"match-window"}'
```

Outside a match window, expect:

```json
{
  "ok": true,
  "mode": "match-window",
  "message": "No active match windows"
}
```

## Monitoring

Confirm both jobs exist:

```sql
select jobname, schedule, active
from cron.job
where jobname in ('sync-matches-daily', 'sync-matches-match-window')
order by jobname;
```

Check recent scheduler HTTP responses:

```sql
select status_code, timed_out, error_msg, content, created
from net._http_response
order by created desc
limit 20;
```

Check successful application syncs:

```sql
select *
from sync_log
order by synced_at desc
limit 10;
```

## Security Notes

- Keep `SYNC_SECRET` long and random.
- Use the same value in Vercel, Supabase Edge Function Secrets, and Supabase Vault.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code or prefix it with `NEXT_PUBLIC_`.
- Keep **Verify JWT with legacy secret** off for this function because authorization is handled by `x-sync-secret`.

## Official References

- [football-data.org pricing](https://www.football-data.org/pricing)
- [football-data.org request throttling](https://www.football-data.org/documentation/api)
- [Vercel Cron Jobs usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Supabase scheduled Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)
- [Supabase Edge Function secrets](https://supabase.com/docs/guides/functions/secrets)
- [Supabase pg_net](https://supabase.com/docs/guides/database/extensions/pg_net)
- [Supabase Vault](https://supabase.com/docs/guides/database/vault)
