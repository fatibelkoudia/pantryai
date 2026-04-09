# Divergences from the conception

Last updated: 2026-06-14

This file tracks everything where the real code is different from what we wrote
in the conception dossier (`help/pantry_ai_conception.pdf`) or in the features
list (`help/PANTRYAI_FEATURES.md`). The idea is to be honest about it: when
something in the planning docs does not hold, we write down here what we did
instead and why. We should update the dossier later so it matches.

## Quick table

| #   | Area               | What the docs say                                                                                                                     | What we actually did                                                   | Why                                                                                                                                                        |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Row-Level Security | Conception §9.5 and §9.9 say data isolation is done with PostgreSQL RLS. Features list says "Supabase RLS on all user-facing tables". | No RLS. We filter every query by `userId` in the service code instead. | RLS does not fit our auth (see below).                                                                                                                     |
| 2   | Supabase Auth      | Features list (line 32) mentions "Supabase Auth".                                                                                     | We use our own JWT auth. Supabase is only the database.                | We decided Supabase is just the Postgres host, nothing else. The conception §9.6 ("JWT stateless") already matches this, only the features list was wrong. |
| 3   | Next.js version    | Conception §9.9 says Next.js 14.                                                                                                      | We use Next.js 16.2 (App Router, Turbopack).                           | 16 was the current stable version when we started building.                                                                                                |
| 4   | Expo SDK version   | Conception §9.9 and §10.2 say Expo SDK 51.                                                                                            | We use Expo SDK 55 (React Native 0.83).                                | Newer SDK available, better camera support.                                                                                                                |
| 5   | PostgreSQL version | Conception §9.5 says PostgreSQL 15.                                                                                                   | We use PostgreSQL 17 (on Supabase).                                    | Newer version offered by Supabase.                                                                                                                         |

## 1. Row-Level Security (the important one)

The conception says we isolate each user's data with PostgreSQL Row-Level
Security (RLS). RLS works by writing a rule on the table like "you can only see
rows where `user_id = auth.uid()`". The catch is that `auth.uid()` only exists
when Supabase Auth issued the token, because Supabase puts the user id into the
database session.

We do NOT use Supabase Auth. We sign our own JWTs, and our API talks to the
database through Prisma using one shared connection (the transaction pooler) as
a normal privileged role. The database never knows which user is behind a
request, so an RLS rule based on `auth.uid()` would never match.

So instead we enforce isolation in the application code: every query in the
stock service and OCR service has a `where: { userId }` filter, so a user can
only read or change their own rows. The features list already calls this
"Prisma userId scoping (defense-in-depth)" on line 217, so this part is fine,
it is really line 216 (the RLS line) that overpromises.

What to fix in the dossier: §9.5 and §9.9 should say "user isolation is enforced
in the application layer (Prisma queries scoped by userId)" instead of RLS, or
explain that RLS was dropped because we kept our own JWT auth.

## 2. Supabase used as database only

We made a clear decision: Supabase is our managed PostgreSQL database and
nothing more. We do not use:

- Supabase Auth (we have our own JWT auth, see
  [AUTHENTICATION.md](./AUTHENTICATION.md))
- Supabase Storage (receipt images go to Cloudflare R2)
- Supabase RLS (see point 1)

This keeps Supabase easy to swap out later if we ever move the database. The
conception §9.6 already describes our auth correctly as "JWT stateless", so the
only doc that needs a small fix is the features list line that mentions
"Supabase Auth".

## Notes

- Points 3, 4 and 5 are just version bumps. Not a big deal, but worth writing
  down so the dossier numbers can be updated to match.
- This is a living document. Add new rows whenever the code and the planning
  docs disagree.
