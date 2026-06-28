# Update and maintenance guide

This is for whoever keeps PantryAI running: how to ship a new version, how to
update dependencies, and what to keep an eye on. If you are deploying for the
first time, read [deployment.md](./deployment.md) first.

## Releasing a new version

1. Get your changes merged and make sure CI is green.
2. Update [CHANGELOG.md](../CHANGELOG.md): move things out of "Unreleased" into a
   new version section with today's date.
3. Tag and push:

   ```bash
   git tag v1.3.0
   git push origin v1.3.0
   ```

That tag triggers the deploy workflow, which ships the web app to Vercel and the
API to the server, runs the migrations first, and rolls back automatically if the
API does not come up.

We follow semantic versioning: bump the patch number for fixes, the minor number
for new features, and the major number for breaking changes.

## Database migrations

The schema is managed by Prisma. To change it:

1. Edit `packages/api/prisma/schema.prisma`.
2. Create a migration:

   ```bash
   pnpm --filter @pantryai/api exec prisma migrate dev --name describe_your_change
   ```

3. Commit the new folder under `packages/api/prisma/migrations`.

In production the deploy workflow applies migrations with `prisma migrate deploy`
against the direct database connection (not the pooler, because migrations need
advisory locks). Write migrations so the currently running code still works
against the new schema: add first, remove later.

## Updating dependencies

Update inside a single package with pnpm, for example:

```bash
pnpm --filter @pantryai/api update
```

After any update, run the full set of checks before committing:

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm --filter @pantryai/api test:all
```

A few things to be careful about:

- The API generates a Rust-free Prisma client into `packages/api/src/generated`.
  After bumping Prisma, run `pnpm --filter @pantryai/api exec prisma generate` and
  commit the regenerated client.
- The shared package is built before the others type-check against it, so if you
  change shared, build it (`pnpm --filter @pantryai/shared build`) before running
  type-check elsewhere.
- Native dependencies (like bcrypt) are compiled in the Docker build. If a bump
  breaks the image build, that is usually where it shows up.

## Versions we run, and why they differ from the original plan

The original design document named some older versions. We moved to newer ones as
we built, and we read native PDF receipts with a different library. None of this
changes how the app behaves, but it is worth knowing when you upgrade. The full
list lives in [CONCEPTION_DIVERGENCES.md](./CONCEPTION_DIVERGENCES.md). The short
version:

- Next.js 16 (the plan said 14)
- Expo SDK 55 (the plan said 51)
- Node.js 22 (the plan said 20)
- PostgreSQL 17 (the plan said 15)
- We read PDF text with `unpdf` instead of `pdf-parse`. Same two-tier idea (free
  text extraction first, OCR only for image-only PDFs), different library, because
  `unpdf` is pure JavaScript and fits our setup.

## Routine maintenance

- **Keep the database awake.** The free Supabase tier pauses a project that sees
  no traffic for a while. See [supabase-keepalive.md](./supabase-keepalive.md).
- **Receipt images clean themselves up.** A daily job deletes anything in storage
  older than 24 hours, on top of the delete that happens right after each scan.
  You do not need to do anything, but if storage ever fills up, that job is the
  first place to look.
- **Renew the SSL certificate.** Certbot renews on its own, but check it now and
  then. The Nginx container reads the certificate from the host, so a renewal
  takes effect after Nginx reloads.
- **Watch the monitors.** `GET /health` should return `status: "ok"`. Uptime Robot
  tracks availability, Sentry collects errors, and the queue dashboard at
  `/admin/queues` shows the OCR jobs. See [monitoring.md](./monitoring.md).

## The two API containers

In production the same image runs as two containers, the `api` and the `worker`,
told apart by `RUN_OCR_WORKER`. After a deploy, check both came up:

```bash
docker compose -f docker-compose.prod.yml ps
```

Why it is split and how the flag works is in
[deployment.md](./deployment.md#the-ocr-worker).

## When a deploy goes wrong

The deploy rolls back on its own if the API fails to start; the manual rollback
steps are in [deployment.md](./deployment.md#rollback).

If a migration is the problem, fix it forward with a new migration rather than
editing one that already ran. Editing an applied migration puts the database and
the migration history out of sync.
