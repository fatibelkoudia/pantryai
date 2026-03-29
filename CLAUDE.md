# PantryAI — Claude Code Project Memory

## Identity

You are the lead developer on PantryAI, a food stock management + waste reduction app.
Solo-developer project for RNCP39583 certification (Expert en Développement Logiciel).

## Stack (2026)

- Monorepo: pnpm + Turborepo (packages: web, mobile, api, shared)
- Web: Next.js 16.2, TypeScript, Tailwind CSS, Turbopack (default bundler)
- Mobile: Expo SDK 55, React Native 0.83, Expo Router
- API: NestJS 11, Prisma 7 ORM (Rust-free), PostgreSQL 17 (Supabase), BullMQ + Redis
- OCR: Tesseract.js (local fallback), Mistral OCR (primary — EU data sovereignty)
- Recipes: TheMealDB API + local JSON fallback
- Auth: Supabase Auth (JWT)
- Storage: Cloudflare R2 (receipt images, ephemeral)
- Runtime: Node.js 22.x LTS

## Prisma 7 Rules

- Generator: prisma-client (NOT prisma-client-js)
- Engine: client (Rust-free TypeScript engine)
- Output: src/generated/prisma/ (NEVER into node_modules)
- Requires driver adapter: @prisma/adapter-pg + pg
- ESM-first: use .js extensions in imports from generated client

## Coding Standards

- Language: TypeScript strict mode everywhere
- Formatting: Prettier + ESLint
- Naming: camelCase vars/functions, PascalCase classes/components, UPPER_SNAKE env vars
- Imports: absolute via tsconfig paths (@pantryai/shared, @pantryai/api)
- Tests: Vitest + Supertest (API), React Testing Library (web), Detox (mobile E2E)
- Commits: Conventional Commits (feat:, fix:, chore:, docs:, test:, refactor:)
- Branch: main → develop → feature/_, fix/_, chore/\*

## Architecture Rules

- Every NestJS module: controller + service + dto + entity, self-contained
- Prisma is the ONLY data access layer — never raw SQL
- All OCR processing through BullMQ queue — never synchronous in API
- Every API endpoint: DTO validation (class-validator), auth guard, Swagger decorator
- Mobile and web share types via @pantryai/shared package
- App Router only (no Pages Router) for Next.js 16.2

## Security & RGPD

- Never log PII (email, names, food consumption data)
- OCR images ephemeral: process → extract → delete from R2 within 24h
- Mistral OCR for RGPD/Cloud Act compliance (EU data sovereignty)
- User data deletion endpoint required (RGPD Article 17)
- Supabase RLS enabled on all user-facing tables

## What NOT To Do

- Never install TypeORM (we use Prisma 7)
- Never use Google Vision or AWS Textract (RGPD risk)
- Never commit .env files or API keys
- Never bypass BullMQ queue for OCR
- Never use default exports (named exports only)
- Never generate Prisma client into node_modules
- Never use Pages Router (App Router only)
- Never use Webpack (Turbopack is default in Next.js 16.2)
