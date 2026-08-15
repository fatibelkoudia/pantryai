# Monitoring

This is the supervision setup: what we watch, what we measure it against, and who
gets told when something breaks. It is the deliverable for competence C4.1.2.

We watch three things in production: errors, uptime, and the OCR queue. All three
run on free tiers.

| What   | Tool             | Where                      |
| ------ | ---------------- | -------------------------- |
| Errors | Sentry           | API, HTTP path only        |
| Uptime | Uptime Robot     | polls `GET /health`        |
| Queue  | BullMQ dashboard | `/admin/queues` on the API |

## What we watch

The web and mobile apps both talk to the same API, and all the logic lives there. So we
mostly watch the API. The OCR queue gets its own check because it fails quietly: jobs
pile up while the app carries on answering normally, so nobody notices until an
inventory does not fill up.

| Component               | Why we watch it                                                    |
| ----------------------- | ------------------------------------------------------------------ |
| API process (Railway)   | Everything goes through it. If it is down, everything is down      |
| OCR worker              | Same process as the API today. Stuck worker, receipts never finish |
| Postgres (Supabase)     | All the data. Also pauses itself on the free plan, see ANO-02      |
| Redis (Railway managed) | Holds the queue. Without it scans are accepted and never processed |
| OCR queue depth         | Tells us early when the pipeline is in trouble                     |
| Web app (Vercel)        | Vercel's own dashboard covers builds and functions                 |

What we do not watch:

- **The Android APK.** No crash reporting on the client, so we only hear about a mobile
  crash if a tester tells us. Biggest gap we have, it is in
  [FUTURE.md](../help/FUTURE.md).
- **Cloudflare R2.** Storage problems show up as API errors in Sentry. Fine for now:
  images only live 24 hours and a failed upload fails the scan visibly.
- **Load.** We have not run any load tests. There is no real traffic yet, so a p95
  measured on an idle app would not mean much.

## The probes

These run on their own, without anyone looking. Six of them:

| Probe                     | What it checks                                                                            | How often                             | Where                                                                                   | A failure means                                        |
| ------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `GET /health`             | Runs a real `SELECT 1` on Postgres and a `PING` on Redis, then returns `ok` or `degraded` | On demand                             | [health.controller.ts](../packages/api/src/health/health.controller.ts)                 | The whole request path is broken, not just the process |
| Uptime Robot monitor      | Calls `/health` from outside and looks for `"status":"ok"`                                | Every 5 min                           | Uptime Robot                                                                            | The API is unreachable or degraded for real users      |
| Railway healthcheck       | Calls `/health` before sending traffic to a new deployment                                | Every deploy                          | Railway                                                                                 | The new version does not serve, the old one stays      |
| Sentry exception capture  | Catches unexpected failures on the API's HTTP path and in the OCR worker                  | 500s, and a job's last failed attempt | [http-exception.filter.ts](../packages/api/src/common/filters/http-exception.filter.ts) | Code is failing in a way we did not expect             |
| Supabase keep-alive       | Connects and runs `select 1` so the free project does not pause                           | Every 3 days                          | [supabase-keepalive.yml](../.github/workflows/supabase-keepalive.yml)                   | The database is about to pause, or already has         |
| BullMQ dashboard counters | Waiting, active, completed and failed job counts, and how long jobs took                  | Read by hand                          | [bull-board.ts](../packages/api/src/common/bull-board.ts)                               | The OCR pipeline is backing up or failing              |

Three notes on these.

**Why `/health` hits the database and Redis.** Returning `200 OK` would be cheaper, but
a Node process keeps answering HTTP fine even when its database connection is dead. A
check like that would stay green right through an outage. Querying both dependencies
costs one small query every 5 minutes, and it makes the green light mean something.

**Sentry only sees real 500s, on purpose.** The exception filter reports non-`HttpException`
errors only. Deliberate 4xx responses (a validation error, a 404) are normal and would
bury the signal. So a bug that returns a wrong answer with a `200` never reaches Sentry.
ANO-01 was one of those, which is why we do not rely on Sentry alone to find bugs.

