#!/bin/bash
# ============================================================
# PantryAI Development Workflow — Step by Step
# Run each prompt in the Claude Code Spark panel (Antigravity)
# Aligned with Gantt Phase 4: Développement (2 Mar – 22 May 2026)
# ============================================================

# ============================================================
# PHASE 4.1 — Dev Environment Setup (2 Mar → 5 Mar)
# You've already done the monorepo init. Now finish setup.
# ============================================================

# STEP 1: Docker + local services
# Prompt in Claude Code:
<<'PROMPT'
Set up Docker Compose for local development with:
- PostgreSQL 17 (port 5432, database: pantryai_dev)
- Redis 7 (port 6379, for BullMQ)
- Volumes for data persistence

Create docker-compose.yml at the project root.
Also create docker-compose.test.yml with isolated test database.
Add scripts to package.json: "docker:up", "docker:down", "docker:reset"
PROMPT

# STEP 2: Prisma 7 setup
# Prompt:
<<'PROMPT'
Set up Prisma 7 in packages/api:
- Install prisma, @prisma/client, @prisma/adapter-pg, pg
- Create prisma/schema.prisma with:
  - Generator: prisma-client (NOT prisma-client-js)
  - Output: ../src/generated/prisma/
  - Datasource: postgresql with env("DATABASE_URL")
- Create the PrismaService in NestJS using the driver adapter pattern
- Create initial models: User (id UUID, email, name, passwordHash, createdAt, updatedAt)
- Run first migration
Follow Prisma 7 Rust-free conventions from CLAUDE.md.
PROMPT

# STEP 3: Auth module
# Prompt:
<<'PROMPT'
Create the Auth module in packages/api with:
- JWT-based authentication (passport-jwt)
- Supabase Auth integration
- Endpoints: POST /auth/register, POST /auth/login, POST /auth/refresh
- JwtAuthGuard for protecting routes
- DTOs with class-validator
- Swagger decorators on all endpoints
- Unit tests with Vitest
PROMPT

# STEP 4: Shared package types
# Prompt:
<<'PROMPT'
Set up packages/shared with:
- Shared TypeScript types exported from index.ts
- API response wrapper type: { success, data?, error?, meta? }
- User type (matching Prisma model, without passwordHash)
- Auth types: LoginDto, RegisterDto, AuthTokens
- Typed API client class using fetch with proper error handling
- Configure tsconfig paths so web and mobile can import @pantryai/shared
PROMPT


# ============================================================
# PHASE 4.2 — Core Features / Must Have (6 Mar → 9 Apr)
# Follow MoSCoW priority: build Must Have features first
# ============================================================

# STEP 5: Product & Stock CRUD
# Prompt:
<<'PROMPT'
Create the Product and Stock modules in packages/api:

Product module:
- Model: Product (id, name, brand, ean13, category, imageUrl, nutritionData JSON, createdAt, updatedAt)
- CRUD endpoints with pagination
- Open Food Facts lookup by EAN-13

Stock module:
- Model: StockItem (id, userId, productId, quantity, unit, expirationDate, location enum [fridge/freezer/pantry], addedAt, createdAt, updatedAt)
- CRUD with user scoping (JwtAuthGuard)
- GET /stocks with filters: expiring soon, by location, search
- Relations: StockItem → Product, StockItem → User

Add @@index on userId, productId, expirationDate.
Create DTOs, Swagger docs, and Vitest tests for both modules.
PROMPT

# STEP 6: EAN-13 barcode scanning (mobile)
# Prompt:
<<'PROMPT'
Set up barcode scanning in packages/mobile:
- Use expo-camera with barcode scanning capability
- Create a ScanScreen with camera viewfinder
- On EAN-13 detection: call API to look up product in our DB
- If not found: call Open Food Facts API, create product, return to user
- Add the product to user's stock with a form for quantity, expiration, location
- Use Expo Router for navigation
PROMPT

# STEP 7: Receipt OCR pipeline — API side
# Prompt:
<<'PROMPT'
Create the OCR module in packages/api with the full async pipeline:

1. POST /ocr/scan endpoint:
   - Accepts image upload (multer)
   - Creates OcrJob in database (status: PENDING)
   - Uploads image to Cloudflare R2
   - Enqueues job to BullMQ Redis queue
   - Returns jobId immediately (202 Accepted)

2. GET /ocr/jobs/:id endpoint:
   - Returns job status and results when COMPLETED

3. BullMQ Worker (src/worker/ocr.worker.ts):
   - Picks up job from Redis queue
   - Downloads image from R2
   - Sends to Mistral OCR API for text extraction
   - Parses extracted text into product lines
   - Creates/matches Products in database
   - Creates StockItems for the user
   - Updates job status to COMPLETED
   - Deletes image from R2 (RGPD: within 24h)

