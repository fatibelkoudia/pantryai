# Cahier de recettes

This is the acceptance test book for PantryAI. It lists every scenario we run to
say the app works, with the exact steps and the result we expect. It covers all
the Must Have and Should Have features, plus the performance and RGPD checks.

This document is the eliminatory deliverable for competence C2.3.1, so each
scenario has to be reproducible by hand. When a scenario fails we open a bug and
track it in [plan-de-correction-des-bogues.md](./plan-de-correction-des-bogues.md);
the scenario only counts as passed once it runs green end to end.

## How to read a scenario

Every scenario has an ID like `CR-AUTH-01`, a priority (Must or Should), a
precondition, the steps to run, and the expected result. The results matrix at
the bottom is where we record pass/fail and the date.

| Field            | Meaning                                        |
| ---------------- | ---------------------------------------------- |
| ID               | `CR-<area>-<n>`, stable so bugs can link to it |
| Priorité         | Must or Should (from the MoSCoW list)          |
| Préconditions    | What has to be true before we start            |
| Étapes           | The actions, in order                          |
| Résultat attendu | What we should see if it passes                |

## Test environment

We run the recipe book against a clean stack so results are repeatable.

1. Start the dependencies and the API:

   ```bash
   docker compose up -d            # Postgres + Redis for local dev
   pnpm --filter @pantryai/api exec prisma migrate deploy
   pnpm --filter @pantryai/api dev
   ```

