# Profile and user settings

This note explains how the profile page and the per-user settings work, end to
end, and why they are built this way.

## What the user can do

Both apps (web and mobile) have a Profile page with the same content:

- pick a preset avatar, change their name and email,
- change their password,
- tune the app settings (language, recipe thresholds, expiring-soon window,
  low-stock threshold, default storage location),
- and the things that were already there: XP and challenges, log out, data
  export, and account deletion.

## Storage

Two things changed in the schema (`packages/api/prisma/schema.prisma`):

- `User.avatarId`: a nullable string holding the id of one of the built-in
  avatars. We chose preset avatars over photo uploads on purpose: no storage
  bucket to manage, no image moderation questions, and one less personal file
  to worry about for the RGPD.
- `UserSettings`: a one-row-per-user table with the knobs and their defaults
  (locale `en`, `recipeMinMatchedItems` 1, `recipeMatchThreshold` 0.7,
  `expiringSoonDays` 3, `lowStockThreshold` 1, `defaultStockLocation` PANTRY).
- `User.onboardingCompletedAt`: a nullable date, null until the user finishes or
  skips the first-run onboarding. This lives on `User`, not here, so the backfill
  for old accounts stays a single `UPDATE`. See
  [onboarding.md](./onboarding.md).

The settings row is created lazily: the first `GET /users/me/settings` upserts
it with the defaults. Accounts that never open their settings have no row, and
the services treat "no row" and "row with defaults" the same. That saved us a
backfill migration.

## Endpoints

All under the existing `users` module, guarded by the JWT guard:

- `PATCH /users/me` for name, email, and avatar. Email changes check uniqueness
  and return 409 when taken. There is no confirmation email because we run no
  mail server, we accept that trade-off and say so in the API doc.
- `POST /users/me/password` checks the current password with bcrypt and stores
  a new hash (same 12 salt rounds as register).
- `GET` / `PATCH /users/me/settings` read and partially update the settings,
  with class-validator bounds shared with the clients through
  `SETTINGS_LIMITS` in `@pantryai/shared`.
- `POST /users/me/onboarding/complete` marks the first-run onboarding as done.
  It is idempotent. The onboarding steps write their answers through the same
  profile and settings endpoints above, so this endpoint only sets the flag.

## Who consumes the settings

Each consumer reads the row with a plain `findUnique` and falls back to its old
default when there is none. We deliberately did not make the recipe or stock
modules depend on the users module for this, one query keeps them decoupled.

- `recipes/recipe-scoring.ts`: `rankSuggestions` takes the threshold and a new
  `minMatched` parameter, a recipe must use at least that many stock items.
- `recipes/recipe.service.ts`: passes the user's two recipe knobs to the
  scoring.
- `shopping-list.service.ts`: the saved `lowStockThreshold` is the default when
  the generate request does not carry one (an explicit request value wins).
- `stock.service.ts`: the `expiringSoon` filter window comes from
  `expiringSoonDays`, and new items without a location go to the user's
  `defaultStockLocation`.

RGPD wiring: account deletion also deletes the settings row and clears the
avatar, and the Article 20 export includes the settings.

## i18n scaffolding

The language setting is real but the translations are not done yet. The setup:

- catalogs live in `packages/shared/src/i18n/` (`en.ts`, `fr.ts`). The French
  file is currently a copy of the English one, typed as `typeof en` so a
  missing key breaks the build once real translations land.
- both apps use `i18next` + `react-i18next`. Web inits it in
  `src/lib/i18n.ts` (always starts in English so server and client render the
  same, no hydration mismatch), mobile in `src/lib/i18n.ts` with the device
  language via `expo-localization`.
- a small `LocaleSync` component in each app fetches the settings once the
  user is signed in and calls `i18n.changeLanguage` with the saved locale.
- the profile, settings, learn, auth (login/register) and onboarding screens go
  through `t()`, and their `auth.*` and `onboarding.*` keys are really
  translated in French. The rest of the app keeps its inline strings until the
  translation pass, where they get extracted into the catalogs.

## Why one save button instead of saving each change

Both settings UIs keep a local draft and push it with a single PATCH. Saving on
every stepper tap would spam the API and make the "recipes changed under you"
moment feel random. After a save the clients invalidate their queries so
recipes, shopping list, and stock filters pick the new values up right away.