4. Tesseract.js fallback:
   - If Mistral OCR fails or is unavailable
   - Local processing, lower accuracy

Create Prisma model: OcrJob (id, userId, status enum, retailer, rawText, parsedItems JSON, imageKey, createdAt, completedAt)
PROMPT

# STEP 8: Receipt parsing — retailer-specific
# Prompt:
<<'PROMPT'
Create retailer-specific receipt parsers in packages/api/src/ocr/parsers/:

1. CarrefourParser — for native PDF receipts:
   - Use pdf-parse to extract text
   - Parse structured product lines
   - Handle EAN-13 codes when present

2. LidlParser — for JPEG thermal receipts:
   - Handle truncated product labels (~20 chars)
   - Filter discount lines (REMISE, -X.XX)
   - Associate discounts with the correct product by proximity

3. LeclercParser — for thermal paper scans:
   - Handle category headers mixed with products
   - Variable quality handling

4. GenericParser — fallback for unknown retailers:
   - Best-effort line-by-line extraction

Each parser implements a ReceiptParser interface:
{ parse(rawText: string): ParsedReceiptItem[] }

Include unit tests with sample receipt text for each retailer.
PROMPT

# STEP 9: QR code for dematerialized receipts
# Prompt:
<<'PROMPT'
Add QR code scanning capability for dematerialized receipts (loi AGEC):
- In packages/mobile: add QR code scanning mode to ScanScreen
- QR code contains URL to digital receipt
- Backend endpoint: POST /ocr/scan-qr
  - Fetches the receipt from the URL
  - Determines format (PDF, HTML, JSON)
  - Routes to appropriate parser
  - Same async BullMQ flow as image OCR
PROMPT

# STEP 10: Expiration alerts
# Prompt:
<<'PROMPT'
Create the Notification module in packages/api:
- Daily cron job (nest schedule) checks StockItems expiring within 3 days
- Push notifications via Expo Push API
- Model: UserDevice (id, userId, expoPushToken, createdAt)
- Endpoint: POST /devices/register (save push token from mobile)
- In packages/mobile: register for push notifications on app start
- Show notification screen listing items expiring soon
PROMPT

# STEP 11: Web frontend — core pages
# Prompt:
<<'PROMPT'
Build the core web frontend in packages/web using Next.js 16.2:

Pages (App Router):
- / — Dashboard: stock overview, expiring soon, quick actions
- /stocks — Full stock list with search, filters, sort
- /stocks/[id] — Stock item detail with edit/delete
- /scan — Upload receipt image for OCR processing
- /login and /register — Auth pages

Components:
- StockCard — displays a stock item with expiration indicator
- ExpirationBadge — color-coded (green/yellow/red)
- ReceiptUploader — drag-and-drop image upload with progress
- Navbar — responsive with auth state

Use TanStack Query for API calls via @pantryai/shared client.
Tailwind CSS for styling. Server Components where possible.
PROMPT

# STEP 12: Manual product entry (fallback)
# Prompt:
<<'PROMPT'
Add manual product entry as a universal fallback:
- In packages/web: add a "Add manually" form on /stocks/new
  - Fields: product name, quantity, unit, expiration date, location, category
  - Auto-suggest from existing products as user types
- In packages/mobile: add ManualEntryScreen
  - Same form, optimized for mobile (date picker, dropdown for location)
- Both create a new Product if needed, then create StockItem
PROMPT


# ============================================================
# PHASE 4.3 — Should Have Features (10 Apr → 30 Apr)
# ============================================================

# STEP 13: Recipe suggestions
# Prompt:
<<'PROMPT'
Create the Recipe module in packages/api:
- Model: Recipe (id, name, ingredients JSON, instructions, imageUrl, source, createdAt)
- TheMealDB API integration: search by ingredient
- Local JSON fallback with ~50 common French recipes
- Endpoint: GET /recipes/suggest?ingredients=tomato,onion,pasta
  - Matches recipes against user's current stock
  - Returns recipes sorted by ingredient match percentage
- In packages/web: /recipes page showing suggestions based on current stock
- In packages/mobile: RecipesScreen with same functionality
PROMPT

# STEP 14: Auto-generated shopping list
# Prompt:
<<'PROMPT'
Create the ShoppingList module:
- Model: ShoppingList (id, userId, items JSON, createdAt, updatedAt)
- Auto-generate from: low stock items + recipe ingredients not in stock
- Endpoint: GET /shopping-list/generate
- Manual add/remove items
- In packages/web: /shopping-list page
- In packages/mobile: ShoppingListScreen
PROMPT

