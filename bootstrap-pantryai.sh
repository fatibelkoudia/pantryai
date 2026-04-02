#!/bin/bash
set -e

# ============================================================
# PantryAI Claude Code + Antigravity Bootstrap Script
# Run from: ~/dev/pantryai
# Creates: user-level skill + all project-level config files
# ============================================================

PROJECT_DIR="$(pwd)"
SKILL_DIR="$HOME/.claude/skills/pantryai-claude-code"

echo "📁 Project directory: $PROJECT_DIR"
echo "🧠 Skill directory: $SKILL_DIR"
echo ""

# ============================================================
# PART 1: USER-LEVEL SKILL (the brain)
# ~/.claude/skills/pantryai-claude-code/
# ============================================================

echo "=== PART 1: Installing user-level skill ==="

mkdir -p "$SKILL_DIR/references"

# --- SKILL.md (main router) ---
cat > "$SKILL_DIR/SKILL.md" << 'SKILLEOF'
---
name: pantryai-claude-code
description: |
  Comprehensive Claude Code orchestration skill for PantryAI — intelligent food stock management + waste reduction app.
  Use for ANY Claude Code configuration, agent orchestration, or development workflow task.
  Covers: CLAUDE.md, subagents, agent teams, skills, hooks, MCP servers, plugins, slash commands,
  Claude Agent SDK, permissions, and Antigravity IDE integration.
  Trigger whenever the user mentions: Claude Code setup, agents, subagents, agent teams, hooks, MCP, skills,
  CLAUDE.md, orchestration, parallel development, automated workflows, CI/CD with Claude, Antigravity, or multi-agent patterns.
  MUST BE USED for any Claude Code configuration or agent architecture decisions on this project.
---

# PantryAI — Claude Code Full Orchestration Skill

This skill is the single reference for turning Claude Code into a full development OS for PantryAI.
It routes to specialized reference files per topic.

## Project Context

PantryAI is a web + mobile app for intelligent food stock management and household food waste reduction.
Solo-developer project for RNCP39583 certification ("Expert en Développement Logiciel", Level 7).

### Current Stack (2026)

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend Web | Next.js (App Router, Turbopack) | 16.2 |
| Frontend Mobile | Expo (React Native 0.83) | SDK 55 |
| Backend | NestJS | 11.x |
| ORM | Prisma (Rust-free TypeScript engine) | 7.x |
| Database | PostgreSQL via Supabase | 17 |
| Async Queue | BullMQ + Redis | latest |
| OCR | Tesseract.js (local) + Mistral OCR (EU-sovereign) | latest |
| Runtime | Node.js LTS | 22.x |
| Package Manager | pnpm + Turborepo | latest |

### Architecture
NestJS modular monolith → async worker delegation via BullMQ for OCR.
Worker isolates heavy I/O: upload to R2 → Mistral OCR → JSON parse → PostgreSQL update.

## Skill Reference Map

Read the relevant reference file(s) before acting.

| Topic | Reference File |
|-------|---------------|
| CLAUDE.md project memory | references/claude-md.md |
| Custom subagents | references/subagents.md |
| Agent teams | references/agent-teams.md |
| Skills (auto-activating) | references/skills.md |
| Hooks (lifecycle) | references/hooks.md |
| MCP servers + commands + plugins | references/mcp-servers.md |
| Claude Agent SDK | references/agent-sdk.md |
| Permissions & security | references/permissions.md |
| Antigravity IDE setup | references/antigravity-setup.md |
| PantryAI agents catalog | references/pantryai-agents.md |

## Quick Decision Matrix

| Situation | Use |
|-----------|-----|
| Simple focused task | Subagent |
| Quick codebase search | Built-in Explore subagent |
| Multi-worker collaboration | Agent Team |
| Reusable auto-triggered behavior | Skill |
| User-triggered workflow | Slash Command |
| Enforce rules at lifecycle events | Hook |
| Connect external tools/APIs | MCP Server |
| Shareable setup package | Plugin |
| Programmatic/CI/CD automation | Agent SDK |
| Project-wide conventions | CLAUDE.md |
SKILLEOF

