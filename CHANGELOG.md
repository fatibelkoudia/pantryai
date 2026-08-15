# Changelog

All notable changes to PantryAI are recorded here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Nothing yet.

## [1.0.2] - 2026-08-16

A second maintenance release. It closes the gaps the 1.0.1 work turned up: a blind spot
in the error reporting, a deploy job for infrastructure we decided not to build, and a
few places where the docs described something other than what the repo does.

### Added

- The OCR worker reports failures to Sentry. BullMQ swallows whatever the processor
  throws, so until now a failed job only showed up in the queue counters. It reports on
  a job's last attempt, and skips the failures we raise on purpose for bad input (dead
  URL, oversized file, host resolving somewhere private) so they do not bury the real
  faults.

### Changed

- The acceptance test book now checks that a partial stock update leaves the fields it
  did not send alone. `CR-STOCK-07` only changed the quantity and only checked the
  quantity, so it would have passed while the location was being silently reset.
- The keep-alive setup guide says to use the transaction pooler connection string. The
  direct Supabase host only resolves over IPv6 and GitHub runners have none, which is
  what made the first manual run fail. The page also stopped carrying its own copy of
  the workflow YAML, which had already drifted from the real file.
- The CI/CD and deployment guides no longer claim the `web` deploy job is in use. Its
  three Vercel secrets are not set, so it has never run; the web app is deployed by
  running the `vercel` commands locally.

### Removed

- The `api` job in `deploy.yml`, which deployed over SSH to a self-managed VPS. That
  route was considered and dropped, Railway stays the production platform, and the job
  had never run against anything. Its health check polled `/api/docs` rather than
  `/health`, and Swagger answers even when the database is unreachable, so it would have
  judged a broken deploy healthy. The `web` job stays.
- The temporary `GET /health/sentry-test` endpoint added in 1.0.1, now that it has done
  its job.

### Fixed

- The bug report and improvement issue forms no longer link to two documents that were
  never committed, so anyone opening an issue no longer lands on a dead link.

### Note

- The 1.0.0 entry said the review screen lets you "fix anything the OCR got wrong". That
  is not accurate: quantity, unit and expiration date can be edited, but the product
  name cannot, and the name is what the OCR gets wrong most often. Being able to fix it
  is tracked as an improvement.

## [1.0.1] - 2026-08-14

A maintenance release, no new features. It is about keeping the app running, keeping
the dependencies current, and making our bug process something that exists in the repo
instead of only on paper.

### Added

- Automated dependency updates with Dependabot, scanning every package in the
  monorepo plus the GitHub Actions used in CI, weekly on Mondays. Patch and minor
  bumps are grouped into one pull request per package. Majors are left out of the
  group on purpose, so each one gets its own review.
- A dependency audit step in CI (`pnpm audit --prod --audit-level=high`), non-blocking
  for now because the current findings sit in transitive dev tooling with no fix
  published upstream.
- Supabase keep-alive workflow. The free plan pauses a project after 7 days without
  activity, and while it is paused every database query fails. A scheduled job now
  runs `select 1` every 3 days to prevent it. The workflow had been documented since
  June but was never committed, so the protection existed only on paper.
- Bug report and improvement issue templates, plus a pull request template. The bug
  template is a GitHub issue form with required fields, so an issue cannot be opened
  without enough information to reproduce the problem.
- Anomalies are now tracked as GitHub issues. The acceptance test book had linked to a
  bug correction plan since July that was never written; it now points at the issue
  form instead, which is where bugs actually go.
- A temporary `GET /health/sentry-test` endpoint, used once to check the Sentry
  pipeline works in production and that personal data really is scrubbed. Without
  `SENTRY_TEST_TOKEN` set it behaves like any unknown route. Removed again in 1.0.2.

### Changed

- The monitoring guide now says what we watch and what we do not, what each probe
  actually checks, the thresholds, who gets an email when something breaks, which
  probes are switched on, and what the setup misses.
- The update guide, the CI/CD guide and the deployment guide now describe how deploys
  really happen. All three said that pushing a `v1.2.3` tag ships a release. It does
  not: the API redeploys on every push to `master` through Railway, the web app is
  deployed from a manually triggered workflow, and the tag is a version marker.
- Dropped the self-managed VPS plan. Railway stays the production platform, so the docs
  no longer talk about a server migration, Nginx or an SSH deploy. The rollback they
  describe is the one we actually have: bringing back a previous deployment from the
  Railway console. The dead `api` job in `deploy.yml` is still there, to be removed.

### Fixed

- The Supabase project no longer pauses itself after a week of quiet, which took the
  whole API down with it (`DriverAdapterError: (ENOTFOUND) tenant/user ... not found`
  on every request). Recorded as ANO-02.

## [1.0.0] - 2026-07-24

The MVP release: the app runs end to end in production, from creating an account
to scanning a receipt to cooking something before it goes off.

### Added

- Continuous integration workflow: lint, type-check, unit tests, and a build on
  every push, plus the integration tests on pull requests with real Postgres and
  Redis service containers.
- Multi-stage Dockerfile for the API on `node:22-alpine`, with a worker start mode
  (`node dist/worker`), a `.dockerignore`, and a production Docker Compose file.
- Production deployment on Railway (EU West, Amsterdam): every push to `master`
  builds the Dockerfile and redeploys the API, with managed Redis alongside it.
  The web app is built and deployed to Vercel on an explicit trigger.
- Deploy workflow for the eventual Hetzner VPS target: web to Vercel, API over
  SSH, with migrations and an automatic rollback if the API does not come up. It
  is written and manually triggered only, Railway is what actually serves the app
  today.
