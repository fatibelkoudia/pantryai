# PantryAI — Future Improvements & v2 Backlog

This file tracks ideas, improvements, and features that are intentionally out of scope for this project but worth implementing in a future version.

This is the raw backlog: anything goes in here, evidence or not.

---

## v2 — OCR & Parsing Quality

### French Food Lexicon Lookup (post-OCR correction)

**Why:** Thermal paper fading causes systematic character-level OCR errors that even Mistral OCR cannot recover, for example `CLIVES VERTES` → `OLIVES VERTES`, `CAMDIN` → `CANDIA`, `UNAND` → `GRAND`. These are C/O, M/N, U/G confusions from faded ink.
**Approach:** After OCR extraction, run each product name through a fuzzy-match lookup against a curated French food lexicon (e.g. Open Food Facts product names, filtered to common supermarket items). Use Levenshtein distance ≤ 2 to auto-correct with high confidence.
**Libraries to evaluate:** `fastest-levenshtein`, `fuse.js`, or a pre-built French food NER model.
**Constraint:** Must be fast enough to run synchronously in the BullMQ processor (< 50 ms per receipt). Pre-load lexicon into memory at worker startup.

### Confidence Calibration with Ground Truth

**Why:** Current confidence scores (0.75–0.95) are hand-tuned heuristics. Once real expected.json fixtures are validated, train a simple logistic regression or decision tree on features (name length, price range, regex match quality) to emit calibrated probabilities.

### Auchan Name De-truncation

**Why:** Auchan OCR truncates all product names to ~18 chars with `..` suffix (e.g. `AUCHAN VRAC VANILL..`). The `*AUCHAN ` prefix is also stripped. Consider fetching full product name from Open Food Facts by EAN-13 when available.

### Leclerc Category Header Expansion

**Why:** The `CATEGORY_HEADERS` Set covers 18 known values but Leclerc stores vary regionally. Add a fallback: if a line is all-uppercase, no price, and appears between known product lines, treat as a category header even if unknown.

### Expiration Date Extraction from Text Receipts

**Why:** The QR/JSON path already reads a `dlc` / `ddm` field when the retailer sends one, and `ParsedReceiptItem.expirationDate` pre-fills `StockItem.expirationDate`. What is missing is the same thing for photographed receipts: none of the text parsers look for a date line today.
**Approach:** After product line parsing, look for a following line matching `/DLC[:\s]*(\d{2}\/\d{2}\/\d{4})/i` or `/à consommer avant/i`. Fresh produce from Grand Frais and Lidl is where this pays off.

---

## v2 — Mobile

### QR Receipt Scanning

**Why:** We removed the "Ticket QR" mode from the mobile scan screen because French supermarket receipts do not carry a QR code that links to a digital receipt yet. The plumbing still exists (the `POST /ocr/scan-qr` endpoint and `scanQrReceipt` in the shared API client), so when retailers start printing them (loi AGEC is pushing digital receipts, Monoprix already experiments with one) we can bring the mode back by adding a `qr` case to the scan screen and pointing it at that endpoint.

### Detox E2E

**Why:** No E2E framework configured. Add Detox for the scan → result → add-to-stock happy path.

---

## v2 — New Retailer Parsers

### Intermarché Parser

**Format:** Plain text, product name left-aligned, price right-aligned with French comma. Similar to GenericParser but with known category headers (BOUCHERIE, EPICERIE SALEE, etc.).

### Monoprix Parser

**Format:** Two-column layout with category codes. Monoprix uses a QR code on receipts (loi AGEC) that returns JSON, so the QR path may already work via `parseJsonReceipt`.

### Franprix Parser

**Format:** Similar to Lidl plain-text but with different discount notation (`-X,XX EUR` instead of `REMISE`).

---

## v2 — Product Enrichment

### Open Food Facts Enrichment Pass

**Why:** `GET /products/ean/:ean13` already falls back to Open Food Facts when we don't know an EAN, so the lookup itself is done. What is missing is the enrichment pass: parser output still gives truncated product names (Carrefour and Auchan both cut at 18 chars), and nothing goes back to fill them in.
**Approach:** A `ProductEnrichmentService` called after `upsertStockItems` when an EAN-13 is present and `nutritionData` is null, fetching full name, category, nutrition data, and image. Cache the response on the `products` row so we don't re-ask for the same barcode.
**Constraint:** Must stay RGPD-safe (Open Food Facts is an EU open database). Rate limit: 1 req/s.

### Nutri-Score Display

**Why:** Open Food Facts provides Nutri-Score (A–E). Display on product cards in mobile and web.

---

## v2 — Stock Intelligence

### Low-Stock Push Alerts

**Why:** Expo Push is wired up and the daily cron already sends expiration alerts, and `lowStockThreshold` already exists as a user setting. But the threshold only feeds shopping-list generation, it never triggers a notification. Reuse the same push service to warn when an item drops below the threshold, ideally batched into the existing 8am job instead of adding a second one.

