# Monitoring

This is the supervision setup: what we watch, what we measure it against, and who
gets told when something breaks. It is the deliverable for competence C4.1.2.

We watch three things in production: errors, uptime, and the OCR queue. All three
run on free tiers.

| What   | Tool             | Where                      |
| ------ | ---------------- | -------------------------- |
| Errors | Sentry           | API and worker processes   |
| Uptime | Uptime Robot     | polls `GET /health`        |
| Queue  | BullMQ dashboard | `/admin/queues` on the API |

## What we supervise, and what we do not

PantryAI is a web and mobile client on top of one API, with an asynchronous OCR
pipeline behind it. That shape decides the supervision: the API is the single point
everything goes through, so watching it well is worth more than watching each client.
The OCR queue gets its own attention because it is the one part that fails slowly
rather than loudly, jobs pile up long before anyone sees an error.

In scope:

| Component               | Why it is watched                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| API process (Railway)   | Every feature goes through it. If it is down, everything is down                               |
| OCR worker              | Runs in the same process on Railway today. A stuck worker means receipts never finish scanning |
| Postgres (Supabase)     | All application data. Also pauses itself on the free plan, see ANO-02                          |
| Redis (Railway managed) | The BullMQ queue. Without it, scans are accepted and never processed                           |
| OCR queue depth         | The pipeline's early warning signal                                                            |
| Web app (Vercel)        | Vercel's own dashboard reports build and function health                                       |

Out of scope, deliberately, and worth being straight about:

- **The Android APK.** There is no crash reporting on the client, so a mobile crash
  reaches us only if a tester tells us. This is the biggest hole in the setup and it
  is the first recommendation in
  [FUTURE.md](../help/FUTURE.md).
- **Cloudflare R2.** Storage failures show up as API errors in Sentry rather than
  being watched directly. Acceptable because receipt images live for 24 hours and a
  failed upload fails the scan loudly.
- **Load behaviour.** No load testing has been done. The product has no real traffic,
  so a p95 measured with no concurrency would not tell us anything useful.

## The probes

A probe is something that runs on its own and tells us the answer without anyone
looking. Six of them:

| Probe                     | What it actually verifies                                                                           | How often    | Where it runs                                                                           | A failure means                                        |
| ------------------------- | --------------------------------------------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `GET /health`             | Runs a real `SELECT 1` against Postgres and a `PING` against Redis, then reports `ok` or `degraded` | On demand    | [health.controller.ts](../packages/api/src/health/health.controller.ts)                 | The request path is broken, not just the process       |
| Uptime Robot monitor      | Calls `/health` over the public internet and keyword-matches `"status":"ok"`                        | Every 5 min  | Uptime Robot, outside our infrastructure                                                | The API is unreachable or degraded for real users      |
| Railway healthcheck       | Calls `/health` before routing traffic to a new deployment                                          | Every deploy | Railway platform                                                                        | The new version does not serve, the previous one stays |
| Sentry exception capture  | Catches unhandled non-HTTP exceptions in the API and the worker                                     | On every 500 | [http-exception.filter.ts](../packages/api/src/common/filters/http-exception.filter.ts) | Code is failing in a way we did not anticipate         |
| Supabase keep-alive       | Connects and runs `select 1` so the free project does not pause                                     | Every 3 days | [supabase-keepalive.yml](../.github/workflows/supabase-keepalive.yml)                   | The database is about to pause, or already has         |
| BullMQ dashboard counters | Waiting, active, completed and failed job counts, with durations                                    | Read by hand | [bull-board.ts](../packages/api/src/common/bull-board.ts)                               | The OCR pipeline is backing up or failing              |

Two of these deserve a note.

**Why `/health` is a readiness check and not a liveness check.** It would be cheaper
to return `200 OK` and be done. But a Node process answers HTTP perfectly well while
its database connection is dead, so a liveness check would stay green through an
outage that breaks every feature. Touching both dependencies is what makes a green
check mean something. The cost is one trivial query every 5 minutes.

**Why Sentry only sees some failures.** The exception filter reports to Sentry only
for non-`HttpException` errors, meaning genuine 500s. Deliberate 4xx responses, a
validation failure or a 404, are normal operation and would drown the signal. The
consequence is that a bug which returns a wrong answer with a `200` is invisible to
Sentry. ANO-01 was exactly that, which is why the anomaly register does not rely on
Sentry alone.

