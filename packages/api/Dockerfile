# Multi-stage build for the PantryAI API (and the OCR worker, same image).
#
# Stages:
#   build      -> install everything, build shared + api (prisma generate + nest build)
#   prod-deps  -> install ONLY production deps for a lean runtime node_modules
#   runner     -> copy the built dist + prod deps, run `node dist/main`
#
# Build it from the repo root so the whole workspace is in context:
#   podman build -f packages/api/Dockerfile -t pantryai-api .
#
# Run the API:    docker run -p 3001:3001 --env-file packages/api/.env pantryai-api
# Run the worker: docker run --env-file packages/api/.env pantryai-api node dist/worker

# ---------- base ----------
FROM node:22-alpine AS base
# corepack ships with Node and pins pnpm to the version in package.json.
RUN corepack enable
# Native deps (bcrypt) compile from source on alpine, so we need a toolchain.
RUN apk add --no-cache python3 make g++ libc6-compat
WORKDIR /app

# ---------- build ----------
FROM base AS build
# Copy the workspace manifests first so the install layer caches well.
# pnpm needs every workspace package.json present to satisfy --frozen-lockfile,
# even the ones we don't build here (web/mobile). The filter skips their deps.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/api/package.json packages/api/
COPY packages/web/package.json packages/web/
COPY packages/mobile/package.json packages/mobile/
# Install all workspace deps (pnpm needs the full graph to resolve correctly).
RUN pnpm install --frozen-lockfile
# Now bring in the sources and build.
COPY packages/shared packages/shared
COPY packages/api packages/api
# Generate Prisma client and build (Turborepo handles dependency order).
RUN pnpm --filter @pantryai/api exec prisma generate && pnpm build

# ---------- prod-deps ----------
FROM base AS prod-deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/api/package.json packages/api/
COPY packages/web/package.json packages/web/
COPY packages/mobile/package.json packages/mobile/
# Production-only install (no devDeps), api + shared.
RUN pnpm install --frozen-lockfile --filter "@pantryai/api..." --prod

# ---------- runner ----------
FROM node:22-alpine AS runner
# bcrypt's prebuilt binary needs the gnu libc shim on alpine.
RUN apk add --no-cache libc6-compat
ENV NODE_ENV=production
WORKDIR /app

# Prod node_modules (root .pnpm store + per-package symlinks).
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/packages/api/node_modules ./packages/api/node_modules
COPY --from=prod-deps /app/package.json /app/pnpm-workspace.yaml ./

# Shared package: runtime needs its built output (api imports @pantryai/shared).
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist

# The API: compiled output (includes the generated Prisma client) + manifest.
# We also keep prisma/ so `prisma migrate deploy` can run from this tree if needed.
COPY --from=build /app/packages/api/package.json ./packages/api/package.json
COPY --from=build /app/packages/api/dist ./packages/api/dist
COPY --from=build /app/packages/api/prisma ./packages/api/prisma

WORKDIR /app/packages/api
EXPOSE 3001
# Default to the HTTP API. Override the command with `node dist/worker` to run
# the OCR/queue worker instead.
CMD ["node", "dist/main"]