echo "  ✅ SKILL.md"

# --- references/claude-md.md ---
cat > "$SKILL_DIR/references/claude-md.md" << 'EOF'
# CLAUDE.md — Project Memory

CLAUDE.md loads automatically every Claude Code session. It defines project identity, conventions, and constraints.

## Locations & Precedence
- ~/.claude/CLAUDE.md → User-level (all projects)
- ./CLAUDE.md → Project root
- ./src/CLAUDE.md → Directory-scoped
- Precedence: local > project > user (additive)

## Cross-Tool
- CLAUDE.md → Claude Code primary
- AGENTS.md → Cross-tool (Antigravity, Cursor, Codex CLI)
- Next.js 16.2 create-next-app generates AGENTS.md with CLAUDE.md reference

## Key Conventions for PantryAI CLAUDE.md
- Stack: Next.js 16.2, Expo SDK 55, NestJS 11, Prisma 7, Node.js 22.x
- Prisma 7: generator prisma-client (not prisma-client-js), output src/generated/prisma/, driver adapter @prisma/adapter-pg
- App Router only, Turbopack default, named exports only
- RGPD: Mistral OCR for EU sovereignty, ephemeral R2 images, user deletion endpoint
- Never: TypeORM, Google Vision, raw SQL, commit .env, default exports, Pages Router, Webpack
EOF
echo "  ✅ references/claude-md.md"

# --- references/subagents.md ---
cat > "$SKILL_DIR/references/subagents.md" << 'EOF'
# Subagents — Focused Delegated Workers

Own context window, work independently, return results. Cannot talk to each other.

## When to Use
- Verbose output you don't need in main context
- Enforce tool restrictions
- Self-contained work returning summary

## Locations
- .claude/agents/ → Project-level (git committed)
- ~/.claude/agents/ → User-level
- Project takes precedence on name conflicts

## Frontmatter Fields
```yaml
---
name: agent-name
description: When to delegate. Be "pushy" to prevent under-triggering.
tools: Read, Grep, Glob, Write, Edit, Bash  # inherits all if omitted
model: haiku                                  # sonnet | opus | haiku | inherit
permissionMode: bypassPermissions             # default | acceptEdits | bypassPermissions | plan
memory: project                               # user | project | local
skills: [api-conventions]                     # inject skill content at startup
isolation: worktree                           # run in isolated git worktree
background: true                              # run as background task
---
System prompt here.
```

## Invocation
Claude auto-delegates, or explicitly:
> Use the ocr-pipeline subagent to implement the Carrefour parser

## CLI
```bash
claude agents          # list all
claude agents --json   # JSON output
```

See references/pantryai-agents.md for all PantryAI agent definitions.
EOF
echo "  ✅ references/subagents.md"

# --- references/agent-teams.md ---
cat > "$SKILL_DIR/references/agent-teams.md" << 'EOF'
# Agent Teams — Parallel Collaborative Workers

Multiple Claude sessions that communicate directly, share task list, self-coordinate.

## vs Subagents
- Subagents: report back only, no inter-agent communication
- Teams: teammates message each other, shared task list, ~3-7x token cost

## Enable
```json
// ~/.claude/settings.json
{ "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" } }
```
Requires: Claude Opus 4.6 (Pro/Max), tmux recommended for split-pane.

## When to Use for PantryAI
- Full-stack features (frontend + backend + tests in sync)
- Parallel code reviews (multiple reviewers cross-referencing)
- Multi-module refactoring
- Adversarial debugging

## Tips
- Always plan before implementation
- Set quality bar in lead prompt
- Be explicit about file ownership per teammate
- Teammates auto-terminate after idle time
- Ctrl+F to kill background agents
EOF
echo "  ✅ references/agent-teams.md"

# --- references/skills.md ---
cat > "$SKILL_DIR/references/skills.md" << 'EOF'
# Skills — Auto-Activating Capabilities

Markdown files Claude discovers and applies automatically based on task context.

## Locations
- .claude/skills/<name>/SKILL.md → Project-level
- ~/.claude/skills/<name>/SKILL.md → User-level