- `GET /health` readiness endpoint that pings Postgres and Redis, used by the
  Docker healthcheck and Uptime Robot.
- Error monitoring with Sentry, off unless `SENTRY_DSN` is set, scrubbing personal
  data before sending.
- BullMQ queue dashboard at `/admin/queues`, behind basic auth and only mounted
  when credentials are set.
- Interactive Learning Path: quiz lessons with a tip to read first, XP and level
  titles, a daily streak, and weekly challenges. This replaces the static
  conservation tips from 0.1.0.
- Profile screen with profile editing, per-user settings (low-stock threshold,
  recipe ingredient match, the "expiring soon" window), and Trashy avatars.
- French and English translations across every screen on web and mobile, wired to
  a shared catalogue with no hardcoded strings left.
- Redesigned login and register screens, and a first-run onboarding flow for new
  accounts, tracked with `onboardingCompletedAt`.
- Recipe detail screen on mobile, reached from redesigned recipe cards.
- Receipt file import on mobile: pick an existing image or PDF instead of taking a
  photo.
- Receipt review before confirming: edit the parsed items, set an expiration date
  with a date picker, and fix anything the OCR got wrong before it reaches your
  stock.
- Shopping list rework: duplicate checking, "complete your meals" cards,
  generating from stock alone, and a button to add an item by hand.
- Redesigned home, inventory, learn and mood screens on mobile, with the Trashy
  mascot as PNG artwork and safe-area insets respected throughout.
- `typecheck` scripts across the packages and a matching Turborepo task.
- Coverage reporting in CI, published as a build artifact for both the unit run
  and the full suite.
- Acceptance test book (`docs/cahier-de-recettes.md`): numbered scenarios covering
  every Must and Should feature, the performance KPIs (OCR p95 ≤ 5s, add a product
  ≤ 10s), and the RGPD checks, with a results matrix.
- Documentation: README, API reference, deployment guide, user guide, update
  guide, and a monitoring guide with a go-live runbook.
- EAS build configuration for Android internal distribution, and an `.nvmrc`
  pinning Node 22.

### Changed

- The OCR worker can run as its own production container. The API container sets
  `RUN_OCR_WORKER=false` and only enqueues jobs; the worker container consumes the
  queue and runs the scheduled jobs. A single-process run still works by leaving
  the flag unset, which is how it runs on Railway today.

### Fixed

- Partial stock updates no longer reset an item's location. `CreateStockItemDto`
  had a default initializer on `location`, which `UpdateStockItemDto` inherited
  through `PartialType`, so `class-transformer` always set the field even when the
  request did not mention it. The default now lives in `StockService.create`.
- A trailing slash on `API_BASE_URL` no longer produces a double slash and a 404
  on every request. The client normalizes the base URL, so the environment
  variable is allowed to end with a slash.
- Managed Redis now connects: the client passes a password and uses dual-stack
  lookup, since the private host resolves over IPv6.
- Railway builds the API from the Dockerfile instead of guessing, so
  `@pantryai/shared` is built before the API that imports it.
- The shared package exposes a CommonJS-resolvable export, so the compiled API can
  load it in production (`node dist/main`).
- The learning tips JSON is bundled into the API build, so conservation tips work
  in the production image.
- Local `docker compose` host ports are configurable, so a Postgres or Redis
  already running on the machine does not block the dev services.

## 0.1.0 - 2026-06-26

The first working version of PantryAI: the full must-have and should-have feature
set, the Trashy brand layer, security hardening, and the test suite.

### Added

- Monorepo with pnpm and Turborepo: web, mobile, API, and a shared package.
- JWT authentication (register, login, refresh) with rate limiting, and account
  deletion.
- Product and stock management, with Open Food Facts lookups (cached) and a
  manual-entry fallback for products that are not in any catalogue.
- Barcode scanning on mobile.
- Asynchronous receipt OCR through a BullMQ queue: Mistral OCR with a Tesseract
  fallback, a native-PDF text-layer fast path, and six retailer parsers
  (Carrefour, Leclerc, Lidl, Auchan, Grand Frais, and a generic fallback).
- QR e-ticket import.
- Expiration push notifications with a daily scheduled job.
- Recipe suggestions scored against your stock, backed by TheMealDB with a local
  fallback.
- An auto-generated shopping list from low or expiring stock and missing recipe
  ingredients.
- Conservation tips (Learning Path), served as static content.
- The Trashy brand layer: design tokens and Nunito typography, the waste-level
  score and mascot mood, an XP and challenges loop, and the five-pillar app
  navigation across web and mobile.
- Web app (Next.js 16, App Router) and mobile app (Expo SDK 55) sharing types,
  the API client, and theme tokens through the shared package.

### Security

- Input validation on every endpoint, Helmet, restricted CORS, and UUID primary
  keys.
- User data isolation enforced in the application layer (every query scoped by
  user), with an opt-in Prisma extension as a second layer.
- RGPD data export (Article 20) and account deletion (Article 17).
- Receipt images deleted from storage within 24 hours, with a daily sweep as a
  backstop. No personal data in logs.

### Tests

- Unit and integration test suites (Vitest and Supertest) with a coverage gate of
  80% on services and 60% overall.

[Unreleased]: https://github.com/fatibelkoudia/pantryai/compare/v1.0.2...HEAD
[1.0.2]: https://github.com/fatibelkoudia/pantryai/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/fatibelkoudia/pantryai/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/fatibelkoudia/pantryai/releases/tag/v1.0.0
