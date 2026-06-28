# PantryAI docs

This folder has the project docs. The root [README](../README.md) is the place to
start if you just cloned the repo and want to run it. The files here go deeper on
specific topics. They are grouped by what you are trying to do.

## Setting up the outside services

How to create the accounts the app talks to and where each key goes.

- [mistral-setup.md](./mistral-setup.md) - the Mistral OCR key
- [r2-setup.md](./r2-setup.md) - the Cloudflare R2 bucket for receipt images
- [supabase-keepalive.md](./supabase-keepalive.md) - stop the free Supabase project from pausing

## How the app is built (and why)

The "why is it like this" notes, so we remember our reasons later.

- [architecture/](./architecture/) - one file per topic: the monorepo, the async OCR
  pipeline, the receipt parsers, the Prisma setup, the shared types, the API
  conventions, privacy/RGPD, and the waste score plus gamification
- [AUTHENTICATION.md](./AUTHENTICATION.md) - how our JWT login works
- [CONCEPTION_DIVERGENCES.md](./CONCEPTION_DIVERGENCES.md) - where the code ended up
  different from the conception dossier, and why

## Using the app

- [user-guide.md](./user-guide.md) - the guide for people using PantryAI
- [api.md](./api.md) - a written summary of the API (the live Swagger page at
  `/api/docs` is the source of truth)

## Running it in production

- [deployment.md](./deployment.md) - how it gets to production and the go-live runbook
- [cicd.md](./cicd.md) - what the GitHub Actions pipelines do
- [monitoring.md](./monitoring.md) - Sentry, Uptime Robot, and the queue dashboard
- [update-guide.md](./update-guide.md) - releasing a new version, updating
  dependencies, and routine maintenance

## Deliverables

- [cahier-de-recettes.md](./cahier-de-recettes.md) - the acceptance test book
