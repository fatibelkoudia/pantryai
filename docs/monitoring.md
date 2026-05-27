# Monitoring

We watch three things in production: errors, uptime, and the OCR queue. All three
run on free tiers.

| What   | Tool             | Where                      |
| ------ | ---------------- | -------------------------- |
| Errors | Sentry           | API and worker processes   |
| Uptime | Uptime Robot     | polls `GET /health`        |
| Queue  | BullMQ dashboard | `/admin/queues` on the API |

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

## What each KPI maps to

| KPI                  | Read it from                                    |
| -------------------- | ----------------------------------------------- |
| Uptime ≥ 99%         | Uptime Robot monitor on `/health`               |
| OCR p95 ≤ 5s         | BullMQ dashboard job durations (and CR-PERF-01) |
| Error rate           | Sentry issues over time                         |
| Queue not backing up | BullMQ waiting/failed counts                    |