### Per-Product CO2 Factors

**Why:** The "CO2 avoided" stat uses five Agribalyse category averages (api `waste/co2-estimate.ts`). Agribalyse publishes per-product footprints and Open Food Facts exposes them by EAN, so once the OFF enrichment lands we could store the exact factor on the product and make the estimate much sharper. Same for piece weights: we assume 250 g per piece today, OFF has real net weights.

### Category Filter Chip on Inventory

**Why:** The inventory screen has freshness and location chips, but the mock also shows a "Category" dropdown chip. Products carry a free-text `category`, so we would need a small picker (action sheet) fed by the distinct categories currently in stock.

### Learn extras: locked lessons, social, streak freezes

**Why:** Lessons with quizzes and XP, level titles, a daily streak and weekly challenges shipped with the Learn revamp. What remains from the mock and beyond: locked lessons that unlock in order (today every lesson is open from the start), the "Social" tab with shared challenges (a much bigger feature), streak freezes or reminders so a missed day hurts less, and spaced repetition that resurfaces lessons the user got wrong.

---

## v2 — API Hardening

### Typed Processor Errors

**Why:** The global exception filter handles the HTTP side, but `ocr.processor.ts` still throws bare `Error()` for everything: HTTP status from a remote URL, the 5 MB size cap, the SSRF guard. They all end up looking the same in the job's `error` column, so we can't tell a user mistake from an attack attempt without reading the message string. Typed error classes for the OCR pipeline would let the processor decide what is retryable and what should fail the job outright.

---

## v2 — Monitoring & Ops

These came out of auditing the monitoring setup. They are the gaps `docs/monitoring.md`
admits to, in the order we would close them.

### Crash reporting on the Android app

**Why:** There is no crash reporting on the client, so an APK crash produces no signal
at all: no Sentry event, no log, nothing in `/health`. Of everything we watch, mobile
is the only component where a total failure can go unnoticed indefinitely. Testers only
tell us when they remember to.
**Approach:** `@sentry/react-native` in `packages/mobile`, second Sentry project, reuse
the scrubbing rules already written for the API in `instrument.ts`. Enable only on the
`preview` and `production` EAS profiles so dev noise stays out.

### Worker errors never reach Sentry

**Why:** `Sentry.captureException` is called in exactly one place, the HTTP exception
filter. The OCR processor catches its own errors, logs them and marks the job `FAILED`
without telling Sentry. So a failure in the OCR pipeline shows up in the BullMQ
counters and nowhere else, which is the part of the product that fails quietly.
**Approach:** One `Sentry.captureException(err)` in the processor's catch, on the
final-attempt branch so intermediate retries that will succeed do not report.

### Alert when the OCR queue backs up

**Why:** The dashboard shows waiting and failed counts but nothing tells us when they
grow. We find out by opening the page, so up to a day of scans could be failing first.
**Approach:** A scheduled job that reads the counters and fails loudly when `waiting`
stays above a threshold across two runs, or `failed` grows between runs. Same shape as
`supabase-keepalive.yml`, so no new alerting service.

### Structured logging

**Why:** We use the NestJS `Logger`, so production logs are plain text with no
aggregation, no search and no retention. Investigating anything older than a container
recycle is guesswork, and it slowed down every one of the 1.0.0 production fixes.
**Approach:** `nestjs-pino` for JSON logs with a request id, redaction configured on the
same fields the Sentry `beforeSend` already strips so the RGPD position is unchanged.

### A metrics endpoint

**Why:** The performance KPIs are read by hand off the BullMQ dashboard, so we have
numbers for a test window and nothing continuous. Worth doing after the queue alert
above, which delivers most of the benefit for less work.
**Approach:** `/metrics` exposing OCR durations and queue depth.

### Delete the dead deploy job

**Why:** The `api` job in `deploy.yml` deploys over SSH to a self-managed VPS we decided
not to build. It also health-checks `/api/docs` rather than `/health`, and Swagger
answers even when the database is unreachable, so its automatic rollback would pass a
deploy that came up broken. Keep the `web` job, drop the rest.

---

## v2 — Infrastructure

### docker-compose.test.yml with Automatic Migration

**Why:** CI applies the schema itself (the `integration` job runs `prisma migrate deploy` before the suite), so this is a local convenience only: `docker-compose.test.yml` brings up `postgres_test` and `redis_test` but leaves you to run the migration by hand before the first local integration run. A `migrate` service that runs on startup would remove that step.

### Receipt Image Redaction Script

**Why:** Before committing fixture images to the repo, PII (cardholder name, loyalty card, payment digits) must be redacted. Automate with ImageMagick: draw black rectangles over known PII zones based on retailer format.

---

## v2 — Repo Health

### Commit Hooks (husky + lint-staged + commitlint)

**Why:** Conventional Commits and Prettier are conventions only, nothing enforces them locally. CI catches a bad commit after the push, a hook would catch it before.
