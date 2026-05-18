# Divergences from the conception

Last updated: 2026-06-20

This file tracks everything where the real code is different from what we wrote
in the conception dossier (`help/pantry_ai_conception.pdf`) or in the features
list (`help/PANTRYAI_FEATURES.md`). The idea is to be honest about it: when
something in the planning docs does not hold, we write down here what we did
instead and why. We should update the dossier later so it matches.

## Quick table

| #   | Area                    | What the docs say                                                                                                                     | What we actually did                                                                                     | Why                                                                                                                                                                             |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Row-Level Security      | Conception §9.5 and §9.9 say data isolation is done with PostgreSQL RLS. Features list says "Supabase RLS on all user-facing tables". | No RLS. We filter every query by `userId` in the service code instead.                                   | RLS does not fit our auth (see below).                                                                                                                                          |
| 2   | Supabase Auth           | Features list (line 32) mentions "Supabase Auth".                                                                                     | We use our own JWT auth. Supabase is only the database.                                                  | We decided Supabase is just the Postgres host, nothing else. The conception §9.6 ("JWT stateless") already matches this, only the features list was wrong.                      |
| 3   | Next.js version         | Conception §9.9 says Next.js 14.                                                                                                      | We use Next.js 16.2 (App Router, Turbopack).                                                             | 16 was the current stable version when we started building.                                                                                                                     |
| 4   | Expo SDK version        | Conception §9.9 and §10.2 say Expo SDK 51.                                                                                            | We use Expo SDK 55 (React Native 0.83).                                                                  | Newer SDK available, better camera support.                                                                                                                                     |
| 5   | PostgreSQL version      | Conception §9.5 says PostgreSQL 15.                                                                                                   | We use PostgreSQL 17 (on Supabase).                                                                      | Newer version offered by Supabase.                                                                                                                                              |
| 6   | `ConservationTip` table | The conception ERD lists a `ConservationTip` database table for the Learning Path (Feature 15).                                       | No table. The tips are bundled as static JSON and served by a `learning` module.                         | The tips are fixed reference content (ANSES/ADEME) with no per-user state, so a database table would add nothing. See below.                                                    |
| 7   | Retailer parsers        | Conception §8 (and the features list) name 4 receipt parsers: Carrefour, Lidl, Leclerc, and a generic fallback.                       | 6 parsers: we added Auchan and Grand Frais on top of the 4.                                              | We had real Auchan and Grand Frais receipts on hand while testing, so we wrote parsers for them too. See below.                                                                 |
| 8   | Node.js version         | Conception §9.9 says Node.js 20.                                                                                                      | We use Node.js 22.x LTS.                                                                                 | Newer LTS line, same as the other version bumps.                                                                                                                                |
| 9   | OCR worker process      | The conception deployment diagram draws the OCR worker as its own isolated container/process.                                         | The BullMQ worker (`OcrProcessor`) runs inside the API process as a NestJS provider.                     | One process is simpler to deploy for the MVP. It is still a real queue, so we can split it out later. See below.                                                                |
| 10  | PDF parsing library     | Conception §8 says native PDF receipts (Carrefour/Leclerc) are read with `pdf-parse` at "Niveau 1".                                   | We read the PDF text layer with `unpdf` instead, then fall back to Mistral OCR only for image-only PDFs. | `unpdf` is pure JS/ESM and fits our Rust-free, ESM-first setup better. Same two-tier idea, different library. See below.                                                        |
| 11  | Brand typeface          | The brand doc (`help/UX.md`) names the typeface "Nunito Rounded".                                                                     | We ship plain **Nunito**.                                                                                | "Nunito Rounded" is not a real Google Fonts family. Nunito is the rounded-feel font Google actually serves, and it is what the design system was built on. See below.           |
| 12  | Waste Level formula     | The dossier names a "Waste Level" / Trashy mood but never defines the formula (DEV_PLAN §5.3 flagged it as a blocker).                | We defined it: waste = discarded + expired; score = consumed / (all resolved) over a 30-day window.      | The mascot mechanic needed a concrete number. We picked a simple, explainable ratio and recorded the disposition on the existing soft-delete instead of a new table. See below. |
| 14  | App navigation          | The Trashy brand (`help/UX.md` / Trashy.jpg) shows a 5-pillar app: Home, Inventory, Meal Ideas, Learn, Profile.                       | We built exactly those 5 as the main nav. Scan and Shopping list sit as secondary screens, not as tabs.  | Scan and Shopping aren't one of the five pillars, so they're reached from the Home/Inventory headers instead of crowding the tab bar. See below.                                |

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

