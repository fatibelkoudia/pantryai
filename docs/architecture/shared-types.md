# The shared package

Last updated: 2026-06-26

## What it is

`packages/shared` is a small package of plain TypeScript that the other three
packages (`api`, `web`, `mobile`) all import from. It has no framework code in it, it
is just types and a few helpers. Everyone imports it as `@pantryai/shared`.

If we look in `packages/shared/src/index.ts` it is basically a list of re-exports.
The main pieces are:

- `types/` - one file per area of the app: `stock.ts`, `product.ts`, `recipe.ts`,
  `ocr.ts`, `waste.ts`, `gamification.ts`, `shopping.ts`, `device.ts`, `user.ts`,
  `auth.ts`, `learning.ts`, and `api.ts` for the shared response envelope.
- `api/client.ts` - a small typed API client the front ends can use.
- `theme/` - the design tokens and the Trashy mascot mood stuff (`tokens.ts`,
  `mascot.ts`), so the web app and the mobile app use the same colours, spacing, and
  mascot rules.

## Why it exists

The whole point is that a thing means the same thing everywhere. A `StockItem`, a
`WasteMood`, a `ChallengeRule`, the `{ success, data }` response envelope: they are
defined once in `shared` and imported by the api that produces them and by the web
and mobile apps that consume them.

So when we change a field on a type, every package that uses it sees the change on
the next build and TypeScript tells us right away everywhere that now needs updating.
Without this we would be keeping three copies of the same interface in sync by hand,
and they would drift apart the first time we were in a hurry.

It is also where the backend rules and the frontend display agree. For example
`waste.ts` defines the `WasteMood` values (`EXCELLENT`, `GOOD`, and so on). The api
computes which mood applies and the apps pick the matching mascot face, both reading
the same type, so they can't disagree about what moods exist. The same goes for the
theme tokens, which keep the two front ends looking identical.

## How it is kept in order

Because `shared` has no dependence on the others but they all depend on it,
Turborepo always builds it first (see [monorepo.md](./monorepo.md)). That way the api,
web, and mobile builds are always compiling against the latest shared types, not a
stale copy.
