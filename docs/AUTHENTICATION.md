# How authentication works in PantryAI

Last updated: 2026-07-13

This doc explains how login works in our app. The short version: we built our
own JWT auth in the NestJS API. We do NOT use Supabase Auth. Supabase is only
our PostgreSQL database, nothing else.

## The big picture

1. A user registers or logs in through the API.
2. The API checks the password and gives back two tokens (an access token and a
   refresh token).
3. The frontend sends the access token on every request in the
   `Authorization: Bearer <token>` header.
4. A guard on the API checks that token before letting the request through.

That's it. No sessions stored on the server, the tokens carry everything we
need (this is what the conception doc calls "JWT stateless").

## Where the code lives

| Piece                                                   | File                                               |
| ------------------------------------------------------- | -------------------------------------------------- |
| Endpoints (`register`, `login`, `refresh`, `delete me`) | `packages/api/src/auth/auth.controller.ts`         |
| The actual logic (hashing, signing tokens)              | `packages/api/src/auth/auth.service.ts`            |
| The guard that protects routes                          | `packages/api/src/auth/guards/jwt-auth.guard.ts`   |
| How a token is read and checked                         | `packages/api/src/auth/strategies/jwt.strategy.ts` |
| Module wiring (JwtModule, Passport)                     | `packages/api/src/auth/auth.module.ts`             |
| Web token storage (cookie route)                        | `packages/web/src/app/api/session/route.ts`        |
| Web auth state                                          | `packages/web/src/lib/auth-context.tsx`            |

## Passwords

When someone registers we hash the password with `bcrypt` (12 salt rounds)
before saving it. We never store the plain password. On login we use
`bcrypt.compare` to check it. The hash is saved in the `passwordHash` column of
the `users` table.

## The two tokens

We hand out two tokens when you log in or register:

- **Access token**: short lived (15 minutes). This is the one sent on every
  request. Signed with `JWT_SECRET`.
- **Refresh token**: long lived (7 days). This one is only used to get a new
  access token when the old one expires. Signed with `JWT_REFRESH_SECRET` and it
  has `type: "refresh"` inside so we can tell the two apart.

Both tokens carry the user id (`sub`) and email in their payload.

## Register flow

`POST /auth/register` with `{ email, password, name? }`:

1. Check the email is not already taken.
2. Hash the password with bcrypt.
3. Create the user row in the database.
4. Sign an access token and a refresh token.
5. Return `{ accessToken, refreshToken, user }`.

The `user` object carries `onboardingCompletedAt`, which is null for a fresh
account. The apps use that to send a new user through the first-run onboarding
before the app proper. See
[architecture/onboarding.md](./architecture/onboarding.md).

## Login flow

`POST /auth/login` with `{ email, password }`:

1. Find the user by email (and make sure they are not deleted).
2. Compare the password with the saved hash.
3. If it matches, sign the two tokens and return them.
4. If anything is wrong we throw `401 Unauthorized` with a generic "Invalid
   credentials" message (we don't say whether it was the email or the password,
   that would leak info).

## Refreshing the access token

`POST /auth/refresh` with `{ refreshToken }`:

1. Verify the refresh token with `JWT_REFRESH_SECRET`.
2. Make sure it really is a refresh token (`type === "refresh"`).
3. Make sure the account still exists and is not deleted.
4. Sign a new access token (15 min) and return it.

Note: we only give back a new access token here. The refresh token stays the
same, we do not rotate it.

## How a protected route is checked

Routes that need a logged in user use the guard:

```ts
@UseGuards(JwtAuthGuard)
```

The guard uses a Passport strategy (`passport-jwt`). The strategy:

1. Reads the token from the `Authorization: Bearer` header.
2. Verifies the signature with `JWT_SECRET` (expired tokens are rejected).
3. Checks the user still exists and is not deleted in the database.
4. Puts `{ userId, email }` on `request.user` so the controller can use it.

So inside a controller we can do `req.user.userId` to know who is calling.

## Where tokens are stored on the frontend

### Web (Next.js)

- The **access token** lives only in memory (inside the React auth context). It
  is never written to localStorage, so it cannot be stolen by random scripts.
- The **refresh token** is kept in an HttpOnly cookie. JavaScript cannot read
  it. We handle this in `packages/web/src/app/api/session/route.ts`:
  - `POST /api/session` saves the refresh token into the cookie after login.
  - `GET /api/session` reads the cookie, calls the API `/auth/refresh`, and
    gives back a fresh access token.
  - `DELETE /api/session` clears the cookie on logout.
- When the app first loads it calls `GET /api/session` to try to get an access
  token back from the cookie. If a request gets a `401`, the auth context tries
  one refresh and retries before logging the user out.

### Mobile (Expo)

The mobile store (`packages/mobile/src/store/auth.ts`, a small Zustand store)
works the same way as web:

- The **access token** lives only in memory on the store.
- The **refresh token** is saved in `expo-secure-store` (the phone's secure
  storage, the keychain on iOS), handled in
  `packages/mobile/src/lib/secure-store.ts`.
- On startup the store reads the saved refresh token, calls `/auth/refresh` to
  get an access token, and loads the user so the app opens already logged in.
- The client has a refresh handler wired in: if a request gets a `401` it tries
  one refresh and retries before logging the user out. Logout deletes the saved
  refresh token.

## Deleting an account (RGPD)

`DELETE /auth/me` (needs to be logged in):

1. Delete the user's stock items and OCR jobs.
2. Delete any receipt images still sitting in R2.
3. Anonymize and soft delete the user row (we blank the email and name, and set
   the password hash to `!deleted` which can never match a real bcrypt hash, so
   login becomes impossible).

This covers the "right to be forgotten" (RGPD Article 17).

## Rate limiting

The `register`, `login` and `refresh` endpoints are rate limited to 5 requests
per minute (using `@nestjs/throttler`). This makes brute force attacks much
harder.

## Env variables you need

These must be set in `packages/api/.env` (see `.env.example`):

```
JWT_SECRET=            # signs access tokens, generate with: openssl rand -base64 48
JWT_REFRESH_SECRET=    # signs refresh tokens, use a different value
```

## What about data isolation?

Every query in the stock and OCR services is filtered by `userId`, so a user
can only ever see their own data. We do this in the application code, not with
database Row-Level Security. There is more about this choice in
[CONCEPTION_DIVERGENCES.md](./CONCEPTION_DIVERGENCES.md).
