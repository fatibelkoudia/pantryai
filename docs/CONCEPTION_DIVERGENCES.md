# Divergences from the conception

Last updated: 2026-07-12

This file tracks everything where the real code is different from what we wrote
in the conception dossier (`help/pantry_ai_conception.pdf`) or in the features
list (`help/PANTRYAI_FEATURES.md`). The idea is to be honest about it: when
something in the planning docs does not hold, we write down here what we did
instead and why. We should update the dossier later so it matches.

## Quick table

| #   | Area                                          | What the docs say                                                                                                                                                                                   | What we actually did                                                                                                                                                                                                                                                                                                                                                              | Why                                                                                                                                                                                                                                                                                                                                        |
| --- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Row-Level Security                            | Conception §9.5 and §9.9 say data isolation is done with PostgreSQL RLS. Features list says "Supabase RLS on all user-facing tables".                                                               | No RLS. We filter every query by `userId` in the service code instead.                                                                                                                                                                                                                                                                                                            | RLS does not fit our auth (see below).                                                                                                                                                                                                                                                                                                     |
| 2   | Supabase Auth                                 | Features list (line 32) mentions "Supabase Auth".                                                                                                                                                   | We use our own JWT auth. Supabase is only the database.                                                                                                                                                                                                                                                                                                                           | We decided Supabase is just the Postgres host, nothing else. The conception §9.6 ("JWT stateless") already matches this, only the features list was wrong.                                                                                                                                                                                 |
| 3   | Next.js version                               | Conception §9.9 says Next.js 14.                                                                                                                                                                    | We use Next.js 16.2 (App Router, Turbopack).                                                                                                                                                                                                                                                                                                                                      | 16 was the current stable version when we started building.                                                                                                                                                                                                                                                                                |
| 4   | Expo SDK version                              | Conception §9.9 and §10.2 say Expo SDK 51.                                                                                                                                                          | We use Expo SDK 55 (React Native 0.83).                                                                                                                                                                                                                                                                                                                                           | Newer SDK available, better camera support.                                                                                                                                                                                                                                                                                                |
| 5   | PostgreSQL version                            | Conception §9.5 says PostgreSQL 15.                                                                                                                                                                 | We use PostgreSQL 17 (on Supabase).                                                                                                                                                                                                                                                                                                                                               | Newer version offered by Supabase.                                                                                                                                                                                                                                                                                                         |
| 6   | `ConservationTip` table + Learning Path V2    | The conception ERD lists a `ConservationTip` database table for the Learning Path (Feature 15). The summary defers the quiz/badges (Learning Path V2) and says it would be "via PostgreSQL, no AI". | The tips stay bundled JSON (now bilingual FR/EN, each with a source link and a quiz), served by the `learning` module. We built the V2 gamification (interactive quiz lessons, XP, streak, levels), tracking per-user completion in a `lesson_completions` table. The quizzes and the English text are generated once offline with Mistral and committed into the JSON.           | The tip text has no per-user state so a table adds nothing, but lesson completions do, so those got a table. There is no public API for conservation quizzes, so we used AI to author them once rather than hand-write 25 x 2. See below.                                                                                                  |
| 7   | Retailer parsers                              | Conception §8 (and the features list) name 4 receipt parsers: Carrefour, Lidl, Leclerc, and a generic fallback.                                                                                     | 6 parsers: we added Auchan and Grand Frais on top of the 4.                                                                                                                                                                                                                                                                                                                       | We had real Auchan and Grand Frais receipts on hand while testing, so we wrote parsers for them too. See below.                                                                                                                                                                                                                            |
| 8   | Node.js version                               | Conception §9.9 says Node.js 20.                                                                                                                                                                    | We use Node.js 22.x LTS.                                                                                                                                                                                                                                                                                                                                                          | Newer LTS line, same as the other version bumps.                                                                                                                                                                                                                                                                                           |
| 9   | OCR worker process                            | The conception deployment diagram draws the OCR worker as its own isolated container/process.                                                                                                       | Reconciled: production runs a dedicated `worker` container next to the API, sharing Redis. The API only enqueues. A single process still works for local/dev.                                                                                                                                                                                                                     | We matched the deployment diagram for prod. The split is controlled by `RUN_OCR_WORKER`. See below.                                                                                                                                                                                                                                        |
| 10  | PDF parsing library                           | Conception §8 says native PDF receipts (Carrefour/Leclerc) are read with `pdf-parse` at "Niveau 1".                                                                                                 | We read the PDF text layer with `unpdf` instead, then fall back to Mistral OCR only for image-only PDFs.                                                                                                                                                                                                                                                                          | `unpdf` is pure JS/ESM and fits our Rust-free, ESM-first setup better. Same two-tier idea, different library. See below.                                                                                                                                                                                                                   |
| 11  | Brand typeface                                | The brand doc (`help/UX.md`) names the typeface "Nunito Rounded".                                                                                                                                   | We ship plain **Nunito**.                                                                                                                                                                                                                                                                                                                                                         | "Nunito Rounded" is not a real Google Fonts family. Nunito is the rounded-feel font Google actually serves, and it is what the design system was built on. See below.                                                                                                                                                                      |
| 12  | Waste Level formula                           | The dossier names a "Waste Level" / Trashy mood but never defines the formula (DEV_PLAN §5.3 flagged it as a blocker).                                                                              | We defined it: waste = discarded + expired; score = consumed / (all resolved) over a 30-day window. Updated 2026-07-11: now a composite, 70% outcome (recency weighted, 14 day half life, rescues 1.5x) + 30% pantry state (expired/expiring items in stock drag it down), plus trend, weekly and all-time history, and detail endpoints.                                         | The mascot mechanic needed a concrete number. We picked a simple, explainable ratio and recorded the disposition on the existing soft-delete instead of a new table. The weighting and the pantry part came later, once we saw one bad week froze the mood for a month and that eating fresh items could hide a rotting fridge. See below. |
| 13  | Gamification (XP, challenges, streak, levels) | The dossier names the Trashy challenges and the idea of XP but never says how a challenge is measured or completed, and does not define a streak or levels.                                         | Each challenge stores a JSON `rule`; progress is computed from data we already keep; XP is awarded once with a guarded `updateMany`; definitions are seeded on boot; completion is event-driven on `stock.removed`. Updated 2026-07-12: challenges reset weekly (one row per week), XP maps to named levels, and a daily streak is computed from lesson and consumption activity. | The mechanic needed concrete rules and numbers. The Learn revamp then needed weekly challenges, levels and a real streak to feel like a game. See below.                                                                                                                                                                                   |
| 14  | App navigation                                | The Trashy brand (`help/UX.md` / Trashy.jpg) shows a 5-pillar app: Home, Inventory, Meal Ideas, Learn, Profile.                                                                                     | We built exactly those 5 as the main nav. Scan and Shopping list sit as secondary screens, not as tabs.                                                                                                                                                                                                                                                                           | Scan and Shopping aren't one of the five pillars, so they're reached from the Home/Inventory headers instead of crowding the tab bar. See below.                                                                                                                                                                                           |
| 15  | Recipe suggestion rule                        | The dossier fixes the recipe match rule at 70% of ingredients owned.                                                                                                                                | The 70% is now the default of a per-user setting (30% to 100%), next to a new "minimum items from my stock" knob and the other profile settings (language, expiring-soon window, low-stock threshold, default location) stored in a `user_settings` table.                                                                                                                        | The profile page needed real settings, and the fixed rule was the obvious one to open up. Defaults keep the dossier behaviour. See below.                                                                                                                                                                                                  |

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

