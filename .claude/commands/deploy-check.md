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