On top of the per-query `where: { userId }` filters, we also added an opt-in
second layer in `PrismaService`: `prisma.forUser(userId)` returns a Prisma client
extension that forces `userId` onto every read and write of a user-owned model
(stock items, OCR jobs, shopping items, devices, XP, challenges). The RGPD export
endpoint uses it, so even if a query forgot to scope, it still could not return
another user's rows. System tasks that legitimately span users (the expiry
notification sweep, the R2 sweeper) keep using the plain client. This is the
defense-in-depth replacement for what RLS would have given us at the DB layer.

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

## 6. ConservationTip stored as static JSON, not a table

The conception ERD includes a `ConservationTip` table for the Learning Path V1
(conservation tips, Feature 15). We did not create the table. The tips are a
fixed set of conservation advice based on ANSES and ADEME guidance, the same for
every user, with no per-user state (no progress, no edits). So they live in a
bundled JSON file (`packages/api/src/learning/data/tips.fr.json`) and a small
`learning` module serves them over `GET /learning/tips` and
`GET /learning/tips/random`.

The "disable tips" preference (risk F5) is also kept off the database: it is
stored per-device on the client (localStorage on web, expo-secure-store on
mobile), which is enough for an opt-out and avoids a migration.

What to fix in the dossier: drop `ConservationTip` from the ERD, or note that
the tips are static content served from the application rather than a table.

## 7. Six retailer parsers instead of four

The conception and the features list (§8) name four receipt parsers: Carrefour,
Lidl, Leclerc, and a generic best-effort fallback. We built six. On top of the
four we added `auchan.parser.ts` and `grand-frais.parser.ts`
(`packages/api/src/ocr/parsers/`).

The reason is simple: while testing we had real Auchan and Grand Frais receipts,
so we wrote parsers that handle their formats (Grand Frais in particular is a GIE
multi-société ticket with a leading VAT code and `Nx` quantity lines). The parser
interface and registry were built to make adding a retailer cheap, so this did
not change the architecture, it just filled in two more formats. Anything we have
no parser for still falls through to the generic parser.

What to fix in the dossier: update §8 to list six parsers, or note that the
parser list grows as we meet new receipt formats.

## 9. OCR worker runs in the API process, not a separate container

The conception deployment diagram draws the OCR worker as its own isolated
process/container, separate from the API. We did not split it out. The BullMQ
processor (`OcrProcessor` in `packages/api/src/ocr/ocr.processor.ts`) is
registered as a normal NestJS provider inside the API app
(`ocr.module.ts`), so it runs in the same process that serves HTTP.

We still use a real BullMQ queue backed by Redis, so OCR is still asynchronous
(the request returns a `jobId` and the work happens off the request). For the MVP
one process is just easier to deploy and run. The tradeoff is that a heavy OCR job
shares the API event loop, so under load it could slow down HTTP responses.
Because the queue boundary is already there, moving the worker into its own
container later is a deployment change, not a code rewrite.

What to fix in the dossier: either note that the MVP runs the worker in-process,
or keep the diagram and treat the separate worker as a deployment step we have not
done yet.

## 10. PDF receipts read with `unpdf`, not `pdf-parse`

The conception (§8) says native PDF receipts (Carrefour, Leclerc) are read at
"Niveau 1" with the `pdf-parse` library, before falling back to Mistral OCR for
images. We kept that two-tier idea exactly, but used a different library:
`packages/api/src/ocr/pdf-text.ts` reads the PDF's embedded text layer with
`unpdf`, and we only call Mistral OCR when a PDF has no usable text (a scanned or
image-only PDF).

We picked `unpdf` because it is pure JavaScript and ESM-first, which fits our
Rust-free, ESM setup, whereas `pdf-parse` is older and CommonJS. The behaviour is
the same as the dossier intended (free/local for native PDFs, OCR only when
needed). One wrinkle: `unpdf` flattens everything to a single line, so we
reconstruct the layout by grouping characters by their `y` position and ordering
each line by `x`, which the retailer parsers need.

What to fix in the dossier: note the library substitution (`pdf-parse` to
`unpdf`) in the update manual. The design is unchanged.

## 11. Brand typeface is Nunito, not "Nunito Rounded"

The brand doc (`help/UX.md`) names the typeface "Nunito Rounded". There is no
Google Fonts family by that name. The font Google actually serves is plain
**Nunito**, which already has the soft, rounded look the brand wants, so that is
what we built the design system on: the web loads it with `next/font/google` and
mobile loads the matching weights from `@expo-google-fonts/nunito`. The family
names live in `packages/shared/src/theme/tokens.ts` so both apps stay in sync.

