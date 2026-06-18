# Account-First Privacy Migration

This migration makes Supabase Auth the only gameplay identity and removes anonymous database access.

## Deployment Order

1. Deploy the account-first application to Vercel.
2. Confirm the deployment is healthy.
3. Run the privacy migration in Supabase.
4. Verify anonymous access is blocked and signed-in gameplay still works.

Do not run the migration before deploying the updated application. The older browser code reads public player rows and would stop working.

## Run The Migration

In Supabase Dashboard:

1. Open **SQL Editor**.
2. Click **New query**.
3. Open `supabase/account_first_privacy_migration.sql` from this repository.
4. Paste the entire file into the query.
5. Click **Run**.

The migration also adds the archive columns if they are not already present.

It performs these changes:

- Gameplay reads become `authenticated` only.
- Anonymous privileges are revoked.
- Direct inserts, updates, and deletes are revoked from authenticated browser clients.
- API and server jobs continue through the service-role client.
- Browser access to `players.session_token` and `players.user_id` is removed.
- `players` is removed from the Realtime publication.

## Verify Policies

Run:

```sql
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'leagues',
    'players',
    'matches',
    'match_predictions',
    'tournament_predictions',
    'matchday_summaries',
    'match_recaps',
    'sync_log'
  )
order by tablename, policyname;
```

Each gameplay read policy should list `{authenticated}`. There should be no permissive gameplay insert or update policies.

Verify that player rows are no longer published directly:

```sql
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
order by tablename;
```

`players` should not appear. `matches` and `match_predictions` should remain.

## Application Checks

- Signed out `/` shows only Sign in and Create account.
- Signed out `/league/CODE` redirects to sign-in and returns afterward.
- Signed out `/join/CODE` preserves the invitation through authentication.
- A signed-in member can predict and update tournament picks.
- A signed-in non-member can view a league URL and choose to join.
- Archive, restore, owner delete, manual results, and scheduled sync continue working.

The `players.session_token` column is intentionally left in place but is unused. It can be removed in a later cleanup migration after production has been stable.
