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

[`.github/workflows/supabase-keepalive.yml`](../.github/workflows/supabase-keepalive.yml) runs on
GitHub's cron for free. It runs a small query every 3 days, well inside the 7 day window.

**The workflow file is the source of truth, not this page.**

Setup:

1. Add a repo secret called `SUPABASE_DB_URL` under Settings > Secrets and variables >
   Actions. **It has to be the transaction pooler string (port 6543), not the direct
   connection (port 5432)** — see the note below. We never commit the URL (no keys in code).
2. A `select 1` is enough to reset the inactivity timer.

**Use the pooler, not the direct connection.** Supabase's direct host
(`db.<ref>.supabase.co`) only resolves to IPv6, and GitHub Actions runners have no IPv6
connectivity, so the job dies in a few seconds with:

```
keep-alive failed: connect ENETUNREACH 2xxx:...:5432 - Local (:::0)
```

The pooler host (`aws-0-<region>.pooler.supabase.com`, port 6543) is reachable over IPv4,
so that is the one to put in the secret. It is the same string the API already uses as
`DATABASE_TRANSACTION_POOLER_URL`. Transaction mode is fine here: `select 1` takes no
parameters, so node-pg sends it over the simple query protocol and never allocates a
prepared statement.

We hit this for real on 2026-08-14: the first manual run failed with the error above
because the secret held the direct string. Swapping it for the pooler fixed it.

The step exits non-zero on any error instead of passing quietly. That matters: a keep-alive that
silently does nothing is worse than not having one, because we would think we were covered. The
failed run then the green one on 2026-08-14 show the failure path works.

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
