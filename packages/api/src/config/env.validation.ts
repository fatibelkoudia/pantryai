import { z } from 'zod';

/**
 * Env vars needed by the API.
 * Required secrets/URLs fail fast on boot if missing.
 * Redis keeps local defaults.
 */
const envSchema = z.object({
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
  DATABASE_TRANSACTION_POOLER_URL: z.string().min(1, 'DATABASE_TRANSACTION_POOLER_URL is required'),
  MISTRAL_API_KEY: z.string().min(1, 'MISTRAL_API_KEY is required'),
  R2_ENDPOINT: z.string().min(1, 'R2_ENDPOINT is required'),
  R2_ACCESS_KEY_ID: z.string().min(1, 'R2_ACCESS_KEY_ID is required'),
  R2_SECRET_ACCESS_KEY: z.string().min(1, 'R2_SECRET_ACCESS_KEY is required'),
  R2_BUCKET_NAME: z.string().min(1, 'R2_BUCKET_NAME is required'),
  REDIS_HOST: z.string().min(1).default('localhost'),
  REDIS_PORT: z.string().regex(/^\d+$/, 'REDIS_PORT must be a number').default('6379'),
  // Set by managed Redis (Railway); unset locally where Redis has no auth.
  REDIS_PASSWORD: z.string().optional(),
  // Error monitoring. Optional: when SENTRY_DSN is unset, Sentry stays a no-op,
  // so local and dev runs don't send anything.
  SENTRY_DSN: z.string().optional(),
  // Set on the worker container so it picks up OCR jobs. The API container leaves
  // this off (or 'false') so the two don't process the same job twice.
  RUN_OCR_WORKER: z.string().optional(),
  // Basic-auth credentials for the BullMQ dashboard at /admin/queues. If either
  // is missing the dashboard is not mounted (so it's never open by accident).
  BULLBOARD_USER: z.string().optional(),
  BULLBOARD_PASSWORD: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validate env vars at startup.
 * Used by ConfigModule.forRoot({ validate }).
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.map(String).join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${details}`);
  }

  return result.data;
}