## 6. Tips stay static JSON, and Learning Path V2 is now built

The conception ERD includes a `ConservationTip` table for the Learning Path V1
(conservation tips, Feature 15). We did not create it. The tip text is a fixed set
of conservation advice written from ANSES and ADEME guidance, the same for every
user, with no per-user state. We looked for a public API to pull these tips from
and there isn't one (ADEME and ANSES publish web articles, not an API; the food
APIs that exist, like Open Food Facts, are product/nutrition databases), so the
tips are hand-written and live in bundled JSON. Each tip now also carries a
`sourceUrl` linking to the exact ANSES/ADEME page it is based on.

The summary parked the quiz-and-badges part (Learning Path V2) as out of scope and
noted it would be "via PostgreSQL, no AI". The Learn revamp brought it forward and
built it, with two changes from that note:

- **The lessons are interactive.** Each tip opens as a one-question multiple-choice
  quiz. Answering it (or confirming a quiz-less tip) pays 20 XP once and feeds the
  streak. Which lessons a user has finished is real per-user state, so that part did
  get a table, `lesson_completions`, keyed on `(userId, tipId)` so the XP is only
  paid once. The tip text itself still has no table.
- **We used AI to author the quiz content, offline.** There is no public source of
  ready-made quizzes, and hand-writing a question for all 25 tips in both languages
  is exactly the toil we wanted to avoid. So a one-off script
  (`packages/api/scripts/generate-lessons.ts`, run with `pnpm generate-lessons`) asks
  Mistral for one question per tip plus the English translation, and writes the
  result straight into `tips.fr.json` / `tips.en.json`. This runs once and the output
  is committed, so at runtime the app just reads the files (no AI call, no repeat
  cost). That keeps the spirit of the "no AI at runtime, served from storage" note
  while still automating the authoring. Mistral is already our provider (OCR), so
  this adds no new third party, and only public tip text is sent.

