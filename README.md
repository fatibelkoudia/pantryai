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

For the API you need at least:

- `DATABASE_TRANSACTION_POOLER_URL` and `DATABASE_DIRECT_URL` for Postgres
- `JWT_SECRET` and `JWT_REFRESH_SECRET` (generate them with `openssl rand -base64 48`)
- `MISTRAL_API_KEY` for OCR
- the `R2_*` values for receipt image storage
- `REDIS_HOST` and `REDIS_PORT` (the defaults match the local containers)

The API checks all of these on boot and refuses to start if one is missing, so
you find out straight away instead of at the first request.

### 4. Run the database migrations

```bash
pnpm --filter @pantryai/api exec prisma migrate deploy
```

If you are starting from a fresh local database, this creates every table.

### 5. Start the apps

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

- [docs/api.md](docs/api.md) is the API reference.
- [docs/user-guide.md](docs/user-guide.md) is the guide for people using the app.
- [docs/cicd.md](docs/cicd.md) explains the CI and deploy pipelines.
- [docs/deployment.md](docs/deployment.md) explains how it gets to production.
- [docs/update-guide.md](docs/update-guide.md) covers upgrades and maintenance.
- [CHANGELOG.md](CHANGELOG.md) is the version history.
