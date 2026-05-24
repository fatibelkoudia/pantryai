# Setting up Cloudflare R2 (receipt images)

The OCR pipeline uploads the receipt photo to Cloudflare R2 (S3 compatible), processes it, and
then deletes it. The API builds an AWS S3 client with `region: 'auto'` and our `R2_ENDPOINT`
(see `packages/api/src/ocr/ocr.service.ts` and `ocr.processor.ts`).

## Important: pick the EU jurisdiction

When we create the bucket we have to choose "Specify jurisdiction" and set it to
**European Union (EU)**. Receipts are personal data (they show what someone bought, where and
when), so under RGPD we keep that data in the EU. This also keeps us aligned with our EU data
sovereignty goal and avoids US Cloud Act exposure.

Two things to remember:

- The jurisdiction is set once when the bucket is created and we cannot change it afterwards. If
  we forget it, we have to delete the bucket and make a new one.
- An EU bucket uses a different endpoint host with `.eu` in it (see step 3).

## Env vars we need

The API validates these at boot in `packages/api/src/config/env.validation.ts`, so it will not
start if any of them are missing:

- `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

## Steps

1. Enable R2. In the Cloudflare dashboard go to **R2 Object Storage** and click Get started /
   Enable. It asks for a card, but there is a free tier (10 GB storage, generous Class A/B ops)
   and no egress fees.

2. Create the bucket. R2 > Create bucket, name it `pantryai` (this is `R2_BUCKET_NAME`).
   Under location choose **Specify jurisdiction > European Union (EU)**. Leave public access OFF
   (the API talks to it with authenticated S3 calls, nothing is public).

3. Get the endpoint. Copy the **Account ID** from the R2 overview page. Because we picked the EU
   jurisdiction, the host has `.eu` in it:

   ```
   R2_ENDPOINT=https://<ACCOUNT_ID>.eu.r2.cloudflarestorage.com
   ```

   (A normal bucket would be `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, but we want the EU
   one. There is no bucket name in the URL.)

4. Create S3 credentials. R2 > API > **Manage API Tokens > Create API Token** (the R2 S3
   credentials token, not a generic Cloudflare API token):
   - Permission: **Object Read & Write**
   - Scope: **specific buckets > `pantryai`** (least privilege)
   - It shows the keys once:
     - Access Key ID goes to `R2_ACCESS_KEY_ID`
     - Secret Access Key goes to `R2_SECRET_ACCESS_KEY`

   Copy them now, the secret is only shown one time.

5. Add them to `packages/api/.env` (this file is gitignored, never commit it):

   ```dotenv
   R2_ENDPOINT=https://<ACCOUNT_ID>.eu.r2.cloudflarestorage.com
   R2_ACCESS_KEY_ID=<access-key-id>
   R2_SECRET_ACCESS_KEY=<secret-access-key>
   R2_BUCKET_NAME=pantryai
   ```

6. Restart and check:

   ```bash
   cd packages/api && pnpm dev
   ```

   Boot should pass env validation (no more `R2_* is required`). Then upload a receipt at `/scan`
   and the OCR job should go PENDING, PROCESSING, COMPLETED instead of failing on the R2 upload.

## Notes

- We store receipt images only temporarily and delete them after processing (RGPD data lifecycle,
  the `ocr.processor` removes the object on terminal jobs), so the bucket stays almost empty.
- If an upload fails with `SignatureDoesNotMatch`, double check the endpoint host (Account ID plus
  the `.eu` part) and that the token has write access on that exact bucket.
- For local dev without R2 we can boot the API with placeholder values
  (`R2_ENDPOINT=x R2_ACCESS_KEY_ID=x R2_SECRET_ACCESS_KEY=x R2_BUCKET_NAME=x pnpm dev`). Everything
  works except the receipt upload and OCR.
