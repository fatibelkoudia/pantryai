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