While we were here we also locked the palette question (the old open question in
the features list): the source of truth is `help/UX.md` / `Trashy.jpg`, not the
`pantryai_brand_explorer.html` palette, because that HTML file is not in the repo
and could not be checked. See DEV_PLAN §5.1.

What to fix in the dossier: where it says "Nunito Rounded", say "Nunito".

## 12. Waste Level formula (the Trashy mood mechanic)

The Trashy mascot's mood is driven by a "Waste Level" score, but the dossier never
said how that number is computed (DEV_PLAN §5.3 flagged it as a blocker). We agreed
on a simple, explainable rule:

- Every time a stock item is removed we record how it left the pantry: `CONSUMED`,
  `DISCARDED`, or `EXPIRED`. Both DISCARDED and EXPIRED count as waste; only CONSUMED
  is the "good" outcome.
- `score = round(100 * consumed / (consumed + discarded + expired))`, over the
  trailing **30 days**.
- Mood bands: EXCELLENT >=90, GOOD >=70, OKAY >=50, BAD >=30, AWFUL <30.
- A brand-new user with nothing resolved yet gets 100 / EXCELLENT (encouraging tone,
  no guilt-trips, matching the brand voice).

We did not add a new events table for this. The signal is a `disposition` column on
`stock_items`, set when the row is soft-deleted (`deletedAt` is the event time), so
the already-soft-deleted rows are the event log we query over the window. This keeps
the data model minimal, the same reasoning as the ConservationTip decision (#6).

The mascot art (`packages/shared/src/theme/mascot.ts`) is five code-drawn SVG
placeholders (one expression per mood) so the mood UI works on both clients from one
source; final illustrated art can replace the strings later without touching the UI.

What to fix in the dossier: write down the Waste Level formula and the disposition
field, and note that the mascot uses placeholder SVG art for now.

## 13. Gamification: how XP and challenges actually work

The dossier names the Trashy challenges (Clean Out Your Fridge, No Waste Weekend,
Use It All, Smart Shopper) and the idea of XP, but it never says how a challenge is
measured or completed. We had to pin that down, so:

- Each challenge stores a `rule` as JSON on the `challenges` table, and a small pure
  function works out progress from data we already keep. We did not add any new
  tracking: "consume" counts come from the `disposition` column 4.3b put on removed
  stock items, and the Smart Shopper count comes from checked shopping-list items.
  The rules we shipped: eat 3 fridge items (+50), eat 3 items in a week with nothing
  thrown away (+100), eat 10 items over time (+150), check off 5 shopping items (+75).
- XP is awarded exactly once per challenge. When progress reaches the target we flip
  `UserChallenge.completedAt` from null to a date with an `updateMany` that only
  matches while it is still null, inside a transaction, and only add the XP when that
  update touched one row. So re-running the check (or two removals racing) can never
  double-count.
- There is no `prisma db seed` in this repo, so the four challenge definitions are
  seeded on boot with an idempotent upsert keyed on `key`, the same lazy-seed pattern
  the recipes module already uses.
- Completion is detected off a `stock.removed` event (we added `@nestjs/event-emitter`)
  that the stock service fires after recording a disposition, plus a recompute whenever
  someone opens `GET /challenges`. This keeps the gamification code from reaching into
  the stock service directly.
- We added a `description` field to `Challenge` (beyond the bare schema) so each card
  has a line of copy on both clients.

What to fix in the dossier: write down the challenge rules and XP values, the
`UserXp`/`Challenge`/`UserChallenge` tables, that challenges are seeded at runtime,
and that completion is event-driven over the 4.3b disposition signal.

## 14. Scan and Shopping are secondary screens, not nav pillars

The Trashy brand previews (`help/UX.md` / Trashy.jpg) show a five-tab app: Home,
Inventory, Meal Ideas, Learn, Profile. We built exactly those five as the main
navigation (the mobile bottom tab bar and the web top nav). Scanning a receipt or
barcode and the shopping list are real features, but they aren't one of the five
pillars, so we kept them as secondary screens you open from inside the app (the
Scan/Add/Shopping quick actions on Home and the Inventory header) rather than
giving them their own tab.

This is a small arrangement choice, not a contradiction: the conception never
pins down the exact tab set, and keeping the bar to the five branded pillars
matches the previews and stops the nav from getting crowded. Everything is still
one tap away.

What to fix in the dossier: if it ever lists the app's tabs, note that Scan and
Shopping are reached from within the app, not from the main nav.

## Notes

- Points 3, 4, 5 and 8 are just version bumps (Next.js, Expo, PostgreSQL,
  Node.js). Not a big deal, but worth writing down so the dossier numbers can be
  updated to match.
- This is a living document. Add new rows whenever the code and the planning
  docs disagree.