2. Start the web app: `pnpm --filter @pantryai/web dev` (http://localhost:3000).
3. For the API scenarios we use the Swagger UI at http://localhost:3001/api/docs
   or `curl`. Mobile scenarios use the Expo app on a device or simulator.
4. Seed data: a fresh database with no users. Each scenario that needs an account
   creates its own, so scenarios stay independent.

Two test accounts are used where isolation matters: **User A** and **User B**.

The API wraps every success response in `{ success: true, data: ... }` and every
error in `{ success: false, error: { code, message } }`, so the expected results
below describe the `data` or `error` part.

---

## 1. Authentication (Must)

### CR-AUTH-01 — Register a new account

- **Priorité:** Must
- **Préconditions:** No account exists for `test-a@example.com`.
- **Étapes:**
  1. `POST /auth/register` with `{ email, password }` (password ≥ 8 chars).
- **Résultat attendu:** 201. Response carries an `accessToken` and a
  `refreshToken`. The password is never returned.

### CR-AUTH-02 — Reject a duplicate email

- **Priorité:** Must
- **Préconditions:** CR-AUTH-01 has run (the email exists).
- **Étapes:**
  1. `POST /auth/register` again with the same email.
- **Résultat attendu:** 409 Conflict, error message says the email is taken. No
  second account is created.

### CR-AUTH-03 — Reject a weak or malformed payload

- **Priorité:** Must
- **Préconditions:** None.
- **Étapes:**
  1. `POST /auth/register` with an invalid email and a 3-character password.
- **Résultat attendu:** 400 Bad Request from the validation pipe, listing the
  fields that failed.

### CR-AUTH-04 — Log in with valid credentials

- **Priorité:** Must
- **Préconditions:** The account from CR-AUTH-01 exists.
- **Étapes:**
  1. `POST /auth/login` with the correct email and password.
- **Résultat attendu:** 200 with a fresh `accessToken` and `refreshToken`.

### CR-AUTH-05 — Reject wrong credentials

- **Priorité:** Must
- **Préconditions:** The account exists.
- **Étapes:**
  1. `POST /auth/login` with the right email and a wrong password.
- **Résultat attendu:** 401 Unauthorized. The message does not reveal whether the
  email exists.

### CR-AUTH-06 — Refresh an access token

- **Priorité:** Must
- **Préconditions:** We have a valid `refreshToken` from login.
- **Étapes:**
  1. `POST /auth/refresh` with the refresh token.
- **Résultat attendu:** 200 with a new access token.

### CR-AUTH-07 — A guarded route needs a token

- **Priorité:** Must
- **Préconditions:** None.
- **Étapes:**
  1. Call `GET /stocks` with no `Authorization` header.
- **Résultat attendu:** 401 Unauthorized. No data leaks.

### CR-AUTH-08 — Read the current profile

- **Priorité:** Must
- **Préconditions:** Logged in as User A.
- **Étapes:**
  1. `GET /auth/me` with the access token.
- **Résultat attendu:** 200 with the user's id and email, no password hash.

---

## 2. Products and stock (Must)

### CR-STOCK-01 — Create a product by hand

- **Priorité:** Must
- **Préconditions:** Logged in.
- **Étapes:**
  1. `POST /products` with a name, brand, and category.
- **Résultat attendu:** 201 with the new product id. This is the universal
  fallback for items not in any catalogue (risk F3).

### CR-STOCK-02 — Look a product up by barcode (Open Food Facts)

- **Priorité:** Must
- **Préconditions:** Logged in. The EAN exists in Open Food Facts.
- **Étapes:**
  1. `GET /products/ean/3017620422003` (a known EAN).
- **Résultat attendu:** 200 with the product name and brand pulled from Open Food
  Facts. A second call for the same EAN is served from the Redis cache.

### CR-STOCK-03 — Add a stock item

- **Priorité:** Must
- **Préconditions:** A product exists (CR-STOCK-01).
- **Étapes:**
  1. `POST /stocks` with the product id, quantity, unit, expiration date, and a
     location (`FRIDGE`, `FREEZER`, or `PANTRY`).
- **Résultat attendu:** 201 with the stock item, scoped to the current user.

### CR-STOCK-04 — List stock and filter by location

- **Priorité:** Must
- **Préconditions:** Several stock items in different locations.
- **Étapes:**
  1. `GET /stocks?location=FRIDGE`.
- **Résultat attendu:** 200 with only the fridge items.

### CR-STOCK-05 — Filter for items expiring soon

- **Priorité:** Must
- **Préconditions:** One item expiring within 3 days, one far in the future.
- **Étapes:**
  1. `GET /stocks?expiringSoon=true` (or the documented filter).
- **Résultat attendu:** 200 with only the soon-to-expire item.

### CR-STOCK-06 — Search stock by name

- **Priorité:** Must
- **Préconditions:** A stock item whose product name contains "lait".
- **Étapes:**
  1. `GET /stocks?search=lait`.
- **Résultat attendu:** 200 with the matching item(s) only.

### CR-STOCK-07 — Update and delete a stock item

- **Priorité:** Must
- **Préconditions:** A stock item exists.
- **Étapes:**
  1. `PATCH /stocks/:id` to change the quantity.
  2. `DELETE /stocks/:id`.
- **Résultat attendu:** The patch returns the new quantity. The delete returns
  success and the item no longer shows in `GET /stocks`.

### CR-STOCK-08 — Users cannot see each other's stock (isolation)

- **Priorité:** Must
- **Préconditions:** User A has a stock item. We have User B's token.
- **Étapes:**
  1. As User B, `GET /stocks/:id` with User A's item id.
- **Résultat attendu:** 404 (or 403). User B never reads User A's data. This is
  the application-layer user scoping, since the database is shared.

---

## 3. Receipt OCR pipeline (Must)

### CR-OCR-01 — Upload a receipt and get a job back

- **Priorité:** Must
- **Préconditions:** Logged in. A sample receipt image or PDF on disk.
- **Étapes:**
  1. `POST /ocr/scan` as multipart with the file.
- **Résultat attendu:** 202 Accepted with a `jobId` and status `PENDING`. The
  call returns straight away (the work is queued, never synchronous).

### CR-OCR-02 — Poll the job to completion

- **Priorité:** Must
- **Préconditions:** A job id from CR-OCR-01.
- **Étapes:**
  1. `GET /ocr/jobs/:id` every second until the status changes.
- **Résultat attendu:** The status moves `PENDING` → `PROCESSING` → `COMPLETED`,
  and the completed job carries the parsed line items.

### CR-OCR-03 — Confirm the parsed items into stock

- **Priorité:** Must
- **Préconditions:** A `COMPLETED` job with parsed items.
- **Étapes:**
  1. `POST /ocr/jobs/:id/confirm` with the items the user kept.
- **Résultat attendu:** 201/200. New stock items appear in `GET /stocks` for the
  user. Manual corrections take under 2 minutes (KPI).

### CR-OCR-04 — Native PDF parses without calling Mistral

- **Priorité:** Must
- **Préconditions:** A native (text-layer) Carrefour or Grand Frais PDF.
- **Étapes:**
  1. `POST /ocr/scan` with the PDF, then poll to `COMPLETED`.
- **Résultat attendu:** Items parse correctly and the logs show the text-layer
  fast path was used (zero Mistral OCR calls). Covered automatically by
  `pdf-text.spec.ts`.

### CR-OCR-05 — Scanned image falls back to Mistral

- **Priorité:** Must
- **Préconditions:** A photographed (image-only) receipt.
- **Étapes:**
  1. `POST /ocr/scan` with the image, poll to `COMPLETED`.
- **Résultat attendu:** Mistral OCR runs and the lines are parsed. If Mistral is
  unavailable the Tesseract fallback handles it (risk R4).

### CR-OCR-06 — The receipt image is deleted within 24h (RGPD)

- **Priorité:** Must
- **Préconditions:** A completed OCR job whose image went to R2.
- **Étapes:**
  1. Check the job: the `imageKey` is cleared right after processing.
  2. Confirm the daily sweep (`R2SweeperService`) removes anything older than 24h
     as a backstop.
- **Résultat attendu:** No receipt image survives past 24 hours in R2. The DB row
  no longer points at a deleted file.

### CR-OCR-07 — Retailer parsers read their format

- **Priorité:** Must
- **Préconditions:** Sample receipts for Carrefour, Leclerc, Lidl, Auchan, and
  Grand Frais.
- **Étapes:**
  1. Run the parser unit tests: `pnpm --filter @pantryai/api test`.
- **Résultat attendu:** Each retailer parser extracts the item lines for its
  format, filtering discount lines, and at least 85% of lines are usable (KPI).

---

## 4. QR e-ticket import (Must)

### CR-QR-01 — Import a dematerialized receipt by URL

- **Priorité:** Must
- **Préconditions:** Logged in. A receipt URL (loi AGEC e-ticket).
- **Étapes:**
  1. `POST /ocr/scan-qr` with the URL read from the QR code.
- **Résultat attendu:** 202 with a job id. The server fetches the URL, detects the
  format (PDF / HTML / JSON), routes it to the right parser, and the job completes
  like a normal scan.

---

## 5. Expiration alerts (Must)

### CR-ALERT-01 — Register a push device

- **Priorité:** Must
- **Préconditions:** Logged in on mobile.
- **Étapes:**
  1. `POST /devices/register` with the Expo push token.
- **Résultat attendu:** 201/200. The token is stored against the user.

### CR-ALERT-02 — The daily job flags items expiring within 3 days

- **Priorité:** Must
- **Préconditions:** A registered device and a stock item expiring within 3 days
  that has not been notified yet.
- **Étapes:**
  1. Trigger the check (call `checkExpiringItems` in a test, or wait for the 08:00
     cron in the background-job process).
- **Résultat attendu:** One summary push is sent per device, the message stays
  generic (no food names leave the server), and the item is marked notified so it
  is not sent twice.

---

## 6. Web frontend (Must)

### CR-WEB-01 — Register and log in from the web

- **Priorité:** Must
- **Préconditions:** Web app running.
- **Étapes:**
  1. Open `/register`, create an account, then log in at `/login`.
- **Résultat attendu:** After login we land on the dashboard. Protected pages
  redirect to `/login` when we are signed out.

### CR-WEB-02 — Dashboard and inventory render

- **Priorité:** Must
- **Préconditions:** Logged in with a few stock items.
- **Étapes:**
  1. Visit `/` (dashboard) and `/stocks`.
- **Résultat attendu:** The dashboard shows Trashy's mood and the inventory lists
  items with an expiration badge (green / yellow / red).

### CR-WEB-03 — Stock detail and receipt upload

- **Priorité:** Must
- **Préconditions:** Logged in.
- **Étapes:**
  1. Open a stock item at `/stocks/[id]`.
  2. Go to `/scan` and upload a receipt with the drag-and-drop uploader.
- **Résultat attendu:** The detail page shows the item and a conservation tip. The
  uploader shows progress and then the parsed items to confirm.

### CR-WEB-04 — Accessibility baseline (RGAA)

- **Priorité:** Must
- **Préconditions:** Web app running.
- **Étapes:**
  1. Tab through the login and stock pages with the keyboard.
  2. Run an automated accessibility check (axe) on the main pages.
- **Résultat attendu:** Focus order is sensible, form fields have labels, and the
  contrast meets the brand palette targets. No blocking violations.

---

## 7. Manual entry (Must)

### CR-MANUAL-01 — Add a product in under 10 seconds

- **Priorité:** Must
- **Préconditions:** Logged in on web or mobile.
- **Étapes:**
  1. Open the manual add form (`/stocks/new` on web).
  2. Fill name, quantity, unit, expiration, and location, then save.
- **Résultat attendu:** The item appears in the inventory. The whole add takes
  10 seconds or less (KPI, measured in CR-PERF-02).

---

## 8. Recipes (Should)

### CR-RECIPE-01 — Suggest recipes from what is in stock

- **Priorité:** Should
- **Préconditions:** Logged in with several stock items.
- **Étapes:**
  1. `GET /recipes/suggest`.
- **Résultat attendu:** 200 with recipes scored by `ingredients_in_stock /
ingredients_required`, only returning those at or above the 70% threshold. The
  scoring is deterministic, not an LLM. With no network, the local recipe set is
  used (risk R8).

---

## 9. Shopping list (Should)

### CR-SHOP-01 — Generate a list from low and expiring stock

- **Priorité:** Should
- **Préconditions:** Logged in with some low or expiring items.
- **Étapes:**
  1. `POST /shopping-list/generate`.
- **Résultat attendu:** 200 with suggested items from low stock and missing recipe
  ingredients.

### CR-SHOP-02 — Add, edit, and remove items by hand

- **Priorité:** Should
- **Préconditions:** A shopping list exists.
- **Étapes:**
  1. `POST /shopping-list`, then `PATCH /shopping-list/:id`, then
     `DELETE /shopping-list/:id`.
- **Résultat attendu:** Each change is reflected in `GET /shopping-list`.

---

## 10. Conservation tips (Should)

### CR-LEARN-01 — Get tips for a category

- **Priorité:** Should
- **Préconditions:** None (tips are public static content).
- **Étapes:**
  1. `GET /learning/tips?category=vegetables`.
- **Résultat attendu:** 200 with conservation tips for that category, sourced from
  ANSES/ADEME content. `GET /learning/tips/random` returns one random tip.

---

## 11. Trashy waste layer (delivered V1)

### CR-TRASHY-01 — Waste level score and mood

- **Priorité:** Should
- **Préconditions:** Logged in. Some items resolved as consumed, discarded, or
  expired over the last 30 days.
- **Étapes:**
  1. `GET /waste/level`.
- **Résultat attendu:** 200 with a score 0-100 = `consumed / (consumed +
discarded + expired)` over the trailing 30 days, plus a mood band
  (EXCELLENT ≥ 90, GOOD ≥ 70, OKAY ≥ 50, BAD ≥ 30, AWFUL < 30). A brand-new user
  with nothing resolved scores 100 / EXCELLENT.

### CR-TRASHY-02 — Challenges list

- **Priorité:** Should
- **Préconditions:** Logged in.
- **Étapes:**
  1. `GET /challenges`.
- **Résultat attendu:** 200 with the challenge definitions and the user's progress
  and XP.

---

## 12. Security and RGPD (Must)

### CR-RGPD-01 — Export my data (RGPD Article 20)

- **Priorité:** Must
- **Préconditions:** Logged in with some data.
- **Étapes:**
  1. `GET /users/me/export`.
- **Résultat attendu:** 200 with a structured dump of the user's account, stock,
  jobs, and lists in a portable format.

### CR-RGPD-02 — Delete my account (RGPD Article 17)

- **Priorité:** Must
- **Préconditions:** Logged in.
- **Étapes:**
  1. `DELETE /auth/me`.
  2. Try to log in again.
- **Résultat attendu:** The account and its data are removed. The follow-up login
  fails.

### CR-SEC-01 — Rate limiting returns 429

- **Priorité:** Must
- **Préconditions:** None.
- **Étapes:**
  1. Hammer an endpoint past the throttler limit (100 requests / minute).
- **Résultat attendu:** Once over the limit the API answers 429 Too Many Requests.

### CR-SEC-02 — Security headers and CORS

- **Priorité:** Must
- **Préconditions:** API running.
- **Étapes:**
  1. Inspect the response headers; try a cross-origin request from a disallowed
     origin.
- **Résultat attendu:** Helmet headers are present and the disallowed origin is
  rejected by CORS.

### CR-SEC-03 — No PII in logs

- **Priorité:** Must
- **Préconditions:** Run a scan and an alert through the system.
- **Étapes:**
  1. Read the server logs.
- **Résultat attendu:** No emails, names, or food items appear in the logs.

---

## 13. Performance (Must, eliminatory KPIs)

We measure with a warm stack (run each call a few times first), then take a sample
and compute the 95th percentile.

### CR-PERF-01 — OCR p95 under 5 seconds

- **Priorité:** Must
- **Préconditions:** A representative receipt (native PDF and a photo).
- **Méthode:**
  1. Submit 20 scans, recording the time from `POST /ocr/scan` to the job reaching
     `COMPLETED` (poll timestamps, or read the job's created/finished times).
  2. Sort the 20 durations and take the 19th value (p95).
- **Résultat attendu:** p95 ≤ 5 s. Native PDFs land well under this because they
  skip Mistral (text-layer fast path).

### CR-PERF-02 — Add a product in 10 seconds or less

- **Priorité:** Must
- **Préconditions:** Logged in on web.
- **Méthode:**
  1. Time the manual add flow from opening the form to the item showing in the
     list, 10 times. Take the p95.
- **Résultat attendu:** p95 ≤ 10 s.

### CR-PERF-03 — Barcode scan in one gesture under 2 seconds

- **Priorité:** Must
- **Préconditions:** Mobile app, a product barcode.
- **Méthode:**
  1. Time from pointing the camera to the prefilled add form appearing, several
     times.
- **Résultat attendu:** Under 2 seconds for an item found locally or in Open Food
  Facts (risk F1).

### CR-PERF-04 — Uptime and health

- **Priorité:** Must
- **Préconditions:** Production stack running.
- **Méthode:**
  1. `GET /health` returns `{ status: "ok", db: "up", redis: "up" }`.
  2. Uptime Robot polls `/health` and reports availability over a week.
- **Résultat attendu:** `/health` is green and measured availability is ≥ 99%.

---

## Results matrix

We fill this in on each test run. A release ships only when every Must scenario
passes.

| ID           | Feature               | Priorité | Résultat | Date | Bug |
| ------------ | --------------------- | -------- | -------- | ---- | --- |
| CR-AUTH-01   | Register              | Must     | ⬜       |      |     |
| CR-AUTH-02   | Duplicate email       | Must     | ⬜       |      |     |
| CR-AUTH-03   | Invalid payload       | Must     | ⬜       |      |     |
| CR-AUTH-04   | Login                 | Must     | ⬜       |      |     |
| CR-AUTH-05   | Wrong credentials     | Must     | ⬜       |      |     |
| CR-AUTH-06   | Refresh token         | Must     | ⬜       |      |     |
| CR-AUTH-07   | Guard blocks anon     | Must     | ⬜       |      |     |
| CR-AUTH-08   | Read profile          | Must     | ⬜       |      |     |
| CR-STOCK-01  | Create product        | Must     | ⬜       |      |     |
| CR-STOCK-02  | OFF lookup            | Must     | ⬜       |      |     |
| CR-STOCK-03  | Add stock             | Must     | ⬜       |      |     |
| CR-STOCK-04  | Filter by location    | Must     | ⬜       |      |     |
| CR-STOCK-05  | Expiring soon         | Must     | ⬜       |      |     |
| CR-STOCK-06  | Search                | Must     | ⬜       |      |     |
| CR-STOCK-07  | Update + delete       | Must     | ⬜       |      |     |
| CR-STOCK-08  | User isolation        | Must     | ⬜       |      |     |
| CR-OCR-01    | Upload returns job    | Must     | ⬜       |      |     |
| CR-OCR-02    | Poll to completion    | Must     | ⬜       |      |     |
| CR-OCR-03    | Confirm into stock    | Must     | ⬜       |      |     |
| CR-OCR-04    | Native PDF, 0 Mistral | Must     | ⬜       |      |     |
| CR-OCR-05    | Image falls back      | Must     | ⬜       |      |     |
| CR-OCR-06    | Image deleted ≤ 24h   | Must     | ⬜       |      |     |
| CR-OCR-07    | Retailer parsers      | Must     | ⬜       |      |     |
| CR-QR-01     | QR e-ticket import    | Must     | ⬜       |      |     |
| CR-ALERT-01  | Register device       | Must     | ⬜       |      |     |
| CR-ALERT-02  | Daily expiry alert    | Must     | ⬜       |      |     |
| CR-WEB-01    | Web auth              | Must     | ⬜       |      |     |
| CR-WEB-02    | Dashboard + inventory | Must     | ⬜       |      |     |
| CR-WEB-03    | Detail + upload       | Must     | ⬜       |      |     |
| CR-WEB-04    | Accessibility         | Must     | ⬜       |      |     |
| CR-MANUAL-01 | Manual add            | Must     | ⬜       |      |     |
| CR-RECIPE-01 | Recipe suggest        | Should   | ⬜       |      |     |
| CR-SHOP-01   | Generate list         | Should   | ⬜       |      |     |
| CR-SHOP-02   | List CRUD             | Should   | ⬜       |      |     |
| CR-LEARN-01  | Conservation tips     | Should   | ⬜       |      |     |
| CR-TRASHY-01 | Waste level           | Should   | ⬜       |      |     |
| CR-TRASHY-02 | Challenges            | Should   | ⬜       |      |     |
| CR-RGPD-01   | Data export           | Must     | ⬜       |      |     |
| CR-RGPD-02   | Account deletion      | Must     | ⬜       |      |     |
| CR-SEC-01    | Rate limit            | Must     | ⬜       |      |     |
| CR-SEC-02    | Headers + CORS        | Must     | ⬜       |      |     |
| CR-SEC-03    | No PII in logs        | Must     | ⬜       |      |     |
| CR-PERF-01   | OCR p95 ≤ 5s          | Must     | ⬜       |      |     |
| CR-PERF-02   | Add ≤ 10s             | Must     | ⬜       |      |     |
| CR-PERF-03   | Scan ≤ 2s             | Must     | ⬜       |      |     |
| CR-PERF-04   | Uptime ≥ 99%          | Must     | ⬜       |      |     |

Legend: ⬜ not run · ✅ pass · ❌ fail (open a bug and link it).

## Acceptance

The app is accepted for this phase when every Must scenario is ✅ and the Should
scenarios are ✅ or have a tracked, non-blocking bug. Any ❌ on a Must scenario is
a release blocker.