The "disable tips" preference (risk F5) is also kept off the database: it is
stored per-device on the client (localStorage on web, expo-secure-store on
mobile), which is enough for an opt-out and avoids a migration.

What to fix in the dossier: drop `ConservationTip` from the ERD (tips are static
files); note the `lesson_completions` table for per-user lesson progress; and note
that the V2 quizzes are AI-authored offline and committed, not generated live.

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

## 9. OCR worker as a separate container (reconciled to the diagram)

The conception deployment diagram draws the OCR worker as its own isolated
process/container, separate from the API. We now match that in production.

The BullMQ processor (`OcrProcessor` in `packages/api/src/ocr/ocr.processor.ts`)
is still defined the same way, but whether a process actually runs it is decided
by `RUN_OCR_WORKER` (see `packages/api/src/common/background-jobs.ts`).
`ocr.module.ts` only registers the processor when that flag is on, and the two
cron jobs (R2 sweep, expiration push) check the same flag. In
`docker-compose.prod.yml` the `api` container sets `RUN_OCR_WORKER=false` (it only
enqueues jobs and serves HTTP) and the dedicated `worker` container, running the
same image with `node dist/worker`, sets it to `true`. So one process owns the
queue and the cron jobs, and a job never gets processed twice.

The flag defaults to on, so a single-process run (local dev, tests, or a minimal
deploy) still does both the HTTP and the OCR work with no extra config, exactly as
before.

This closes the earlier gap where the processor ran in-process by default. The
tradeoff it removes: a heavy OCR job no longer shares the API event loop, so it
can't slow down HTTP responses under load.

What to fix in the dossier: nothing on topology now, it matches. Just note that
the worker is selected by an env flag rather than being a different build.

## 9b. Monitoring stack (addition, not in the conception)

The conception does not spell out a monitoring stack. For the deployment phase we
added three things, all on free tiers:

- a public `GET /health` route (`packages/api/src/health/`) that pings Postgres and
  Redis, used by the Docker healthcheck and Uptime Robot,
- Sentry error tracking (`packages/api/src/instrument.ts`), off unless
  `SENTRY_DSN` is set, and scrubbing PII before sending (RGPD),
- the BullMQ dashboard at `/admin/queues`, behind basic auth and only mounted when
  credentials are set.

These are additions for operability and do not change any feature behaviour. See
`docs/monitoring.md`.

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

**Updated 2026-07-11 (twice, we iterated the same day):** the plain ratio had two
problems. First, one bad week (say 5 items tossed) locked the mascot into a sad mood
for up to a month, and then the old waste fell off a cliff on day 30. Second, eating
lots of fresh items was the only lever: a user could keep Trashy happy while food
rotted in the fridge. So the score became a composite:

- `score = round(0.7 * outcome + 0.3 * pantry)`.
- The outcome part is the same consumed-over-resolved ratio inside the 30-day
  window, but recency weighted (each item's weight halves every 14 days,
  `weight = 0.5 ^ (ageDays / 14)`) and with a rescue bonus: an item eaten with 3
  days or less left before its expiry date counts 1.5x.
- The pantry part looks at the stock right now: each expired item in stock counts
  as 1 risk, each item expiring within 3 days as 0.5, and
  `pantry = 100 * max(0, 1 - risk / itemsInStock)` (empty pantry = 100).