## What is actually switched on

Three of the six probes are instrumented in code but not activated in production,
because the environment variables that turn them on are not set. Saying they are
running would be wrong, and checkable in one request.

| Probe                     | State                      | What is missing                               |
| ------------------------- | -------------------------- | --------------------------------------------- |
| `GET /health`             | **live**                   | nothing                                       |
| Railway healthcheck       | **live**                   | nothing                                       |
| Supabase keep-alive       | **live** since 1.0.1       | nothing, `SUPABASE_DB_URL` secret is set      |
| Uptime Robot monitor      | to switch on               | create the monitor and the alert contact      |
| Sentry exception capture  | instrumented, to switch on | set `SENTRY_DSN` on Railway                   |
| BullMQ dashboard counters | instrumented, to switch on | set `BULLBOARD_USER` and `BULLBOARD_PASSWORD` |

All three are configuration, not development. Until they are set, the error rate and
the OCR p95 are targets we state rather than numbers we measure. The setup steps are in
the sections below.

## What we measure against

These come from the KPIs in the conception dossier, and each one is checkable.

| Criterion             | Threshold                                                     | Read it from                  | Scenario   |
| --------------------- | ------------------------------------------------------------- | ----------------------------- | ---------- |
| Availability          | ≥ 99% over a rolling week                                     | Uptime Robot monitor          | CR-PERF-04 |
| OCR processing time   | p95 ≤ 5 s                                                     | BullMQ job durations          | CR-PERF-01 |
| Add a product         | p95 ≤ 10 s                                                    | Timed by hand on the web flow | CR-PERF-02 |
| Barcode scan          | under 2 s                                                     | Timed by hand on mobile       | CR-PERF-03 |
| Queue health          | failed count returns to 0, waiting does not grow across a day | BullMQ dashboard              |            |
| Error rate            | no unresolved Sentry issue carried past a release             | Sentry issue list             |            |
| Database availability | keep-alive green, project never paused                        | Actions tab                   | CR-PERF-04 |

Availability at 99% allows about 1 hour 40 minutes of downtime a week, which is a
realistic target on free-tier hosting with a single API instance. We would rather
state a number we can hold than claim a number that sounds better.

## Alerting

Who gets told, when, and through what.

| Condition                            | Channel                                    | Delay before we know                      |
| ------------------------------------ | ------------------------------------------ | ----------------------------------------- |
| `/health` fails 2 consecutive checks | Uptime Robot email to the alert contact    | Up to 10 min                              |
| A new unresolved Sentry issue        | Sentry email                               | Near immediate                            |
| The keep-alive run fails             | GitHub Actions failure email               | Up to 3 days, then the next scheduled run |
| A CI or deploy run fails             | GitHub Actions failure email               | Immediate                                 |
| The OCR queue backs up               | Nothing automatic. Read from the dashboard | Only when someone looks                   |

Two consecutive failures rather than one is on purpose: a single missed check on free
hosting is usually a cold start or a transient network blip, and an alert that cries
wolf gets ignored, which is worse than no alert.

**Escalation.** A Critical anomaly (one filed through
[the bug report form](../.github/ISSUE_TEMPLATE/bug_report.yml) at Critical severity) is fixed the
same day, and the fix goes to `master` as a hotfix so Railway redeploys immediately.
Anything else waits for the normal release cycle. The first move on an alert is
always `GET /health`, because it separates "the API is down" from "one feature is
broken" in one request.

**The queue alert is the honest gap.** Nothing tells us the OCR queue is backing up;
we find out by opening the dashboard. During the validation period we check it daily.
That is a manual process pretending to be supervision, and it is on the improvement
list.

## Health endpoint

`GET /health` is public and cheap. It pings Postgres and Redis and returns:

```json
{ "status": "ok", "db": "up", "redis": "up", "uptime": 1234 }
```

`status` is `ok` only when both dependencies answer, otherwise `degraded`. The
Docker healthcheck and Uptime Robot both hit this route, so a green check means the
whole request path works, not just that the process is alive.

## Errors with Sentry

Sentry catches unexpected (non-HTTP) errors. It is wired in
`packages/api/src/instrument.ts`, which is imported on the first line of both
`main.ts` and `worker.ts` so it loads before anything else. Unhandled 500s are
reported from the global exception filter.

It is **off unless `SENTRY_DSN` is set**, so local and dev runs send nothing.

