## What this changes

<!-- One or two sentences. If it fixes an issue, write "Fixes #123" so it closes on merge. -->

## Why

<!-- The anomaly, the measurement, or the feedback behind it. Link the issue or the CR-* scenario. -->

## How to check it

<!-- The steps a reviewer runs to see it works. For a fix, the reproduction that used to fail. -->

## Checklist

- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm build` pass
- [ ] `pnpm --filter @pantryai/api test:all` passes
- [ ] A fix comes with a test that fails without it
- [ ] `CHANGELOG.md` updated under `[Unreleased]` if this is user-visible
- [ ] Docs updated if this changes how the app is run or deployed
