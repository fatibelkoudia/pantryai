# PantryAI

PantryAI helps you keep track of the food you have at home and waste less of it.
You scan a receipt or a barcode, the app builds your pantry, warns you before
things expire, suggests recipes from what you already own, and turns the whole
thing into a small game with a mascot called Trashy.

This is a monorepo with a web app, a mobile app, a backend API, and a shared
package they all reuse.

## What's inside

| Package           | What it is                                                       | Stack                                                     |
| ----------------- | ---------------------------------------------------------------- | --------------------------------------------------------- |
| `packages/api`    | The backend API and the OCR pipeline                             | NestJS 11 (Fastify), Prisma 7, PostgreSQL, BullMQ + Redis |
| `packages/web`    | The web app                                                      | Next.js 16 (App Router), TypeScript, Tailwind CSS         |
| `packages/mobile` | The mobile app                                                   | Expo SDK 55, React Native, Expo Router                    |
| `packages/shared` | Types, the API client, and the design tokens shared by all three | TypeScript                                                |

A few things worth knowing about the stack:

- The database is PostgreSQL hosted on Supabase. We only use Supabase as the
  database, not its auth or storage. Auth is our own JWT, and receipt images go
  to Cloudflare R2.
- OCR runs through Mistral OCR first (the data stays in the EU), with a local
  Tesseract.js fallback. Native PDF receipts are read straight from their text
  layer, so they cost nothing.
- All of the third-party pieces we lean on have a free tier: Supabase, Cloudflare
  R2, TheMealDB, Open Food Facts, and the Expo push service.

## Architecture overview

```
        Web (Next.js)            Mobile (Expo)
              \                      /
               \                    /
                v                  v
            ┌─────────────────────────┐
            │   API (NestJS, :3001)    │
            │  auth, stock, products,  │
            │  recipes, shopping,      │
            │  learning, waste, XP     │
            └─────────────────────────┘
              │          │          │
              v          v          v
         PostgreSQL    Redis     Cloudflare R2
         (Supabase)   (BullMQ)   (receipt images)
                         │
                         v
                  OCR worker job
              (Mistral OCR / Tesseract)
                         │
                         v
                   Mistral OCR API
```

Receipt scanning is asynchronous. The upload returns a job id right away, the
work happens on the BullMQ queue, and the image is deleted from R2 within 24
hours. For the moment the worker runs inside the API process. The queue is
already there, so we can move it into its own container later without changing
the code.

The web and mobile apps never define their own types for API data. They import
everything from `@pantryai/shared`, which also holds the API client and the
Trashy design tokens.

## Getting set up

### What you need

- Node.js 22 or newer
- pnpm 10 or newer (`corepack enable` will pin the right version)
- Docker or Podman, to run Postgres and Redis locally

### External services

Three managed services, all on free tiers. The database is required to run anything;
Mistral and R2 are only needed for the receipt scanning flow. Each one fills in some of the
env vars listed further down.

**Supabase (Postgres)**

1. Create an account at https://supabase.com and a new project. Pick an EU region and set a
   database password (keep it, you need it in the connection strings).
2. Once it is provisioned, open Project Settings → Database → Connection string.
3. Copy the transaction pooler string (port 6543, has `pgbouncer=true`) into
   `DATABASE_TRANSACTION_POOLER_URL`, and the direct connection string (port 5432) into
   `DATABASE_DIRECT_URL`. Replace the `[YOUR-PASSWORD]` placeholder in each with the
   password from step 1.

Free projects pause after 7 days idle; [docs/supabase-keepalive.md](docs/supabase-keepalive.md)
covers keeping one awake.

**Mistral (OCR)**

1. Sign in at https://console.mistral.ai. The free default workspace is enough.
2. Create an API key and put it in `MISTRAL_API_KEY`.

Full walkthrough: [docs/mistral-setup.md](docs/mistral-setup.md).

**Cloudflare R2 (receipt images)**

1. In the Cloudflare dashboard, enable R2 and create a bucket named `pantryai`. Choose
   Specify jurisdiction → European Union (EU). This cannot be changed later, so if you miss
   it you have to delete the bucket and remake it.
2. Create an R2 API token with Object Read & Write on that bucket.
3. Fill `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` from the token, and
   `R2_ENDPOINT` from the account id. The EU endpoint has `.eu` in the host:
   `https://<account-id>.eu.r2.cloudflarestorage.com`.

Full walkthrough: [docs/r2-setup.md](docs/r2-setup.md).

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start Postgres and Redis

The local database and Redis run in containers:

```bash
docker compose up -d
# or, if you use Podman:
pnpm docker:up
```

This gives you Postgres on port 5432 and Redis on port 6379.

### 3. Set up the environment files