RGPD matters here: we never want a user's email, name, or food data in an error
report. So `beforeSend` strips the user object, request body, cookies, query
string, and auth headers, and `sendDefaultPii` is false. `tracesSampleRate` is low
to stay inside the free tier.

To set it up:

1. Create a free Sentry project (Node platform).
2. Copy the DSN into `SENTRY_DSN` in `packages/api/.env` on the server.
3. Restart the API and worker. Force a 500 once and confirm it shows up with no
   personal data attached.

## Uptime with Uptime Robot

1. Create a free Uptime Robot account.
2. Add an HTTP(s) monitor on `https://<your-domain>/health`, checked every 5
   minutes.
3. Set the keyword check to expect `"status":"ok"` if you want it stricter than a 200.
4. Add an alert contact (email) so we hear about downtime.

The KPI is availability ≥ 99%, which Uptime Robot reports over any window.

## Keeping the database awake

The Supabase free plan pauses a project after 7 days without activity, and while it
is paused every query fails. [supabase-keepalive.yml](../.github/workflows/supabase-keepalive.yml)
runs `select 1` every 3 days to prevent that. The full background, including why
`pg_cron` does not help, is in [supabase-keepalive.md](./supabase-keepalive.md).

It needs a `SUPABASE_DB_URL` repository secret. Without it the run fails loudly rather
than passing quietly, which is the point: a keep-alive that silently does nothing is
worse than none, because we would believe we were covered.

## The OCR queue dashboard

The BullMQ dashboard is mounted at `/admin/queues` on the API. It shows the OCR
queue: waiting, active, completed, and failed jobs, with retry and inspect.

It is behind HTTP basic auth and is only mounted when both `BULLBOARD_USER` and
`BULLBOARD_PASSWORD` are set. With no credentials it is not mounted at all, so the
queue internals are never exposed by accident. Set strong credentials in
`packages/api/.env`:

```
BULLBOARD_USER=admin
BULLBOARD_PASSWORD=<a long random string>
```

Then open `https://<your-domain>/admin/queues` and sign in. Watch the failed count
during validation: a healthy queue drains to zero and the p95 processing time
stays under the 5 second KPI.

## Scheduled jobs

Two jobs run on a schedule inside the API process, and both are worth knowing about
when something looks wrong at a fixed time of day:

- **03:00 daily**, the R2 sweeper deletes receipt images older than 24 hours
  ([r2-sweeper.service.ts](../packages/api/src/storage/r2-sweeper.service.ts)). This
  is the RGPD backstop behind the delete that already happens after each scan.
- **08:00 daily**, expiration push notifications go out
  ([notifications.service.ts](../packages/api/src/notifications/notifications.service.ts)).

Both only run where `RUN_OCR_WORKER` is not `false`, so they execute once even when
the API and worker are split into two containers. Neither reports success anywhere: a
failure surfaces in Sentry if it throws, and otherwise passes unnoticed.

## What this setup does not cover

Being clear about the limits is more useful than overstating the setup, and each of
these is costed in
[FUTURE.md](../help/FUTURE.md):

- **Three probes are not switched on yet.** See the table above. This is the biggest
  gap and the cheapest to close.
- **No crash reporting on mobile.** An APK crash is invisible unless a tester says so.
- **No structured logging.** We use the NestJS `Logger`, so logs are plain text on
  the host with no aggregation, no search, and no retention policy. Debugging a past
  incident means hoping the container has not been recycled.
- **No metrics or APM.** There is no `/metrics` endpoint and no traces. The
  performance KPIs are read by hand off the BullMQ dashboard, which means they are
  measured during validation and not continuously.
- **No alert on queue depth.** Covered above.
- **The unused deploy workflow has a bad health check.** The `api` job in `deploy.yml`
  polls `/api/docs` rather than `/health`, and Swagger answers even when the database
  is unreachable. It has never run against anything, since that job targets a server we
  decided not to build. The job should be deleted rather than fixed.

## What each KPI maps to

| KPI                  | Read it from                                    |
| -------------------- | ----------------------------------------------- |
| Uptime ≥ 99%         | Uptime Robot monitor on `/health`               |
| OCR p95 ≤ 5s         | BullMQ dashboard job durations (and CR-PERF-01) |
| Error rate           | Sentry issues over time                         |
| Queue not backing up | BullMQ waiting/failed counts                    |