## Structure
```markdown
---
name: skill-name
description: |
  When to activate. Use PROACTIVELY to prevent under-triggering.
---
Instructions here.
```

## Inject into Subagents
```yaml
skills:
  - api-conventions
  - receipt-parsing
```
EOF
echo "  ✅ references/skills.md"

# --- references/hooks.md ---
cat > "$SKILL_DIR/references/hooks.md" << 'EOF'
# Hooks — Lifecycle Automation

Run code before/after Claude's actions.

## Events
- PreToolUse: block/validate before tool runs
- PostToolUse: auto-format, lint after tool completes
- Notification: forward to Slack/Telegram
- SubagentStart/Stop: log, enforce, collect metrics
- PreCompact: save state before context compaction
- PermissionRequest: auto-approve known-safe actions

## Config (.claude/settings.json)
```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Write|Edit",
      "hooks": [{
        "type": "command",
        "command": "npx prettier --write \"$CLAUDE_FILE_PATH\" 2>/dev/null || true"
      }]
    }]
  }
}
```

## Return Values
```json
{ "block": true, "message": "Reason", "feedback": "Info", "continue": false }
```
EOF
echo "  ✅ references/hooks.md"

# --- references/mcp-servers.md ---
cat > "$SKILL_DIR/references/mcp-servers.md" << 'EOF'
# MCP Servers, Slash Commands, Plugins

## MCP (.mcp.json at project root)
Connect external tools: GitHub, PostgreSQL, Playwright, etc.
```bash
claude mcp add <name> <command> [args]
claude mcp list
```
Enable tool search: { "mcpToolSearch": true } in settings.json

## Slash Commands (.claude/commands/*.md)
```markdown
---
allowed-tools: Read, Write, Edit, Bash
description: What this does
---
Instructions. $ARGUMENTS for user input.
```

## Plugins
Bundle skills + agents + hooks + MCP into distributable packages.
```bash
claude plugin install <source>
claude plugin list
/reload-plugins
```
EOF
echo "  ✅ references/mcp-servers.md"

# --- references/agent-sdk.md ---
cat > "$SKILL_DIR/references/agent-sdk.md" << 'EOF'
# Claude Agent SDK — Programmatic Control

Same tools and agent loop as CLI, programmable in TypeScript/Python.

## Install
npm install @anthropic-ai/claude-agent-sdk  # TS
pip install claude-agent-sdk                 # Python

## Permission Modes
- default: prompts on writes
- acceptEdits: auto-accepts file edits
- bypassPermissions: no prompts (CI/CD)
- plan: no execution
- dontAsk: deny if not pre-approved

## Headless / CI/CD
```bash
claude -p "Run tests" --allowedTools Read,Write,Edit,Bash
claude -p "Deploy" --permission-mode bypassPermissions
claude -p "Lint" --bare
```

## Cloud Providers
CLAUDE_CODE_USE_BEDROCK=1    # AWS
CLAUDE_CODE_USE_VERTEX=1     # Google
CLAUDE_CODE_USE_FOUNDRY=1    # Azure
EOF
echo "  ✅ references/agent-sdk.md"

# --- references/permissions.md ---
cat > "$SKILL_DIR/references/permissions.md" << 'EOF'
# Permissions & Security

## Settings Precedence
1. .claude/settings.local.json (highest, gitignored)
2. .claude/settings.json (project, committed)
3. ~/.claude/settings.json (user, lowest)

## Subagent Inheritance
- Parent bypassPermissions: takes precedence, cannot be overridden
- Parent auto mode: subagent inherits auto + block/allow rules

