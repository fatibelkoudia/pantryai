# Deployment guide

This explains how PantryAI gets to production and what runs where.

## The shape of it

There are three moving parts in production:

- The **web app** runs on Vercel.
- The **API** runs in a Docker container on a Hetzner server, behind Nginx which
  terminates SSL.
- The **database** is PostgreSQL on Supabase, and **Redis** runs as a container
  next to the API for the OCR queue.

Receipt images live in Cloudflare R2 and are deleted within 24 hours.

```
        Browser / phone
              │  HTTPS
              v
        ┌───────────┐         ┌──────────────┐
        │  Vercel   │         │   Hetzner    │
        │  (web)    │──────▶  │   Nginx :443 │  SSL termination
        └───────────┘         │      │       │
                              │      v       │
                              │  API :3001   │
                              │      │       │
                              │   Redis      │
                              └──────────────┘
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

## A note on the OCR worker

Right now the OCR worker runs inside the API process. That is the simplest thing
to deploy and it is fine for the expected load. The work still goes through a real
Redis queue, so nothing blocks the HTTP request itself.

The image can also run as a worker-only process (`node dist/worker`), and the
production compose file has a `worker` service behind a profile for that. We do
not enable it yet, because the API already does the OCR work in-process, and
running both at once would process each job twice. Splitting them cleanly is
tracked as a known divergence from the original design (see
[CONCEPTION_DIVERGENCES.md](./CONCEPTION_DIVERGENCES.md)).

## Monitoring (next step)

Monitoring is not wired up yet. The plan is error tracking with Sentry, uptime
checks with Uptime Robot, and the BullMQ dashboard for the queue, all on their
free tiers. This lands with the validation and deployment phase.
