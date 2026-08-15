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

## Continuous delivery

Two things ship the app, and the tag is neither of them.

**The API redeploys on every push to `master`.** Railway watches the branch, builds
`packages/api/Dockerfile` (that is what `railway.json` tells it to do) and swaps the
container. Merging a pull request into `master` is the deploy, there is no extra step.

**The web app goes to Vercel** from the `web` job of `deploy.yml`, triggered by hand.

A `v1.x.x` Git tag is just a marker. It records which commit a release points at, so the
changelog and the repo agree. It does not trigger anything.

### How the API deploy works

Railway does the work. On each push to `master`:

1. builds the image from `packages/api/Dockerfile`, as `railway.json` tells it to. If
   the build fails, the previous version keeps serving.
2. starts `node dist/main`.
3. checks `/health` before routing traffic to the new instance.
4. switches traffic over.

Migrations are **not** run at container start, on purpose. A restart would replay them,
and keeping them separate means a schema problem does not look like an app problem.
Apply them before merging, see [update-guide.md](./update-guide.md#database-migrations).

### The rollback

The Railway console can bring back a previous deployment without rebuilding it. This
only works if migrations stay backward compatible, so add nullable columns rather than
renaming or dropping. Rolling back restores the code but does not undo a migration, and
if the old code cannot run on the current schema you are stuck at the worst moment.

### `deploy.yml`

Only the `web` job is used, and it is triggered by hand from the Actions tab. It builds
the Next.js app and deploys it to Vercel through the Vercel CLI.

The file also has an `api` job that deploys over SSH to a self-managed VPS. It is dead
code: we looked at that route and dropped it, Railway stays the production platform, and
the job has never run against anything. It should be deleted, see
[FUTURE.md](../help/FUTURE.md).

## Secrets

The `web` deploy job needs `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`. The
keep-alive workflow needs `SUPABASE_DB_URL`. CI needs none of them, it uses
placeholders. The full list is in
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
