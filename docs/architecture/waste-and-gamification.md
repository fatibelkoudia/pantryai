# Waste Level and the Trashy challenges

Last updated: 2026-06-26

This covers the two "fun" mechanics: the Waste Level score with the Trashy mascot
mood, and the challenge loop that hands out XP. We kept the actual maths in small
pure functions on purpose so they are easy to test and easy to explain.

## Waste Level

The idea is one number from 0 to 100 that says how little food a user is wasting, and
a mascot mood that goes with it. The formula lives in
`packages/api/src/waste/waste-scoring.ts`.

Every stock item ends up in one of three outcomes: it gets `CONSUMED` (good),
`DISCARDED` (thrown out), or `EXPIRED` (went off). Discarded and expired both count
as waste, only consumed is the good outcome. The score is just the ratio:

```
score = round(100 * consumed / (consumed + discarded + expired))
```

We look at a rolling 30-day window (`WASTE_WINDOW_DAYS`), so the score reflects recent
habits, not something the user did months ago.

One deliberate choice: if there is nothing resolved yet (a brand new user), the score
is 100, not 0. We did not want to greet someone with a guilt-trip before they have
even used the app, so an empty history starts on the best mood.

The mood bands are in the same file (`moodFromScore`): 90+ is EXCELLENT, 70+ GOOD,
50+ OKAY, 30+ BAD, below 30 AWFUL. The apps pick the matching Trashy face from the
shared theme, so the backend and the front ends always agree on what the moods are
(see [shared-types.md](./shared-types.md)).

The original conception named a "Waste Level" but never defined the formula, so this
is one of the places we filled in a blank, written up in
[CONCEPTION_DIVERGENCES.md](../CONCEPTION_DIVERGENCES.md).

## Challenges and XP

Challenges are small goals like "eat 10 items from the fridge" or "no waste for a
week". Each one is worth some XP and only ever pays out once. The user has a single
running XP total.

The pieces:

- `gamification/challenges.ts` has the list of challenge definitions (`CHALLENGE_DEFS`),
  each with a `key`, some text, an `xp` value, and a `rule`.
- `gamification/challenge-rules.ts` has `evaluateProgress`, a pure function that takes
  a rule plus some pre-counted `signals` and returns `{ progress, target }`. There are
  no database calls in here, which is exactly why it is easy to unit test.
- `gamification/gamification.service.ts` does the database side: it loads the signals,
  calls `evaluateProgress`, and awards XP.

### How a rule is scored

`evaluateProgress` handles three kinds of rule:

- `consume_count`: how many items the user has eaten, optionally only counting one
  location (like the fridge). Progress is capped at the target.
- `no_waste_window`: count items consumed in a window, but if anything at all was
  wasted in that window, progress drops back to 0, because the clean streak is broken.
- `shopping_checked`: how many shopping-list items the user has ticked off.

### When it runs and how XP is only paid once

The recheck is event-driven. When a stock item gets used up or thrown out, the stock
module emits a `STOCK_REMOVED` event, and the gamification service listens for it
(`@OnEvent`) and re-evaluates the challenges for that user. So we only do the work
when something actually changed, instead of recomputing all the time.

To make sure a challenge's XP is only ever added once, the award uses a guarded
`updateMany` inside a transaction: it only flips the challenge to done if it was not
already done, and only the call that actually changes a row goes on to add the XP. If
two events fire at nearly the same time, only one of them wins, so the XP can't be
double-counted.

```mermaid
flowchart TD
    Removed[stock item consumed or thrown out] --> Event[STOCK_REMOVED event]
    Event --> Listen[gamification service hears it]
    Listen --> Eval[re-evaluate every challenge with evaluateProgress]
    Eval --> Check{newly completed?}
    Check -- no --> Nothing([do nothing])
    Check -- yes --> Award[guarded updateMany in a transaction]
    Award --> Xp([add the challenge XP once])
```

The challenge definitions are seeded into the database on startup (`onModuleInit`
upserts them by `key`), because we do not have a separate Prisma seed script. Running
it again just updates the existing rows instead of creating duplicates.
