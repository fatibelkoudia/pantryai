# Deployment guide

This explains how PantryAI gets to production and what runs where.

## The shape of it

There are four moving parts in production:

- The **web app** runs on Vercel.
- The **API** runs as a Docker container on Railway, in the EU West region
  (Amsterdam). Railway terminates TLS, so there is no reverse proxy to administer.
- The **OCR worker** runs inside the same process as the API today. It can be split
  into its own container by setting `RUN_OCR_WORKER=false` on the API, which is the
  first lever if OCR work ever starts crowding the event loop.
- The **database** is PostgreSQL on Supabase (EU), and **Redis** is a Railway managed
  service that backs the BullMQ queue.

The **mobile app** is not hosted anywhere: it ships as an Android APK built with
EAS and installed straight on the phone. It talks to the same API over HTTPS.
See [the mobile section](#the-mobile-app-android-apk) below.

Receipt images live in Cloudflare R2 and are deleted within 24 hours.

Everything that touches personal data (API, database, OCR) stays under EU
jurisdiction. The region is set explicitly, because Railway defaults to `us-west1`.

```
        Browser / phone
              │  HTTPS
              v
        ┌───────────┐         ┌────────────────────────┐
        │  Vercel   │         │   Railway (EU West)    │
        │  (web)    │──────▶  │                        │
        └───────────┘         │  API :3001 + worker    │
                              │        │               │
                              │   Redis (managed)      │
                              └────────────────────────┘
                                       │
                                       v
                                Supabase (Postgres, EU)
                                Cloudflare R2 (images)
```

## What deploys, and when

Today the two apps deploy from two different places, and a release tag deploys
nothing.

**API: push to `master`.** Railway watches the branch and rebuilds from
`packages/api/Dockerfile` on every push, as configured in `railway.json`. Merging a
pull request into `master` is the production deploy, there is no extra step.

**Web: the `web` job of `deploy.yml`**, run by hand from the Actions tab. It builds
the Next.js app and deploys it to Vercel.

**A `v1.2.3` tag is a version marker.** It records which commit a release points at,
so `CHANGELOG.md` and the repo agree. It does not trigger anything.

So the normal release flow is: green pull request, merge to `master` (the API deploys
itself), run the `web` job if the front end changed, then tag the released commit.

```bash
git tag v1.2.3
git push origin v1.2.3
```

`deploy.yml` also contains an `api` job that deploys over SSH to a self-managed VPS.
That route was considered and dropped: Railway stays the production platform. The job
has never run against anything and should be deleted.

The mobile app is not part of any workflow: we build the APK on demand with
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

| Secret              | Used for                                                    |
| ------------------- | ----------------------------------------------------------- |
| `VERCEL_TOKEN`      | Deploying the web app                                       |
| `VERCEL_ORG_ID`     | The Vercel org                                              |
| `VERCEL_PROJECT_ID` | The Vercel project for the web app                          |
| `SUPABASE_DB_URL`   | The keep-alive workflow, so the free project does not pause |

The API needs no deploy secret: Railway builds from the repo itself. Its runtime
environment variables are set in the Railway dashboard, not here.

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

## Setting up Railway (one time)

1. Create the service in the **EU West (Amsterdam)** region, connected to the repo and
   the `master` branch. The region matters: Railway defaults to `us-west1`, and the
   whole personal-data path has to stay in the EU.
2. Check that `railway.json` forces the Dockerfile builder. Without it, automatic
   detection compiles the API without building `@pantryai/shared` first and the build
   fails.
3. Add the managed Redis service and reference its variables.
4. Set the environment variables (see the table further down). `PORT` is injected by
   Railway and read by `main.ts`, so do not hardcode it.
5. Apply the migrations before the first release, as described in
   [update-guide.md](./update-guide.md#database-migrations).
6. Check `GET /health` answers with `db: "up"` and `redis: "up"`.

Two things that catch people out:

- **Managed Redis** needs a password, and its private host resolves over IPv6. The
  client is configured with `password` and `family: 0` (dual stack) for that reason.
  Without it the connection fails quietly and `/health` reports `redis: "down"`.
- **`NEXT_PUBLIC_*` variables** are inlined at build time. Changing one means
  rebuilding the front end, not restarting it.

After that, every push to `master` redeploys the API on its own.

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

This is the mitigation for risk R6. Two layers protect a release:

**Before traffic switches.** Railway checks `/health` on the new instance. If it does
not come up, the previous version keeps serving and the deploy is marked failed. A
broken build never takes the API down.

**After traffic switches.** If a release is bad in a way a health check cannot see, open
the Railway console, pick the previous deployment and reactivate it. It is reapplied
without rebuilding, so it takes seconds. This has been exercised for real: a deployment
was deliberately failed and the previous version restored from the console.

The one rule that keeps this working: **migrations have to stay backward compatible.**
Rolling back restores the code, it does not undo a migration. Add nullable columns
rather than renaming or dropping, or the rollback becomes impossible at the exact
moment you need it.

## The OCR worker

**Today the API and the OCR worker share one process on Railway.** That is fine at
current volumes, and it is the known scaling limit: a heavy OCR job competes for the
same event loop as HTTP requests. Splitting them is the first lever if that starts to
show, and the code is already prepared for it.

Which process does the background work is decided by one env var, `RUN_OCR_WORKER`:

- Left **unset**, one process does both the HTTP and the OCR work. This is how it runs
  in production today, and how it runs locally.
- Set to **`false`**, the process enqueues OCR jobs but does not consume them, and does
  not run the daily cron jobs. This is what the API would set once split.
- Set to **`true`** on a second service started with `node dist/worker`, that service
  owns the OCR queue processor and the scheduled jobs (R2 sweep, expiration push).

The flag is what stops a queue job, or a daily push, from firing twice once there are
two processes. `packages/api/Dockerfile` already supports both start commands, so the
split is a Railway configuration change rather than a code change.

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

- `GET /health` pings Postgres and Redis. The Railway healthcheck and Uptime Robot
  both use it.
- Sentry is off unless `SENTRY_DSN` is set, and it strips PII before sending.
- The queue dashboard is at `/admin/queues`, behind basic auth, only mounted when
  `BULLBOARD_USER` and `BULLBOARD_PASSWORD` are set.

Note that the last two are not set in production yet, so Sentry collects nothing and
the dashboard is not exposed. Setting them is the first item in
[FUTURE.md](../help/FUTURE.md).

## Go-live runbook

The first production stand-up, in order. After this, every push to `master` redeploys
the API on its own. Run the [pre-flight checks](#pre-flight-checks) before starting.

1. **Database.** Create the Supabase project in an EU region. Note both the pooled and
   the direct connection strings.
2. **Migrate.** Run `pnpm --filter @pantryai/api exec prisma migrate deploy` against
   `DATABASE_DIRECT_URL` (the direct one, not the pooler: migrations need advisory
   locks).
3. **API.** Do the [Railway one-time setup](#setting-up-railway-one-time): service in
   EU West on `master`, Dockerfile builder, managed Redis, environment variables.
4. **Check it.** `curl https://<your-api>/health` returns
   `{"status":"ok","db":"up","redis":"up"}`. Open `/api/docs`.
5. **Keep-alive.** Add the `SUPABASE_DB_URL` repository secret, then run the
   Supabase keep-alive workflow once by hand from the Actions tab and confirm the log
   says `kept alive`. Without this the free project pauses after 7 idle days and takes
   the whole API down.
6. **Web app.** Do the [Vercel one-time setup](#setting-up-vercel-one-time) (link the
   project, root directory, env vars, the three secrets). Set `NEXT_PUBLIC_API_URL`
   and `API_URL` **with no trailing slash**. Then deploy once by hand with the three
   `vercel` commands, or run the `web` job of `deploy.yml`.
7. **Monitoring.** Set `SENTRY_DSN`, `BULLBOARD_USER` and `BULLBOARD_PASSWORD` on
   Railway, add the Uptime Robot monitor on `/health` with an alert contact, and
   confirm Sentry receives a test error with no personal data. See
   [monitoring.md](./monitoring.md).
8. **Mobile app.** Do the [EAS one-time setup](#one-time-setup), point
   `EXPO_PUBLIC_API_URL` in `packages/mobile/eas.json` at your API domain, then build
   and install the APK as described in
   [the mobile section](#the-mobile-app-android-apk).

Acceptance for the deployment phase: the site is reachable over HTTPS, `/health` is
green, the keep-alive has run at least once, the three monitors are live, and the APK
installs and logs in against the production API.