Each package has a `.env.example`. Copy them and fill in the blanks:

```bash
cp .env.example .env
cp packages/api/.env.example packages/api/.env
cp packages/web/.env.example packages/web/.env
cp packages/mobile/.env.example packages/mobile/.env
```

**`packages/api/.env`** is where most of it lives. Required (the API validates these on
boot and refuses to start if one is missing):

| Variable                          | What it is                                                         |
| --------------------------------- | ------------------------------------------------------------------ |
| `DATABASE_TRANSACTION_POOLER_URL` | Supabase transaction pooler (port 6543), used at runtime           |
| `DATABASE_DIRECT_URL`             | Supabase direct connection (port 5432), used for migrations        |
| `JWT_SECRET`                      | access-token signing secret, `openssl rand -base64 48`             |
| `JWT_REFRESH_SECRET`              | refresh-token signing secret, a second `openssl rand -base64 48`   |
| `MISTRAL_API_KEY`                 | Mistral key for OCR                                                |
| `R2_ENDPOINT`                     | R2 EU endpoint, `https://<account-id>.eu.r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY_ID`                | R2 API token                                                       |
| `R2_SECRET_ACCESS_KEY`            | R2 API token                                                       |
| `R2_BUCKET_NAME`                  | the bucket you made (`pantryai`)                                   |
| `REDIS_HOST`                      | `localhost` for the local container                                |
| `REDIS_PORT`                      | `6379` for the local container                                     |

Optional (safe to leave empty):

| Variable                                | What it does                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `PORT`                                  | API port, defaults to 3001                                                                             |
| `CORS_ORIGINS`                          | comma-separated allowed origins, defaults to `http://localhost:3000`                                   |
| `SENTRY_DSN`                            | sends errors to Sentry. Empty means nothing is sent                                                    |
| `RUN_OCR_WORKER`                        | leave unset for one process that runs the OCR queue itself; the split prod setup sets it per container |
| `BULLBOARD_USER` / `BULLBOARD_PASSWORD` | set both to mount the BullMQ dashboard at `/admin/queues` behind basic auth                            |

**`packages/web/.env`** needs `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3001`).

**`packages/mobile/.env`** needs `EXPO_PUBLIC_API_URL`. On a real phone `localhost` points at
the phone, so set it to your machine's LAN IP, e.g. `http://192.168.1.42:3001`.

For local dev without the OCR accounts you can put placeholder values in `MISTRAL_API_KEY`
and the `R2_*` vars so the API boots; everything works except the receipt upload and OCR.

### 4. Run the database migrations

```bash
pnpm --filter @pantryai/api exec prisma migrate deploy
```

If you are starting from a fresh local database, this creates every table.

### 5. (Optional) Seed a demo account

```bash
pnpm --filter @pantryai/api seed
```

This creates a demo user (`demo@pantryai.test` / `Demo1234!`) with a ready-made pantry so
you can log in and look around without scanning anything first. It is safe to re-run and
only ever touches the demo account.

### 6. Start the apps

```bash
pnpm dev
```

That runs everything through Turborepo. You can also run one package at a time:

```bash
pnpm --filter @pantryai/api dev     # API on http://localhost:3001
pnpm --filter @pantryai/web dev     # web on http://localhost:3000
pnpm --filter @pantryai/mobile start  # Expo dev server
```

The API's interactive docs (Swagger) are at http://localhost:3001/api/docs.

## Handy scripts

All of these run from the repo root and fan out across the packages with Turborepo:

```bash
pnpm lint        # eslint everywhere
pnpm typecheck   # tsc --noEmit everywhere
pnpm build       # build all packages
pnpm test        # run the test suites
pnpm format      # prettier
```

API-specific test commands:

```bash
pnpm --filter @pantryai/api test:unit         # fast unit tests
pnpm --filter @pantryai/api test:integration  # needs the test DB (see below)
pnpm --filter @pantryai/api test:coverage     # coverage with the gate enforced
```

The integration tests use a throwaway Postgres on port 5433 and Redis on 6380:

```bash
docker compose -f docker-compose.test.yml up -d
DATABASE_TEST_URL=postgresql://pantryai:pantryai@localhost:5433/pantryai_test \
  pnpm --filter @pantryai/api test:integration
```

## Documentation

[docs/](docs/README.md) has everything, grouped by what you are doing: setting up the
outside services, how the app is built and why, using the app, running it in
production, and the certification deliverables. A few starting points:

- [docs/api.md](docs/api.md) is the API reference.
- [docs/user-guide.md](docs/user-guide.md) is the guide for people using the app.
- [docs/deployment.md](docs/deployment.md) explains how it gets to production.
- [CHANGELOG.md](CHANGELOG.md) is the version history.
