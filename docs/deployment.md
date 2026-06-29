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

The **mobile app** is not hosted anywhere: it ships as an Android APK built with
EAS and installed straight on the phone. It talks to the same API over HTTPS.
See [the mobile section](#the-mobile-app-android-apk) below.

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

The mobile app is not part of the tag workflow: we build the APK on demand with
EAS whenever we want to hand out a new build (see the mobile section below).

Continuous integration (`.github/workflows/ci.yml`) runs on every push and pull
request before any of this: lint, type-check, unit tests, a build, and the
integration tests on pull requests. A release should only happen from a green
branch.

## Pre-flight checks

Before tagging a release, run these locally from the repo root. Every one of
them has to pass, in this order:

```bash
pnpm lint                    # no lint errors
pnpm test                    # all unit tests green
pnpm build                   # web, api and shared all compile
git status                   # working tree clean, everything committed
pnpm prisma:migrate:status   # "Database schema is up to date!"
podman build -f packages/api/Dockerfile -t pantryai-api .   # image builds
```

(Use `docker build` instead of `podman build` if that is what the machine has.)

Two things that bite easily: check that any new env var the code reads was also
added to `packages/api/.env.example` and to the `.env` on the server, and check
that new Prisma migrations are committed under `packages/api/prisma/migrations/`.

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

## Setting up Vercel (one time)

The web app deploys to Vercel's free Hobby tier, which is plenty here.

1. Create a Vercel account and log in from the CLI: `pnpm dlx vercel login`.
2. Link the repo to a new Vercel project, from the repo root:

   ```bash
   pnpm dlx vercel link
   ```

3. In the Vercel dashboard, open the project settings and set the **Root
   Directory** to `packages/web`. Vercel detects Next.js and pnpm on its own,
   the monorepo just needs to be pointed at the right package.
4. Still in the project settings, add the production environment variables:
   - `NEXT_PUBLIC_API_URL`: the public API URL, for example
     `https://api.pantryai.app` (the browser calls this).
   - `API_URL`: same value (the server-side session route calls this one).
5. Grab the three values the deploy workflow needs:
   - `VERCEL_TOKEN`: create one under Account Settings, then Tokens.
   - `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`: both are in `.vercel/project.json`
     after the `vercel link` (that folder is gitignored, do not commit it).
6. Put those three in the GitHub Actions secrets (table above).

To deploy the web app by hand once, without waiting for a tag:

```bash
pnpm dlx vercel pull --yes --environment=production
pnpm dlx vercel build --prod
pnpm dlx vercel deploy --prebuilt --prod
```

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

## The mobile app (Android APK)

The mobile app does not go through the tag workflow. We build an APK with
[EAS Build](https://docs.expo.dev/build/introduction/) whenever we want one, and
install it directly on the phone. No Play Store account needed for that.

One thing to understand first: the app reads `EXPO_PUBLIC_API_URL` at **build
time**, not at runtime. Expo inlines the value into the JS bundle, so an APK is
permanently wired to whatever URL it was built with. The build profiles in
`packages/mobile/eas.json` set it:

- `preview` builds an installable **APK** pointed at the production API.
- `production` builds an **AAB** (the format the Play Store wants), also pointed
  at production.
- `development` builds a dev client for local work.

Before building, open `packages/mobile/eas.json` and make sure the
`EXPO_PUBLIC_API_URL` in the `preview` and `production` profiles matches your
real API domain.

### One-time setup

1. Create an [Expo account](https://expo.dev) (the free tier is enough, it
   includes a monthly quota of cloud builds).
2. From `packages/mobile`, log in and register the project:

   ```bash
   cd packages/mobile
   pnpm dlx eas-cli login
   pnpm dlx eas-cli init
   ```

   `eas init` writes the project id into `app.json` (under `extra.eas`), commit
   that change.

3. The first Android build asks whether EAS should generate and manage the
   signing keystore. Say yes and never think about keystores again. EAS keeps
   it, so every later build is signed with the same key and installs as an
   update instead of a conflict.

### Building the APK

From `packages/mobile`:

```bash
pnpm dlx eas-cli build --platform android --profile preview
```

That uploads the project, builds it on Expo's servers (a few minutes of queue on
the free tier, then the build itself), and prints a link. Open the link, download
the APK, done. The same link shows a QR code, so the easiest install is to open
it on the phone and download the APK there directly.

### Installing it on a phone

- Straight on the phone: open the build link, download, tap the APK. Android
  asks to allow installs from the browser the first time, accept it.
- Or over USB with adb: `adb install app-release.apk`.

### If you want to build without the EAS cloud

Possible, but it needs a local Android toolchain (JDK 17 and the Android SDK,
which we do not have installed in WSL right now). Two options:

- `pnpm dlx eas-cli build --platform android --profile preview --local` runs the
  exact same build on your machine instead of Expo's servers. No quota, same
  output.
- Or fully by hand: `pnpm dlx expo prebuild --platform android` generates the
  `android/` folder, then `cd android && ./gradlew assembleRelease` drops the APK
  in `android/app/build/outputs/apk/release/`. Watch out: without a configured
  keystore this signs with a debug key, which is fine for your own phone but not
  for anything you hand out.

### Play Store, later

When the app should reach the Play Store: the `production` profile already
builds the AAB, and `eas submit --platform android` uploads it. That needs a
Google Play Console account (one-time 25 USD fee), so it stays out of scope
until we actually want it.

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
Git tags. Run the [pre-flight checks](#pre-flight-checks) before starting, and
have the [GitHub Actions secrets](#secrets-the-workflows-need) ready as you go:
the deploy workflow needs all seven of them set before the first tag push.

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
9. **Web app.** Do the [Vercel one-time setup](#setting-up-vercel-one-time)
   (link the project, root directory, env vars, the three secrets). Then deploy
   once by hand with the three `vercel` commands from that section, or push the
   first tag and let the workflow do it.
10. **Monitoring.** Add the Uptime Robot monitor on `/health`, and confirm Sentry
    receives a test error with no personal data. See
    [monitoring.md](./monitoring.md).
11. **Mobile app.** Do the [EAS one-time setup](#one-time-setup), point the
    `EXPO_PUBLIC_API_URL` in `packages/mobile/eas.json` at your API domain, then
    build and install the APK as described in
    [the mobile section](#the-mobile-app-android-apk).

Acceptance for the deployment phase: the site is reachable over HTTPS, `/health`
is green, the three monitors are live, and the APK installs and logs in against
the production API.
