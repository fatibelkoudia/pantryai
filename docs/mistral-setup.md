# Setting up Mistral OCR (reading receipts)

Once the receipt image is in R2, the OCR worker pulls it and sends it to Mistral to get the text
back, then parses the items out of that text. If Mistral fails for some reason, we fall back to
Tesseract.js running locally (see `packages/api/src/ocr/ocr.processor.ts`).

We use Mistral on purpose. It is a French / EU company, so the receipt data stays with an EU
provider and we keep our EU data sovereignty. That is also why we do not use US options like
Google Vision or AWS Textract.

## Env var we need

The API validates this at boot in `packages/api/src/config/env.validation.ts`, so it will not
start if the key is missing:

- `MISTRAL_API_KEY`

## Models we call

Good to know so we recognise them on the bill / in the logs:

- `mistral-ocr-latest` for the actual OCR (both images and PDFs)
- `mistral-small-latest` for the chat step that works out which store the receipt is from and helps
  parse the items

## Steps

1. Go to `https://console.mistral.ai` and sign in. This opens Mistral Studio. There is already a
   "Default Workspace" set up for us, so we do not need to create one. The free tier it comes with
   covers what we need here, it just has some rate limits which are fine for our usage, so we do
   not need a paid plan.

2. Create the API key. In the left sidebar click **Clés API** (API Keys), or use the
   **Créer une clé API** (Create an API key) shortcut on the home page.

3. Click create, give the key a name, and copy it. Treat it like a password, it is only shown once.

4. Add it to `packages/api/.env` (this file is gitignored, never commit it):

   ```dotenv
   MISTRAL_API_KEY=<your-mistral-api-key>
   ```

5. Restart and check:

   ```bash
   cd packages/api && pnpm dev
   ```

   Boot should pass env validation. Then upload a receipt at `/scan` and the OCR job should go
   PENDING, PROCESSING, COMPLETED, with the items showing up in the stock list.

## Notes

- If the key is wrong or the call fails, the worker logs a warning and falls back to Tesseract,
  which still works but gives lower quality text.
- The boot validator only checks that the var is not empty, so for local dev we can put any
  placeholder value to start the API. Real Mistral calls will then fail and fall back to Tesseract,
  which is fine for testing the pipeline without a real key.
- We do not log the receipt text long term. It is used to extract items and then cleared, so we are
  not keeping personal data around longer than needed.
