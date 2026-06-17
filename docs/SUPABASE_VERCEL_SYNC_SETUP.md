# Supabase and Vercel Sync Setup

This app should stay on Vercel Hobby for hosting, while Supabase handles the frequent production scheduler.

## Why Vercel Cron Was Removed

Vercel Hobby accounts limit cron schedules to daily intervals. The app needs match data refreshed every 5 minutes, so a Vercel cron like `*/5 * * * *` blocks Hobby deployment.

The new flow is:

```text
Supabase pg_cron -> Supabase Edge Function -> Vercel /api/sync -> football-data.org + Supabase tables
```

`/api/sync` remains the real worker. Supabase only triggers it.

## Required Vercel Settings

Set these environment variables in the Vercel project:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser/client Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser/client Supabase key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase writes |
| `FOOTBALL_DATA_API_KEY` | football-data.org match sync |
| `GROQ_API_KEY` | AI insights and recaps |
| `SYNC_SECRET` | Shared secret for scheduled and manual sync calls |

`CRON_SECRET` is no longer required for this setup. Remove it from Vercel if it was only used for Vercel Cron.

After removing `vercel.json`, redeploy the app. The Hobby cron-limit warning should disappear.

## Required Supabase Edge Function Secrets

Use the same `SYNC_SECRET` value in Vercel and Supabase.

```bash
supabase login
supabase link --project-ref <project-ref>
supabase secrets set SYNC_SECRET="<same-value-as-vercel>"
supabase secrets set APP_URL="https://<your-vercel-app-domain>"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>"
supabase functions deploy sync-matches
```

`APP_URL` must be the production Vercel app URL, without a trailing slash.

## Supabase Scheduler SQL

Run this in the Supabase SQL editor.

```sql
create extension if not exists vault with schema vault;
create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<supabase-anon-or-publishable-key>', 'publishable_key');
select vault.create_secret('<same-sync-secret-as-vercel>', 'sync_secret');
```

Then schedule the Edge Function every 5 minutes.

```sql
do $$
begin
  perform cron.unschedule('sync-matches-every-5-min');
exception when others then null;
end $$;

select cron.schedule(
  'sync-matches-every-5-min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/sync-matches',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'sync_secret')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

## Manual Verification

Call the Edge Function directly:

```bash
curl -i -X POST "https://<project-ref>.supabase.co/functions/v1/sync-matches" \
  -H "Authorization: Bearer <supabase-anon-or-publishable-key>" \
  -H "x-sync-secret: <sync-secret>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected result: a JSON response with `results`, or `No api-sync leagues` if no leagues currently use API sync.

Check that the scheduler exists:

```sql
select jobname, schedule, active
from cron.job
where jobname = 'sync-matches-every-5-min';
```

Check recent sync work:

```sql
select *
from sync_log
order by synced_at desc
limit 10;
```

Check Supabase HTTP scheduler responses:

```sql
select *
from net._http_response
order by created desc
limit 10;
```

## Security Notes

- Keep `SYNC_SECRET` long and random.
- Do not remove `SYNC_SECRET` from Vercel. Without it, `/api/sync` can fall back to local/dev-open behavior if no other sync secret is configured.
- The Edge Function requires `x-sync-secret` to match its Supabase `SYNC_SECRET` before it calls Vercel.
- The Supabase scheduler also sends the publishable key in `Authorization` so the Edge Function passes Supabase's default JWT check.

## Expected Free-Tier Usage

Every 5 minutes is about 8,640 scheduler calls per 30-day month. That is small for the Supabase free-tier Edge Function invocation allowance, and it avoids Vercel Hobby's daily cron restriction.

## Official References

- [Vercel Cron Jobs usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Supabase scheduled Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)
- [Supabase Edge Function invocation usage](https://supabase.com/docs/guides/platform/manage-your-usage/edge-function-invocations)
- [Supabase pg_net](https://supabase.com/docs/guides/database/extensions/pg_net)
- [Supabase Vault](https://supabase.com/docs/guides/database/vault)
