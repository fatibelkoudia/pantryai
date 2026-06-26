# Changelog

All notable changes to PantryAI are recorded here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Continuous integration workflow: lint, type-check, unit tests, and a build on
  every push, plus the integration tests on pull requests with real Postgres and
  Redis service containers.
- Multi-stage Dockerfile for the API on `node:22-alpine`, with a worker start
  mode (`node dist/worker`), a `.dockerignore`, and a production Docker Compose
  file (API, Redis, Nginx, and an optional worker).
- Nginx reverse-proxy config that terminates SSL and forwards to the API.
- Deploy workflow triggered by version tags: web to Vercel, API to Hetzner over
  SSH, with database migrations and an automatic rollback if the API does not come
  up.
- Documentation: README, API reference, deployment guide, user guide, and update
  guide.
- `typecheck` scripts across the packages and a matching Turborepo task.

### Fixed

- The shared package now exposes a CommonJS-resolvable export, so the compiled API
  can load it in production (`node dist/main`).
- The learning tips JSON is now bundled into the API build, so conservation tips
  work in the production image.

## [0.1.0] - 2026-06-26

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

[Unreleased]: https://example.com/pantryai/compare/v0.1.0...HEAD
[0.1.0]: https://example.com/pantryai/releases/tag/v0.1.0