## PantryAI Security
- Scope Write/Edit to packages/**
- Deny curl/wget (prevent exfiltration)
- API keys in settings.local.json only
- Supabase RLS on all user-facing tables
- OCR images deleted from R2 within 24h (RGPD)
EOF
echo "  ✅ references/permissions.md"

# --- references/antigravity-setup.md ---
cat > "$SKILL_DIR/references/antigravity-setup.md" << 'EOF'
# Antigravity + Claude Code Setup

## Workflow
Antigravity (Gemini) → Planning, architecture
Claude Code → Implementation, testing, commits

## Cross-Tool Compatibility
- CLAUDE.md for Claude Code
- AGENTS.md for Antigravity/Gemini
- Shared skills via symlinks: .claude/skills/ and .agent/skills/ → shared/skills/

## Troubleshooting
- Extension not appearing: restart Antigravity
- Auth issues: /login in Spark panel
- CLAUDE.md not loading: /init to force re-read
- Agent teams: verify env var + claude --version post Feb 2026
- Skills not triggering: check frontmatter, run /reload-plugins
- Symlinks on Windows: use mklink /D or keep separate copies
EOF
echo "  ✅ references/antigravity-setup.md"

# --- references/pantryai-agents.md ---
cat > "$SKILL_DIR/references/pantryai-agents.md" << 'EOF'
# PantryAI Agents Catalog

6 subagents for .claude/agents/. See project files for full definitions.

1. ocr-pipeline — OCR pipeline, receipt parsing, Mistral, BullMQ, Tesseract.js
2. prisma-db — Prisma 7 schema, migrations, seeds, Supabase, ERD
3. nestjs-api — NestJS 11 modules, controllers, services, DTOs, Swagger
4. frontend — Next.js 16.2 (App Router) + Expo SDK 55 (React Native 0.83)
5. test-qa — Vitest, Supertest, Detox, coverage
6. code-reviewer — Security, performance, architecture, RGPD (model: opus)
EOF
echo "  ✅ references/pantryai-agents.md"


# ============================================================
# PART 2: PROJECT-LEVEL FILES
# ~/dev/pantryai/
# ============================================================

echo ""
echo "=== PART 2: Creating project-level files ==="

cd "$PROJECT_DIR"

# --- CLAUDE.md ---
cat > CLAUDE.md << 'EOF'
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
- Branch: main → develop → feature/*, fix/*, chore/*

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
EOF
echo "  ✅ CLAUDE.md"

# --- AGENTS.md ---
cat > AGENTS.md << 'EOF'
# AGENTS.md — PantryAI Cross-Tool Agent Rules

See CLAUDE.md for full project context and coding standards.
This file ensures Antigravity, Cursor, and Codex CLI follow the same rules.

## Stack: Next.js 16.2, Expo SDK 55, NestJS 11, Prisma 7, Node.js 22.x
## Monorepo: pnpm + Turborepo (packages: web, mobile, api, shared)
## Rules: TypeScript strict, Prisma-only DB access, pnpm, Conventional Commits
## Never: raw SQL, TypeORM, Google Vision, commit .env, default exports, Pages Router
EOF
echo "  ✅ AGENTS.md"

# --- .claude/settings.json ---
cat > .claude/settings.json << 'EOF'
{
  "permissions": {
    "allow": [
      "Read",
      "Grep",
      "Glob",
      "Write(packages/**)",
      "Edit(packages/**)",
      "Bash(pnpm *)",
      "Bash(npx prisma *)",
      "Bash(npx vitest *)",
      "Bash(docker compose *)"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Write(.env*)",
      "Bash(curl *)",
      "Bash(wget *)"
    ]
  },
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1",
    "NODE_ENV": "development"
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "npx prettier --write \"$CLAUDE_FILE_PATH\" 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}
EOF
echo "  ✅ .claude/settings.json"

# --- .claude/settings.local.json ---
cat > .claude/settings.local.json << 'EOF'
{
  "env": {
    "GITHUB_TOKEN": "REPLACE_WITH_YOUR_TOKEN",
    "DATABASE_TRANSACTION_POOLER_URL": "REPLACE_WITH_YOUR_URL",
    "MISTRAL_API_KEY": "REPLACE_WITH_YOUR_KEY"
  }
}
EOF
echo "  ✅ .claude/settings.local.json (⚠️  fill in your real keys)"

# --- .mcp.json ---
cat > .mcp.json << 'EOF'
{
  "mcpServers": {
    "github": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
EOF
echo "  ✅ .mcp.json"

# --- .gitignore ---
cat > .gitignore << 'EOF'
node_modules/
.env
.env.*
!.env.example
.claude/settings.local.json
dist/
.next/
.expo/
*.tgz
.turbo/
EOF
echo "  ✅ .gitignore"

# ============================================================
# PART 3: SUBAGENT FILES
# .claude/agents/
# ============================================================

echo ""
echo "=== PART 3: Creating subagent definitions ==="

# --- ocr-pipeline ---
cat > .claude/agents/ocr-pipeline.md << 'EOF'
---
name: ocr-pipeline
description: |
  Use PROACTIVELY for OCR pipeline, receipt parsing, Mistral OCR integration,
  BullMQ queue processing, or Tesseract.js fallback.
tools: Read, Write, Edit, Bash, Grep, Glob
---

You are the OCR pipeline specialist for PantryAI.

## Domain
- BullMQ job queue (packages/api/src/ocr/)
- Worker process (packages/api/src/worker/)
- Mistral OCR API (EU-sovereign, RGPD-compliant)
- Tesseract.js local fallback
- Cloudflare R2 image upload/cleanup
- Receipt parsing (Lidl, Carrefour, Leclerc formats)

## Architecture
- OCR is ALWAYS async via BullMQ — never in API request cycle
- Flow: Client → API creates job (PENDING) → Redis queue → Worker →
  R2 upload → Mistral OCR → JSON parse → PostgreSQL (COMPLETED) →
  client notification → R2 deletion (24h RGPD)
- Tesseract.js is fallback only

## Output: files modified, new deps, test commands, migration commands if needed
EOF
echo "  ✅ ocr-pipeline.md"

# --- prisma-db ---
cat > .claude/agents/prisma-db.md << 'EOF'
---
name: prisma-db
description: |
  Use for ANY database work: Prisma 7 schema, migrations, seed data,
  query optimization, Supabase config. MUST BE USED for schema changes.
tools: Read, Write, Edit, Bash, Grep, Glob
---

You are the database specialist for PantryAI using Prisma 7 (Rust-free).

## Prisma 7 Specifics
- Generator: prisma-client (NOT prisma-client-js)
- Engine: client (TypeScript, Rust-free)
- Output: src/generated/prisma/ (NEVER node_modules)
- Driver adapter: @prisma/adapter-pg + pg
- ESM-first: .js extensions in generated client imports
- Schema: packages/api/prisma/schema.prisma

## Rules
- prisma migrate dev --name descriptive-name
- prisma generate after any change
- Every model: id (UUID), createdAt, updatedAt
- Prisma relations, not manual FKs
- @@index() for WHERE clause fields
- Soft delete: deletedAt DateTime?
- Supabase RLS on user-facing tables

## After Schema Change
1. npx prisma migrate dev --name <descriptive>
2. npx prisma generate
3. Update ERD (PlantUML in docs/diagrams/)
4. Update seed data if new required fields
EOF
echo "  ✅ prisma-db.md"

# --- nestjs-api ---
cat > .claude/agents/nestjs-api.md << 'EOF'
---
name: nestjs-api
description: |
  Use for NestJS 11 backend: modules, controllers, services, DTOs, guards,
  interceptors, Swagger. Use PROACTIVELY for API endpoint work.
tools: Read, Write, Edit, Bash, Grep, Glob
---

You are the NestJS 11 backend specialist for PantryAI.

## Module Structure
src/<module>/
├── <module>.module.ts
├── <module>.controller.ts
├── <module>.service.ts
├── dto/ (create + update DTOs with class-validator)
├── entities/
└── __tests__/

## Rules
- Every endpoint: @ApiTags, @ApiOperation, @ApiResponse
- Every DTO: class-validator decorators
- Every protected route: @UseGuards(JwtAuthGuard)
- Constructor injection only
- Services throw HttpException subtypes
- Prisma 7 transactions for multi-table writes
- Response wrapper: { success, data?, error?, meta? }
EOF
echo "  ✅ nestjs-api.md"

# --- frontend ---
cat > .claude/agents/frontend.md << 'EOF'
---
name: frontend
description: |
  Use for Next.js 16.2 web and Expo SDK 55 mobile development.
  Components, pages, hooks, state, styling.
tools: Read, Write, Edit, Bash, Grep, Glob
---

You are the frontend specialist for PantryAI.

## Web (Next.js 16.2)
- App Router (app/ directory) — NO Pages Router
- Turbopack default — NO Webpack
- Server Components by default, 'use client' only when needed
- Tailwind CSS only
- TanStack Query for API state, Zustand for client state

## Mobile (Expo SDK 55)
- Expo Router for navigation
- React Native 0.83, React 19.2
- New Architecture (default, Legacy dropped)

## Shared
- Types and API client in packages/shared/
- Typed client (never raw fetch in components)
- Functional components, named exports, inline props interface
EOF
echo "  ✅ frontend.md"

# --- test-qa ---
cat > .claude/agents/test-qa.md << 'EOF'
---
name: test-qa
description: |
  Use PROACTIVELY to write and run tests. Vitest, Supertest, Detox, coverage.
tools: Read, Write, Edit, Bash, Grep, Glob
---

You are the test specialist for PantryAI.

## Strategy
- Unit: Vitest — every service method, utility function
- Integration: Supertest — every API endpoint
- E2E: Detox — critical user flows
- Coverage: 80%+ services, 60%+ overall

## Rules
- Files: <name>.spec.ts colocated with source
- vi.mock() for externals (Mistral, Supabase)
- Integration uses test DB (docker-compose.test.yml)
- Test behavior, not implementation
- AAA: Arrange → Act → Assert
EOF
echo "  ✅ test-qa.md"

# --- code-reviewer ---
cat > .claude/agents/code-reviewer.md << 'EOF'
---
name: code-reviewer
description: |
  Expert code review. Use for PR reviews, code quality, security, RGPD compliance.
tools: Read, Grep, Glob
model: opus
---

You are a senior code reviewer for PantryAI. Check:

1. Security: No PII logging, no secrets, auth guards, RGPD compliance
2. Performance: No N+1, proper Prisma includes, async not blocking
3. Architecture: Module boundaries, no circular deps, proper DI
4. TypeScript: Strict types, no any, proper error handling
5. Prisma 7: Driver adapter pattern, no raw SQL, correct imports
6. Tests: New code has tests, existing not broken

Output per finding:
- 🔴 Critical | 🟡 Warning | 🔵 Suggestion
- File + line
- Issue + suggested fix
EOF
echo "  ✅ code-reviewer.md"


# ============================================================
# PART 4: SKILL FILES
# .claude/skills/ (will be symlinked to shared/skills/)
# ============================================================

echo ""
echo "=== PART 4: Creating skill files ==="

# --- receipt-parsing ---
cat > shared/skills/receipt-parsing/SKILL.md << 'EOF'
---
name: receipt-parsing
description: |
  Activate for receipt parsing, OCR output processing, product extraction,
  French retailer format handling. Use PROACTIVELY for files in src/ocr/ or src/worker/.
---

# Receipt Parsing Patterns

## French Retailer Formats

### Lidl (JPEG)
- Truncated labels (~20 chars), discount lines interleaved, no EAN
- Strategy: Line-by-line regex, discount association by proximity

### Carrefour (native PDF)
- Structured PDF, full names, EAN-13 present
- Strategy: PDF text extraction first, OCR fallback

### Leclerc (thermal paper scan)
- Variable quality, often skewed, category headers mixed
- Strategy: Image preprocessing (deskew, contrast) → Mistral OCR

## Pipeline
1. Detect format (PDF → text extract, Image → OCR)
2. Normalize encoding (UTF-8, French accents)
3. Extract: product name, quantity, unit price, total
4. Associate discounts with correct products
5. Validate totals (sum ≈ receipt total)
6. Map to Product model via fuzzy match or EAN lookup
EOF
echo "  ✅ receipt-parsing/SKILL.md"

# --- api-conventions ---
cat > shared/skills/api-conventions/SKILL.md << 'EOF'
---
name: api-conventions
description: |
  Activate for NestJS controller, service, DTO, or module work.
  Enforces PantryAI API conventions automatically.
---

# PantryAI API Conventions

## Endpoints: plural nouns (/products, /recipes, /stocks)
## Nested: /users/:userId/stocks
## Response wrapper: { success: boolean, data?: T, error?: { code, message }, meta?: { page, limit, total } }
## Errors: 400 validation, 401 auth, 403 forbidden, 404 not found, 422 business logic, 500 server
## Every endpoint: @ApiTags, @ApiOperation, @ApiResponse, @UseGuards(JwtAuthGuard)
## Every DTO: class-validator decorators (@IsString, @IsEmail, etc.)
## Prisma 7: driver adapter pattern, never raw SQL, transactions for multi-table
EOF
echo "  ✅ api-conventions/SKILL.md"


# ============================================================
# PART 5: SLASH COMMANDS
# .claude/commands/
# ============================================================

echo ""
echo "=== PART 5: Creating slash commands ==="

cat > .claude/commands/scan-receipt.md << 'EOF'
---
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
description: Process a receipt image through the OCR pipeline and verify output
---

Process the receipt at $ARGUMENTS through the PantryAI OCR pipeline:

1. Identify the retailer format (Lidl JPEG, Carrefour PDF, etc.)
2. Run through the appropriate parsing strategy
3. Show extracted products in a table
4. Flag any parsing errors or low-confidence items
5. Suggest database entries for each product
EOF
echo "  ✅ scan-receipt.md"

cat > .claude/commands/new-module.md << 'EOF'
---
allowed-tools: Read, Write, Edit, Bash
description: Scaffold a new NestJS 11 module with all boilerplate
---

Create a new NestJS module named $ARGUMENTS with:
1. Module file with proper imports
2. Controller with CRUD endpoints and Swagger decorators
3. Service with Prisma 7 integration (driver adapter pattern)
4. Create and Update DTOs with class-validator
5. Entity type definition
6. Test file with Vitest boilerplate
7. Update app.module.ts imports

Follow all PantryAI API conventions from CLAUDE.md.
EOF
echo "  ✅ new-module.md"

cat > .claude/commands/deploy-check.md << 'EOF'
---
allowed-tools: Read, Bash, Grep, Glob
description: Pre-deployment checklist for PantryAI
---

Run the full pre-deployment checklist:
1. pnpm lint — No lint errors
2. pnpm test — All tests pass
3. pnpm build — Clean build
4. Check for uncommitted changes
5. Verify .env.example matches all required vars
6. Check Prisma migrations are up to date
7. Verify Docker image builds
8. Report results with ✅/❌ per check
EOF
echo "  ✅ deploy-check.md"


# ============================================================
# PART 6: SYMLINKS
# ============================================================

echo ""
echo "=== PART 6: Setting up symlinks ==="

# Remove the empty skill dirs (we'll symlink to shared)
rm -rf .claude/skills/receipt-parsing
rm -rf .claude/skills/api-conventions
rmdir .claude/skills 2>/dev/null || true

# Symlink .claude/skills → shared/skills
ln -sf "$(pwd)/shared/skills" .claude/skills

# Symlink .agent/skills → shared/skills
ln -sf "$(pwd)/shared/skills" .agent/skills

echo "  ✅ .claude/skills/ → shared/skills/"
echo "  ✅ .agent/skills/ → shared/skills/"


# ============================================================
# DONE
# ============================================================

echo ""
echo "============================================"
echo "🎉 PantryAI Claude Code setup complete!"
echo "============================================"
echo ""
echo "Project: $PROJECT_DIR"
echo "Skill:   $SKILL_DIR"
echo ""
echo "Next steps:"
echo "  1. Edit .claude/settings.local.json with your real API keys"
echo "  2. Open Antigravity → Connect to WSL → Open $PROJECT_DIR"
echo "  3. In Claude Code (Spark panel): type 'What project am I working on?'"
echo "  4. Run: claude agents (to verify all 6 agents are loaded)"
echo ""
