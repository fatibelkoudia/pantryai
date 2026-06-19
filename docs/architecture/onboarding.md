# First-run onboarding and the auth screens

This note covers the modern login and register screens and the first-run
onboarding flow that a new account sees right after signing up. Both apps (web
and mobile) do the same thing, with one small difference noted below.

## What the user sees

A brand new account, right after registering, gets:

1. A few intro slides where Trashy explains the app (scan a receipt, track your
   stock, cook it before it expires).
2. A short setup, one step at a time, every step skippable:
   - pick a language (English or French),
   - pick an avatar and a display name,
   - set the pantry defaults (where food usually goes, how many days ahead we
     warn about expiry),
   - turn on notifications (mobile only, see below).

There is a "Skip" button in the corner the whole time, and every step also has
its own "Skip this step". Returning users and every account that existed before
this shipped never see any of it, they go straight into the app.

## How we know it is a new account

We added one field on the `users` table: `onboardingCompletedAt` (a nullable
date). It is null until the user finishes or skips the flow, then it holds the
date. The migration that adds the column also backfills every existing row with
`now()`, so only accounts created after this feature have a null and get the
flow.

We put the flag on `User` and not on `UserSettings` on purpose. The settings row
is created lazily (see [profile-and-settings.md](./profile-and-settings.md)), so
a settings-based flag could not tell a new account apart from an old account that
never opened its settings. Every account has a `users` row, so the backfill is
one `UPDATE` and the flag is always there.

The flag rides along on the user object that `register`, `login` and `/auth/me`
already return, so the clients know whether to route into onboarding without any
extra request.

## Marking it done

There is one endpoint: `POST /users/me/onboarding/complete`. It is idempotent, if
the date is already set it leaves it alone. Both finishing the last step and
tapping the global "Skip" call it. The individual step "skip" links do not, they
just move to the next step.

## How each step saves

Each step saves on its own, right when you tap Continue, by reusing endpoints
that already exist:

- language and pantry defaults go through `PATCH /users/me/settings`,
- avatar and name go through `PATCH /users/me`,
- the completion call above is the only new endpoint.

We save per step instead of batching at the end because the steps are skippable,
so a half-finished setup is normal, and this way anything you did confirm sticks
even if you close the app in the middle.

One thing to watch: `LocaleSync` (the component that switches the UI to your
saved language) holds the settings it fetched at login in the query cache. After
the language step saves, we write the fresh settings straight into that cache
(`queryClient.setQueryData(['settings'], ...)`) so it can't flip the language
back to the old value.

## Routing

The route guards decide where an authed user goes based only on the flag, never
on "did they just come from the register screen". That way it survives an app
restart in the middle of onboarding.

- Mobile: the `AuthGate` in `app/_layout.tsx` routes three ways, anon to login,
  authed with a null flag to `/onboarding`, otherwise to the tabs. A user we
  could not load (a failed `/auth/me`) counts as onboarded so a network blip
  never traps them on the welcome flow.
- Web: `auth-context` sends a fresh login or register to `/welcome` when the
  flag is null, else `/home`. The `AppShell` also bounces an authed user with a
  null flag to `/welcome`, which covers reloading the page mid-flow. When the
  flow finishes we refresh the user before navigating so the shell sees the set
  flag and does not bounce back.

## Notifications step (mobile only)

The web has no push, so it skips this step and only has three setup steps.

On mobile this is the interesting part. Before, the app asked for the OS push
permission the moment you logged in, with no context. Now the boot-time code only
re-registers the device token if permission was already granted, so nobody is
prompted on launch. The actual permission prompt only fires from the onboarding
notifications step, after a friendly screen explaining why (Trashy will nudge you
before food expires, no spam). If you tap "Maybe later" the prompt never shows.
The two functions live in `packages/mobile/src/lib/push.ts`
(`syncPushRegistrationIfGranted` and `requestPushPermissionsAndRegister`).

## Where the code lives

| Piece                        | Files                                                                       |
| ---------------------------- | --------------------------------------------------------------------------- |
| Flag + endpoint (API)        | `users.service.ts`, `users.controller.ts`, `schema.prisma`                  |
| Shared client method + type  | `shared/src/api/client.ts`, `shared/src/types/user.ts`                      |
| i18n copy                    | `shared/src/i18n/{en,fr}.ts` (`auth.*`, `onboarding.*`)                     |
| Mobile auth screens + inputs | `mobile/app/(auth)/`, `mobile/src/components/{PrimaryButton,TextField}.tsx` |
| Mobile onboarding            | `mobile/app/onboarding.tsx`, `mobile/src/components/onboarding/`            |
| Web auth screens + input     | `web/src/app/(auth)/`, `web/src/components/PasswordField.tsx`               |
| Web onboarding               | `web/src/app/(onboarding)/welcome/`, `web/src/components/onboarding/`       |