**The worker reports too, but not everything.** BullMQ swallows whatever the processor
throws, so for a while a failed OCR job only showed up in the queue counters. The
processor now reports to Sentry on a job's last attempt. It skips the failures we throw
on purpose for bad input (dead URL, file over 5 MB, host resolving somewhere private),
because those are the queue's version of a 400 and would bury the real faults. That
check matches on the error message for now, which is a stopgap until the processor
throws typed errors.

## What is switched on

All six have been running since 14/08/2026. Sentry and the queue dashboard sat in the
code unused for a while because the environment variables were not set, so it is worth
saying plainly which ones are live and since when.

| Probe                     | Live since |
| ------------------------- | ---------- |
| `GET /health`             | 1.0.0      |
| Railway healthcheck       | 1.0.0      |
| Supabase keep-alive       | 1.0.1      |
| Uptime Robot monitor      | 14/08/2026 |
| Sentry exception capture  | 14/08/2026 |
| BullMQ dashboard counters | 14/08/2026 |

The last three took no code, only configuration: create the monitor and its alert
contact on Uptime Robot, and set `SENTRY_DSN`, `BULLBOARD_USER` and `BULLBOARD_PASSWORD`
on Railway.

You can check each one yourself:

```bash
curl -s https://<api>/health                                        # {"status":"ok",...}
curl -o /dev/null -w "%{http_code}\n" https://<api>/admin/queues    # 401, mounted and protected
```

One caveat on the availability number: the monitor was only created on 14/08/2026, so
the percentage covers the window since then, not a full week.

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

99% works out at about 1 hour 40 minutes of downtime a week. That is what we can
actually hold on free hosting with one API instance, so that is the number we put
down rather than a nicer-looking one.

## Alerting

Who gets told, when, and through what.

| Condition                            | Channel                                    | Delay before we know                      |
| ------------------------------------ | ------------------------------------------ | ----------------------------------------- |
| `/health` fails 2 consecutive checks | Uptime Robot email to the alert contact    | Up to 10 min                              |
| A new unresolved Sentry issue        | Sentry email                               | Near immediate                            |
| The keep-alive run fails             | GitHub Actions failure email               | Up to 3 days, then the next scheduled run |
| A CI or deploy run fails             | GitHub Actions failure email               | Immediate                                 |
| The OCR queue backs up               | Nothing automatic. Read from the dashboard | Only when someone looks                   |

Two failures in a row rather than one, on purpose. A single missed check on free
hosting is usually a cold start or a brief network blip. If the alert goes off for
nothing too often we stop reading it.

**Escalation.** Anything filed at Critical severity through
[the bug report form](../.github/ISSUE_TEMPLATE/bug_report.yml) gets fixed the same day
and merged to `master`, which redeploys straight away. Everything else waits for the
next release. First thing to do on any alert is call `GET /health`: one request tells
you whether the API is down or just one feature is broken.

**The queue is the weak spot.** Nothing warns us when it backs up, we find out by
opening the dashboard. During validation we check it daily, which is a manual check
rather than real monitoring. It is on the improvement list.

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

Worth writing down rather than glossing over. All of these are in
[FUTURE.md](../help/FUTURE.md):

- **No crash reporting on mobile.** An APK crash is invisible unless a tester says so.
- **No structured logging.** We use the NestJS `Logger`, so logs are plain text on the
  host: no search, no aggregation, nothing kept. Debugging something from last week
  means hoping the container was not recycled.
- **No metrics or APM.** No `/metrics` endpoint, no traces. The performance numbers are
  read by hand off the BullMQ dashboard, so we get them during validation and not the
  rest of the time.
- **No alert on queue depth.** Covered above.
- **The OCR p95 is over its threshold.** Measured at 6.76 s against a 5 s target, logged
  as ANO-03. Not a hole in the monitoring, the monitoring is what found it, but the
  criterion is not met and the analysis is in the issue.

## What each KPI maps to

| KPI                  | Read it from                                    |
| -------------------- | ----------------------------------------------- |
| Uptime ≥ 99%         | Uptime Robot monitor on `/health`               |
| OCR p95 ≤ 5s         | BullMQ dashboard job durations (and CR-PERF-01) |
| Error rate           | Sentry issues over time                         |
| Queue not backing up | BullMQ waiting/failed counts                    |
