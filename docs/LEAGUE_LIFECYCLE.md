# League Archive and Delete

League lifecycle actions are account-owner controls. Authentication is required before league access, and an admin role alone is not enough.

## Behavior

- Active and archived leagues are listed separately on the signed-in home dashboard.
- Signed-out visitors cannot see create/join controls or league lists.
- **Archive** keeps standings and history visible but blocks new members and all writes.
- **Restore** re-enables joins, predictions, picks, manual results, imports, sync, and AI generation.
- **Delete** permanently removes the league and its players, predictions, tournament picks, summaries, and recaps.
- Shared tournament fixtures and sync logs are not deleted.
- Permanent deletion requires typing the exact six-character invite code.

The server authorizes archive, restore, and delete only when:

```text
authenticated user id = leagues.created_by_user_id
```

## 1. Run The Schema Migration

In Supabase Dashboard:

1. Open **SQL Editor**.
2. Click **New query**.
3. Paste the following SQL.
4. Click **Run**.

```sql
alter table public.leagues
  add column if not exists archived_at timestamptz;

alter table public.leagues
  add column if not exists archived_by_user_id uuid
  references auth.users(id) on delete set null;

create index if not exists idx_leagues_archived_at
  on public.leagues(archived_at);
```

Verify:

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'leagues'
  and column_name in ('archived_at', 'archived_by_user_id')
order by column_name;
```

Expected result: two rows.

## 2. Inspect Legacy Leagues Before Cleanup

Permanent deletion cannot be undone. Run this inspection query before deleting:

```sql
select
  l.name,
  l.invite_code,
  l.created_by_user_id,
  count(p.id) as player_count
from public.leagues l
left join public.players p on p.league_id = l.id
where l.invite_code in ('VV4SNR', '46D5V4', '2UNGS4', 'KG6H85')
group by l.id, l.name, l.invite_code, l.created_by_user_id
order by l.created_at;
```

Confirm it returns exactly four leagues and each has `created_by_user_id = null`.

## 3. Permanently Delete The Approved Legacy Leagues

Run only after confirming the inspection result:

```sql
do $$
declare
  legacy_count integer;
  deleted_count integer;
begin
  select count(*)
  into legacy_count
  from public.leagues
  where created_by_user_id is null
    and invite_code in ('VV4SNR', '46D5V4', '2UNGS4', 'KG6H85');

  if legacy_count <> 4 then
    raise exception
      'Expected 4 unclaimed legacy leagues, found %. Nothing was deleted.',
      legacy_count;
  end if;

  delete from public.leagues
  where created_by_user_id is null
    and invite_code in ('VV4SNR', '46D5V4', '2UNGS4', 'KG6H85');

  get diagnostics deleted_count = row_count;

  if deleted_count <> 4 then
    raise exception
      'Expected to delete 4 leagues, deleted %. Transaction rolled back.',
      deleted_count;
  end if;
end $$;
```

Verify cleanup:

```sql
select name, invite_code
from public.leagues
where invite_code in ('VV4SNR', '46D5V4', '2UNGS4', 'KG6H85');
```

Expected result: zero rows.

## 4. Deploy And Create A Fresh Owned League

1. Deploy the updated application to Vercel.
2. Redeploy the `sync-matches` Edge Function because it now ignores archived leagues.
3. Open `https://tournament-prediction-uwt7.vercel.app/auth/sign-up`.
4. Create and confirm your account.
5. Sign in and create a new league.

New leagues automatically set `created_by_user_id`, so the owner settings button appears in the league header.

## Owner API

Archive:

```http
PATCH /api/leagues/<league-id>
Content-Type: application/json

{"action":"archive"}
```

Restore:

```http
PATCH /api/leagues/<league-id>
Content-Type: application/json

{"action":"restore"}
```

Delete:

```http
DELETE /api/leagues/<league-id>
Content-Type: application/json

{"confirm_invite_code":"ABC123"}
```

These endpoints require the authenticated Supabase session cookie. Browser session tokens are not part of the application identity model.
