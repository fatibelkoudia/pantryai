# PantryAI API reference

This is a written summary of the API. The live, always-up-to-date version is the
Swagger page the API serves at `/api/docs` (for example
http://localhost:3001/api/docs in development). Swagger is generated from the
code, so when in doubt, trust it over this file.

## Basics

- Base URL in development: `http://localhost:3001`
- All request and response bodies are JSON, except receipt upload which is
  `multipart/form-data`.
- Most endpoints need a bearer token: `Authorization: Bearer <accessToken>`.

### Response shape

Every response uses the same envelope. On success:

```json
{ "success": true, "data": { ... } }
```

On error:

```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "..." } }
```

The `code` is the HTTP status name (for example `BAD_REQUEST`, `UNAUTHORIZED`,
`NOT_FOUND`). We never leak stack traces or internal details in the message.

### Auth and tokens

You get an access token (short lived) and a refresh token (longer lived) when you
register or log in. Send the access token on each request. When it expires, call
`POST /auth/refresh` to get a new one. The web app keeps the refresh token in an
HttpOnly cookie and the mobile app keeps it in secure storage.

### Rate limiting

Login, register, and refresh are limited to 5 requests per minute. Everything
else shares a general limit of 100 requests per minute.

## Endpoints by area

### Auth (`/auth`)

| Method | Path             | Auth | What it does                                                                          |
| ------ | ---------------- | ---- | ------------------------------------------------------------------------------------- |
| POST   | `/auth/register` | no   | Create an account, returns tokens                                                     |
| POST   | `/auth/login`    | no   | Log in, returns tokens                                                                |
| POST   | `/auth/refresh`  | no   | Swap a refresh token for a new access token                                           |
| GET    | `/auth/me`       | yes  | The current user's profile                                                            |
| DELETE | `/auth/me`       | yes  | Delete the account (RGPD Article 17): anonymize, cascade delete, purge pending images |

### Users (`/users`)

| Method | Path               | Auth | What it does                                                                                  |
| ------ | ------------------ | ---- | --------------------------------------------------------------------------------------------- |
| GET    | `/users/me/export` | yes  | Export the user's data as JSON (RGPD Article 20): profile, stock, OCR job metadata, no images |

### Products (`/products`)

The product catalogue is shared across users. It is filled from Open Food Facts
lookups and manual entries.

| Method | Path                   | Auth | What it does                                                  |
| ------ | ---------------------- | ---- | ------------------------------------------------------------- |
| GET    | `/products`            | no   | List products, supports `search` (name) and pagination        |
| GET    | `/products/ean/:ean13` | no   | Look up a product by barcode (uses the Open Food Facts cache) |
| GET    | `/products/:id`        | no   | One product                                                   |
| POST   | `/products`            | yes  | Create a product                                              |
| PATCH  | `/products/:id`        | yes  | Update a product                                              |
| DELETE | `/products/:id`        | yes  | Delete a product                                              |

### Stock (`/stocks`)

Everything here is scoped to the logged-in user.

| Method | Path          | Auth | What it does                                                                                    |
| ------ | ------------- | ---- | ----------------------------------------------------------------------------------------------- |
| GET    | `/stocks`     | yes  | List the user's stock, supports filters (location, expiring soon, search)                       |
| GET    | `/stocks/:id` | yes  | One stock item                                                                                  |
| POST   | `/stocks`     | yes  | Add a stock item                                                                                |
| PATCH  | `/stocks/:id` | yes  | Update a stock item                                                                             |
| DELETE | `/stocks/:id` | yes  | Remove a stock item, optional `?disposition=CONSUMED\|DISCARDED\|EXPIRED` feeds the waste score |

### OCR / receipts (`/ocr`)

Receipt scanning is asynchronous. You upload, you get a job id, you poll the job.

| Method | Path                    | Auth | What it does                                                             |
| ------ | ----------------------- | ---- | ------------------------------------------------------------------------ |
| POST   | `/ocr/scan`             | yes  | Upload a receipt image or PDF (multipart, up to 10 MB), returns a job id |
| POST   | `/ocr/scan-qr`          | yes  | Import an e-ticket from a QR code URL (JSON, PDF, or HTML)               |
| GET    | `/ocr/jobs/:id`         | yes  | Job status and the parsed items                                          |
| POST   | `/ocr/jobs/:id/confirm` | yes  | Confirm the parsed items and add them to stock (only works once per job) |

### Recipes (`/recipes`)

| Method | Path               | Auth | What it does                                                                                     |
| ------ | ------------------ | ---- | ------------------------------------------------------------------------------------------------ |
| GET    | `/recipes/suggest` | yes  | Recipes you can mostly make from your stock (score of 70% or more), with the missing ingredients |

### Shopping list (`/shopping-list`)

| Method | Path                      | Auth | What it does                                                                     |
| ------ | ------------------------- | ---- | -------------------------------------------------------------------------------- |
| GET    | `/shopping-list`          | yes  | The user's shopping list                                                         |
| POST   | `/shopping-list/generate` | yes  | Build a list from low or expiring stock plus missing recipe ingredients, deduped |
| POST   | `/shopping-list`          | yes  | Add an item by hand                                                              |
| PATCH  | `/shopping-list/:id`      | yes  | Check or uncheck an item                                                         |
| DELETE | `/shopping-list/:id`      | yes  | Remove an item                                                                   |

### Learning / conservation tips (`/learning`)

These tips are static reference content based on ANSES and ADEME guidance, so the
endpoints are public.

| Method | Path                    | Auth | What it does                                    |
| ------ | ----------------------- | ---- | ----------------------------------------------- |
| GET    | `/learning/tips`        | no   | Conservation tips, optional `?category=` filter |
| GET    | `/learning/tips/random` | no   | One random tip (used for "Today's Tip")         |

### Waste level (`/waste`)

| Method | Path           | Auth | What it does                                                                                |
| ------ | -------------- | ---- | ------------------------------------------------------------------------------------------- |
| GET    | `/waste/level` | yes  | The waste score (0 to 100), the Trashy mood, and the counts behind it over the last 30 days |

The score is `consumed / (consumed + discarded + expired)`, as a percentage, over
the trailing 30 days. A user with nothing resolved yet starts at 100.

### Gamification (`/challenges`)

| Method | Path          | Auth | What it does                                              |
| ------ | ------------- | ---- | --------------------------------------------------------- |
| GET    | `/challenges` | yes  | The user's XP total and progress on each Trashy challenge |

### Devices (`/devices`)

| Method | Path                | Auth | What it does                                                     |
| ------ | ------------------- | ---- | ---------------------------------------------------------------- |
| POST   | `/devices/register` | yes  | Register an Expo push token so the device gets expiration alerts |

## Notes on privacy

- We never log personal data (emails, names, what people eat).
- Receipt images are deleted from storage within 24 hours, and a daily sweep
  removes anything that slipped through.
- Push notifications only carry a count, never the names of the food items.
