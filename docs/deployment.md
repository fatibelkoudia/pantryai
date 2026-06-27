# Deployment guide

This explains how PantryAI gets to production and what runs where.

## The shape of it

There are four moving parts in production:

- The **web app** runs on Vercel.
- The **API** runs in a Docker container on a Hetzner server, behind Nginx which
  terminates SSL.
- A separate **OCR worker** container runs the BullMQ queue processor and the
  scheduled jobs, so heavy OCR work never shares an event loop with the API.
- The **database** is PostgreSQL on Supabase, and **Redis** runs as a container
  that both the API and the worker reach over the compose network (it is not
  published to the host).

Receipt images live in Cloudflare R2 and are deleted within 24 hours.

```
        Browser / phone
              │  HTTPS
              v
        ┌───────────┐         ┌────────────────────┐
        │  Vercel   │         │      Hetzner       │
        │  (web)    │──────▶  │   Nginx :443       │  SSL termination
        └───────────┘         │      │             │
                              │      v             │
                              │  API :3001         │
                              │      │             │
                              │   Redis ◀── Worker │  OCR + cron jobs
                              └────────────────────┘
                                     │
                                     v
                              Supabase (Postgres)
                              Cloudflare R2 (images)
```

## What deploys, and when

Both apps deploy from one place: a Git tag that looks like `v1.2.3`. Pushing that
tag runs the `Deploy` GitHub Actions workflow (`.github/workflows/deploy.yml`),
which has two jobs:

1. **web**: builds the Next.js app and deploys it to Vercel.
2. **api**: runs the database migrations, then deploys the new container image to
   Hetzner over SSH, checks it came up, and rolls back if it did not.

So the normal release flow is:

```bash
git tag v1.2.3
git push origin v1.2.3
```

Continuous integration (`.github/workflows/ci.yml`) runs on every push and pull
request before any of this: lint, type-check, unit tests, a build, and the
integration tests on pull requests. A release should only happen from a green
branch.

## Secrets the workflows need

Set these in the GitHub repository settings, under Actions secrets:

| Secret                | Used for                                           |
| --------------------- | -------------------------------------------------- |
| `VERCEL_TOKEN`        | Deploying the web app                              |
| `VERCEL_ORG_ID`       | The Vercel org                                     |
| `VERCEL_PROJECT_ID`   | The Vercel project for the web app                 |
| `DATABASE_DIRECT_URL` | Running migrations against the production database |
| `HETZNER_HOST`        | The server's address                               |
| `HETZNER_USER`        | The SSH user                                       |
| `HETZNER_SSH_KEY`     | The private SSH key for that user                  |

## Setting up the Hetzner server (one time)

A small instance is enough to start (the free or cheapest tier covers the MVP).

1. Install Docker and the Docker Compose plugin.
2. Clone the repository to `/opt/pantryai`.
3. Create `packages/api/.env` on the server with the production values (database
   URLs, JWT secrets, Mistral key, R2 keys, and so on). This file is read by the
   API container through `env_file` in the compose file.
4. Point your domain's DNS at the server.
5. Issue an SSL certificate with certbot for the API domain. The Nginx config
   expects the certificate under `/etc/letsencrypt/live/<domain>/`. Update the
   `server_name` and certificate paths in `deploy/nginx/pantryai.conf` to match
   your domain.
6. Start the stack:

   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

After that, releases are automatic from Git tags.

## The container image

The API image is built from `packages/api/Dockerfile`. It is a multi-stage build
on `node:22-alpine`:

- a build stage installs dependencies, generates the Prisma client, and compiles
  the API and the shared package,
- a separate stage installs only production dependencies,
- the final image copies the compiled output plus the production dependencies and
  runs `node dist/main`.

The same image can run the OCR worker instead of the HTTP server, by overriding
the command with `node dist/worker`. See the note on the worker below.

You can build and run it locally to check it:

```bash
docker build -f packages/api/Dockerfile -t pantryai-api .
docker run -p 3001:3001 --env-file packages/api/.env pantryai-api
```

## Migrations

Migrations run from the deploy workflow, not from inside the container, so the
runtime image stays small (it does not ship the Prisma CLI). The workflow runs:

```bash
pnpm --filter @pantryai/api exec prisma migrate deploy
```