# STEP 15: Conservation tips (Learning Path V1)
# Prompt:
<<'PROMPT'
Create the LearningPath module for food conservation education:
- Static content: JSON files with conservation tips per product category
  (fruits, vegetables, dairy, meat, grains)
- Each tip: title, content, category, optimal storage, duration
- Endpoint: GET /learning/tips?category=fruits
- Contextual: when viewing a StockItem, show conservation tip for that product
- In packages/web: show tips inline on stock item pages
- In packages/mobile: conservation tip card on product detail
PROMPT


# ============================================================
# PHASE 4.4 — Security (1 May → 8 May)
# ============================================================

# STEP 16: Security hardening
# Prompt:
<<'PROMPT'
Security audit and hardening for PantryAI:

1. Supabase RLS: enable Row Level Security on all user-facing tables
   - Users can only access their own StockItems, OcrJobs, ShoppingLists
   - Add Prisma middleware to enforce userId scoping as defense-in-depth

2. Input validation: audit all DTOs for proper class-validator decorators

3. Rate limiting: add @nestjs/throttler on auth endpoints (5 req/min)

4. Helmet: add helmet middleware for security headers

5. CORS: configure for web domain only

6. RGPD compliance check:
   - DELETE /users/me endpoint for account + data deletion
   - Verify R2 images are deleted within 24h
   - No PII in logs
   - Data export endpoint: GET /users/me/export

7. Environment variables: verify no secrets in code, all in .env
PROMPT


# ============================================================
# PHASE 4.5 — Unit Tests (11 May → 18 May)
# ============================================================

# STEP 17: Test coverage
# Prompt:
<<'PROMPT'
Comprehensive test suite for PantryAI:

1. Unit tests (Vitest) for every service:
   - AuthService, ProductService, StockService, OcrService, RecipeService
   - Mock Prisma, external APIs (Mistral, TheMealDB, Open Food Facts)
   - Test edge cases: expired tokens, empty stock, OCR failures

2. Integration tests (Supertest) for every endpoint:
   - Auth flow: register → login → access protected route
   - Stock CRUD with auth
   - OCR job creation and status polling
   - Recipe suggestions with stock data

3. Receipt parser tests:
   - Test each retailer parser with sample receipt text
   - Test discount association, encoding, edge cases

Target: 80%+ coverage on services, 60%+ overall.
Run: pnpm test and pnpm test:cov
PROMPT


# ============================================================
# PHASE 4.6 — Versioning & Iterations (19 May → 22 May)
# ============================================================

# STEP 18: CI/CD pipeline
# Prompt:
<<'PROMPT'
Set up GitHub Actions CI/CD pipeline:

.github/workflows/ci.yml:
- Trigger: push to develop, PR to main
- Jobs:
  1. Lint: pnpm lint (all packages)
  2. Test: pnpm test (with PostgreSQL + Redis services)
  3. Build: pnpm build (verify all packages compile)
  4. Type check: pnpm tsc --noEmit

.github/workflows/deploy.yml:
- Trigger: push to main
- Jobs:
  1. Deploy web to Vercel
  2. Build and push API Docker image
  3. Deploy to Hetzner CX11 via SSH

Create Dockerfile for packages/api (multi-stage, Node.js 22 alpine).
Create .dockerignore.
PROMPT

# STEP 19: Documentation
# Prompt:
<<'PROMPT'
Generate project documentation:

1. README.md — Project overview, setup instructions, architecture diagram (mermaid)
2. docs/api.md — API endpoint reference (auto-generate from Swagger)
3. docs/deployment.md — Manual de déploiement (Docker, Hetzner, Vercel, Supabase)
4. docs/user-guide.md — Manuel utilisateur (how to use the app, with screenshots placeholder)
5. docs/update-guide.md — Manuel de mise à jour (version upgrade procedures)
6. CHANGELOG.md — Initial version entry

These documents are required for Bloc 2 certification deliverables.
PROMPT


echo "============================================"
echo "📋 Development workflow guide"
echo "============================================"
echo ""
echo "Copy each prompt (between PROMPT markers) into"
echo "the Claude Code Spark panel in Antigravity."
echo ""
echo "Order matters — each step builds on the previous one."
echo "Complete one step before starting the next."
echo ""
echo "Current Gantt position: Phase 4 (Mar 2 → May 22)"
echo "  4.1 Environment setup    → Steps 1-4"
echo "  4.2 Core features        → Steps 5-12"
echo "  4.3 Secondary features   → Steps 13-15"
echo "  4.4 Security             → Step 16"
echo "  4.5 Tests                → Step 17"
echo "  4.6 Versioning & CI/CD   → Steps 18-19"
echo ""