Old waste fades gradually, rescues are rewarded, and a rotting fridge drags the
mood down no matter how much the user eats. The mood bands did not change (they
live in the shared `wasteMoodBands` so the api and both apps read the same
numbers), and the counts we show stay unweighted. The endpoint also gained `trend`
(last 7 days vs the rest), `weeklyScores` (4 weeks of history for the bars),
`nextMood` / `itemsToNextMood` ("use ~N more items and Trashy feels Good", with a
`pantryBlocked` flag when eating alone cannot get there), the `pantry` counts and
`rescuedCount`. Two companion endpoints were added: `GET /waste/items` (the
resolved items behind the counts + the CO2 factor table, for the tappable stat
cards) and `GET /waste/history` (all-time monthly scores, computed live from the
soft-deleted rows, capped at 24 months, no new table). All of it stays in pure
functions in `waste-scoring.ts`. Details in
[architecture/waste-and-gamification.md](./architecture/waste-and-gamification.md).

We did not add a new events table for this. The signal is a `disposition` column on
`stock_items`, set when the row is soft-deleted (`deletedAt` is the event time), so
the already-soft-deleted rows are the event log we query over the window. This keeps
the data model minimal, the same reasoning as the ConservationTip decision (#6).

The mascot art started as five code-drawn SVG placeholders; since 2026-07 the shared
package ships one illustrated PNG per mood
(`packages/shared/src/assets/mascot/trashy_*.png`) and
`packages/shared/src/theme/mascot.ts` keeps the shared labels, messages and accent
colors, so both clients still describe each mood the same way.

What to fix in the dossier: write down the Waste Level formula (including the recency
weighting) and the disposition field.

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

**Updated 2026-07-12 (the Learn revamp):** the Learn page needed to feel like a
game, so three things changed on top of the base mechanic above.

- **Challenges are weekly now.** Progress is stored per user, per challenge and per
  ISO week (`UserChallenge` got a `weekKey` column and the unique key became
  `(userId, challengeId, weekKey)`). We only count what happened since Monday, so on
  Monday everyone starts a fresh row at 0 and can earn the XP again. Old rows stay as
  history. The day and week maths follow the Paris clock and live in pure helpers
  (`gamification/week.ts`), since our users are in France and we want the reset to be
  the same wherever the server runs. Shopping ticks got a `checkedAt` timestamp so
  the Smart Shopper challenge can be windowed to the week too.
- **A daily streak.** How many days in a row the user did something anti-waste, which
  counts a finished lesson or a consumed stock item. Nothing is stored: `computeStreak`
  (`gamification/streak.ts`) recomputes it from the lesson and consumption timestamps
  each read. A run that ended yesterday still counts today, so nobody wakes up to a
  zero.
- **Levels.** XP now maps to a named level (Rookie up to Master Chef) through a pure
  function in the shared package (`gamification/levels.ts`), so mobile and web agree
  and the titles come from the i18n catalogs. The XP total itself still never resets.

What to fix in the dossier: write down the challenge rules and XP values, the
`UserXp`/`Challenge`/`UserChallenge` tables (with the weekly `weekKey`), that
challenges are seeded at runtime and reset weekly, that completion is event-driven
over the 4.3b disposition signal, and the new streak and level mechanics.

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

## 15. The 70% recipe rule is now a user setting

The dossier asks for a fixed rule: suggest a recipe when the user owns at least
70% of its ingredients. That rule is still the default, but the profile page now
lets each user move it (30% to 100%) and adds a second knob the dossier never
mentions: the minimum number of stock items a recipe must use (1 to 10, default
1). Both live in a new `user_settings` table together with the expiring-soon
window, the low-stock threshold, the default storage location, and the app
language. A user who never opens their settings gets exactly the dossier
behaviour, with one nuance: the server-side "expiring soon" stock filter used a
fixed 7 days before, and its default is now the 3 days the settings use.

What to fix in the dossier: present the 70% as the default of a user preference
instead of a constant.

## Notes

- Points 3, 4, 5 and 8 are just version bumps (Next.js, Expo, PostgreSQL,
  Node.js). Not a big deal, but worth writing down so the dossier numbers can be
  updated to match.
- This is a living document. Add new rows whenever the code and the planning
  docs disagree.
