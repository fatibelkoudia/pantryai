# Keeping the Supabase free project from pausing

## What happens

On the Supabase free plan a project pauses after 7 days with no activity. While it is paused every
DB query fails with this error:

```
DriverAdapterError: (ENOTFOUND) tenant/user postgres.<project-ref> not found
```

There is no free plan setting to turn this off. The "never pause" guarantee is only on the Pro
plan. So the only free workaround is to make a little real database activity at least once inside
the 7 day window, with an external scheduler.

A few things we learned:

- The pause is based on incoming API / DB requests. Just hitting a static page is not enough, the
  ping has to actually touch Postgres (run a `select`).
- `pg_cron` does not help here. It does not reliably count as activity and it cannot run while the
  project is paused, so it cannot wake it up either.
- The free plan only allows 2 active projects, any extra ones pause no matter what.

## Option 1: GitHub Actions keep-alive (what we use)

This runs on GitHub's cron for free and runs a tiny query every few days, well inside the 7 day
window.

`.github/workflows/supabase-keepalive.yml`

```yaml
name: Supabase keep-alive
on:
  schedule:
    - cron: '0 6 */3 * *' # every 3 days at 06:00 UTC
  workflow_dispatch: {} # also lets us run it by hand
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm i pg
      - run: node -e "const{Client}=require('pg');(async()=>{const c=new Client(process.env.DB_URL);await c.connect();await c.query('select 1');await c.end();console.log('kept alive');})()"
        env:
          DB_URL: ${{ secrets.SUPABASE_DB_URL }}
```

Setup:

1. Add a repo secret called `SUPABASE_DB_URL` (the pooler or direct connection string) under
   Settings > Secrets and variables > Actions. We never commit the URL (no keys in code).
2. A `select 1` is enough to reset the inactivity timer.

One thing to watch: GitHub turns off scheduled workflows after 60 days with no commits to the
repo. Normal work keeps it on, otherwise we re-enable it from the Actions tab.

## Option 2: hosted cron hitting PostgREST

If we would rather not put a DB URL in CI, we can point a hosted scheduler (cron-job.org,
UptimeRobot, etc.) at a PostgREST query, which also touches the DB:

```bash
curl "$SUPABASE_URL/rest/v1/<any_table>?select=id&limit=1" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
```

## If it already paused

Open the Supabase dashboard and Restore / Resume the project, then add one of the keep-alives
above so it does not happen again.
