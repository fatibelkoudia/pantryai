# Architecture notes

Last updated: 2026-06-26

These are our notes on how PantryAI is put together and why we made the calls we
made. The other docs in `docs/` are more "how to set this thing up" guides
(Mistral, R2, deploying). These ones are more "why is it built like this", so when
we come back in a few months we remember what we were thinking.

We wrote one file per topic instead of one giant file, so each one stays short.

- [monorepo.md](./monorepo.md) - why everything lives in one repo with pnpm and Turborepo
- [async-ocr-pipeline.md](./async-ocr-pipeline.md) - why scanning a receipt runs on a queue instead of in the request
- [receipt-parsers.md](./receipt-parsers.md) - how we turn receipt text into a list of products
- [data-privacy.md](./data-privacy.md) - the RGPD decisions (ephemeral images, export, delete account)
- [prisma-setup.md](./prisma-setup.md) - why Prisma 7 is set up the slightly unusual way it is
- [api-conventions.md](./api-conventions.md) - the response shape, error handling, and env checks shared by every route
- [shared-types.md](./shared-types.md) - the `shared` package and why web, mobile, and the api all import from it
- [waste-and-gamification.md](./waste-and-gamification.md) - how the Waste Level score and the Trashy challenges work

For how login works, see [AUTHENTICATION.md](../AUTHENTICATION.md). For the list of
places where the code ended up different from the original conception, see
[CONCEPTION_DIVERGENCES.md](../CONCEPTION_DIVERGENCES.md).
