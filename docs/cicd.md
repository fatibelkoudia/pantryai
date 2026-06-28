# CI/CD guide

This explains the automated pipelines: what runs when you push code, and what
runs when you cut a release. The two pieces are continuous integration (checks on
every change) and continuous delivery (shipping a tagged version to production).

There are two workflow files, both under `.github/workflows`:

- `ci.yml` runs the checks.
- `deploy.yml` ships a release.

## Continuous integration (`ci.yml`)

CI runs on every push to any branch and on every pull request. The idea is simple:
nothing reaches the main branch unless the checks are green.

It has three jobs.

### 1. quality

Runs on every push and pull request. This is the fast feedback loop:

1. install dependencies with pnpm (using a frozen lockfile so the install matches
   what is committed),
2. build the shared package first, because the API and the web app type-check
   against it,
3. lint everything,
4. type-check everything (`tsc --noEmit` across the packages),
5. run the API unit tests.

### 2. integration

Runs on pull requests only, because it needs a real database and is slower than
the unit tests. The job spins up two service containers, the same ones we use
locally:

- Postgres 17 on port 5433,
- Redis 7 on port 6380.

These mirror `docker-compose.test.yml`. The job sets placeholder secrets (JWT
keys, a fake Mistral key, fake R2 values) so the API passes its startup checks
without needing real credentials. The tests stub the real Mistral and R2 calls,
so nothing ever leaves the runner. It then applies the migrations to the test
database and runs the integration suite.

### 3. build

Runs on every push and pull request. It generates the Prisma client and runs the
full `turbo build` (the API, the web app, and the shared package). This is what
catches a build that compiles in dev but breaks in a production build.

## Continuous delivery (`deploy.yml`)

Deploys happen from a Git tag that looks like a version, for example `v1.2.3`.
Pushing that tag is what triggers a release:

```bash
git tag v1.2.3
git push origin v1.2.3
```

The workflow has two jobs that run in parallel.

### web

Builds the Next.js app and deploys it to Vercel using the Vercel CLI.

### api

1. installs dependencies and generates the Prisma client,
2. applies the database migrations against the production database (using the
   direct connection, not the pooler, because migrations need advisory locks),
3. connects to the Hetzner server over SSH and deploys the new container image,
4. checks the API actually came up, and rolls back to the previous image if it
   did not (see below).

### The rollback safety net

If the new API container does not come up, the job puts the previous image back and
fails so we get notified, so a broken release never leaves the API down (risk R6).
The full mechanism is in [deployment.md](./deployment.md#rollback).

## Secrets

The deploy workflow needs a set of GitHub Actions secrets (the Vercel tokens, the
Hetzner SSH details, and `DATABASE_DIRECT_URL` for the migration step). CI does not
need any of them, it uses placeholders. The full list is in
[deployment.md](./deployment.md#secrets-the-workflows-need).

## Running the same checks locally

You can run everything CI runs before you push:

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm --filter @pantryai/api test:unit
```

And the integration tests, with the test containers up:

```bash
docker compose -f docker-compose.test.yml up -d
DATABASE_TEST_URL=postgresql://pantryai:pantryai@localhost:5433/pantryai_test \
  pnpm --filter @pantryai/api test:integration
```

For the deploy side, see [deployment.md](./deployment.md), which covers the server
setup and the container image in more detail.
