# PantryAI — Claude Code Project Memory

Lead developer on PantryAI: food stock management + waste reduction app.
Solo-developer project for RNCP39583 certification (Expert en Développement Logiciel).

## Stack (2026)

- Monorepo: pnpm + Turborepo (packages: web, mobile, api, shared)
- Web: Next.js 16.2 (App Router only — never Pages Router; Turbopack — never Webpack), TypeScript, Tailwind CSS
- Mobile: Expo SDK 55, React Native 0.83, Expo Router
- API: NestJS 11, Prisma 7 ORM (Rust-free), PostgreSQL 17 (Supabase), BullMQ + Redis
- OCR: Mistral OCR (primary — EU data sovereignty), Tesseract.js (local fallback)
- Recipes: TheMealDB API + local JSON fallback
- Auth: Supabase Auth (JWT) — Storage: Cloudflare R2 (ephemeral receipt images) — Node.js 22.x LTS

## Prisma 7 Rules

- Generator: prisma-client (NOT prisma-client-js); engine: client (Rust-free TypeScript)
- Output: src/generated/prisma/ (NEVER into node_modules)
- Requires driver adapter: @prisma/adapter-pg + pg
- ESM-first: use .js extensions in imports from generated client

## Coding Standards

- TypeScript strict mode everywhere; Prettier + ESLint
- camelCase vars/functions, PascalCase classes/components, UPPER_SNAKE env vars
- Named exports only — never default exports
- Imports: absolute via tsconfig paths (@pantryai/shared, @pantryai/api)
- Tests: Vitest + Supertest (API), React Testing Library (web), Detox (mobile E2E)
- Conventional Commits; branches: main → develop → feature/_, fix/_, chore/\*

## Architecture Rules

- Every NestJS module: controller + service + dto + entity, self-contained
- Prisma is the ONLY data access layer — never raw SQL, never TypeORM
- All OCR processing through BullMQ queue — never synchronous in API
- Every API endpoint: DTO validation (class-validator), auth guard, Swagger decorator
- Mobile and web share types via @pantryai/shared package

## Security & RGPD

- Never log PII (email, names, food consumption data)
- Never commit .env files or API keys
- OCR images ephemeral: process → extract → delete from R2 within 24h
- Mistral OCR only — never Google Vision or AWS Textract (RGPD/Cloud Act risk)
- User data deletion endpoint required (RGPD Article 17)
- Supabase RLS enabled on all user-facing tables

## Future Improvements

Out-of-scope ideas and v2 features live in `FUTURE.md` at the repo root.
Check it before proposing improvements; add new out-of-scope ideas there instead of implementing them unsolicited.