against `DATABASE_DIRECT_URL`. We use the direct connection, not the pooler,
because PgBouncer's transaction mode does not support the advisory locks Prisma
needs for migrations.

Migrations run before the new code goes live, so add columns and tables in a way
that the old code can still run against the new schema (expand first, contract
later).

## Rollback

The API deploy has a built-in safety net for risk R6. Before it deploys, it
records the image that is currently serving. After it starts the new container,
it polls the API for up to a minute. If the API never answers, it re-tags the
previous image as the live one and brings it back, then fails the job so we get
notified. So a bad release does not leave the API down, it falls back to the last
version that worked.

If you need to roll back by hand later, check out the previous tag on the server
and run the compose build and up again:

```bash
cd /opt/pantryai
git checkout v1.2.2
docker compose -f docker-compose.prod.yml up -d --build
```

## The OCR worker

In production the OCR work runs in its own container (`node dist/worker`), next to
the API and sharing the same Redis. This matches the deployment diagram from the
design: a heavy OCR job runs in the worker and never ties up the API event loop.

Which process does the background work is decided by one env var, `RUN_OCR_WORKER`:

- The **API** container sets `RUN_OCR_WORKER=false`. It enqueues OCR jobs but does
  not consume them, and it does not run the daily cron jobs.
- The **worker** container sets `RUN_OCR_WORKER=true`. It owns the OCR queue
  processor and the scheduled jobs (R2 sweep, expiration push).

That split is what stops a job, or a daily push, from firing twice. Both values
are already set in `docker-compose.prod.yml`, so `up -d` brings both containers up
correctly.

For a single-process setup (local dev or a minimal deploy), leave `RUN_OCR_WORKER`
unset: it defaults to on, so one process does both the HTTP and the OCR work, just
like before.

## Monitoring

Error tracking (Sentry), uptime (Uptime Robot), and the OCR queue dashboard
(BullMQ) are wired up. The full setup, the env vars, and the RGPD note on scrubbing
personal data live in [monitoring.md](./monitoring.md). The short version:

- `GET /health` pings Postgres and Redis. The Docker healthcheck and Uptime Robot
  both use it.
- Sentry is off unless `SENTRY_DSN` is set, and it strips PII before sending.
- The queue dashboard is at `/admin/queues`, behind basic auth, only mounted when
  `BULLBOARD_USER` and `BULLBOARD_PASSWORD` are set.

## Go-live runbook

The first production stand-up, in order. After this, releases are automatic from
Git tags.

1. **Provision the server.** Create a Hetzner CX11 (or the cheapest tier), Ubuntu
   LTS. Install Docker and the Compose plugin.
2. **DNS.** Point an A record for your API domain (for example `api.pantryai.app`)
   at the server's IP.
3. **Get the code.** Clone the repo to `/opt/pantryai`.
4. **Secrets.** Create `packages/api/.env` on the server with the production
   values: database URLs (Supabase), JWT secrets, Mistral key, R2 keys, and the
   monitoring vars (`SENTRY_DSN`, `BULLBOARD_USER`, `BULLBOARD_PASSWORD`). Leave
   `RUN_OCR_WORKER` out of the file; compose sets it per container.
5. **SSL.** Issue a certificate with certbot for the API domain. Update
   `server_name` and the certificate paths in `deploy/nginx/pantryai.conf` to match
   your domain.
6. **Migrate.** Run `pnpm --filter @pantryai/api exec prisma migrate deploy`
   against `DATABASE_DIRECT_URL` (this also happens in the deploy workflow).
7. **Bring up the stack.** From `/opt/pantryai`:

   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

   This starts Redis, the API, the worker, and Nginx.

8. **Check it.** `curl https://<your-domain>/health` returns
   `{"status":"ok","db":"up","redis":"up"}`. Open `/api/docs` and
   `/admin/queues` (the dashboard should ask for the basic-auth login).
9. **Web app.** Deploy the web app to Vercel (the deploy workflow does this on a
   tag, or run it once by hand). Point its API base URL at your domain.
10. **Monitoring.** Add the Uptime Robot monitor on `/health`, and confirm Sentry
    receives a test error with no personal data. See
    [monitoring.md](./monitoring.md).

Acceptance for the deployment phase: the site is reachable over HTTPS, `/health` is
green, and the three monitors are live.
