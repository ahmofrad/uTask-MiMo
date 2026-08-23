# ──────────────────────────────────────────────
# TaskApp — Production Dockerfile
# Multi-stage build for minimal final image
# ──────────────────────────────────────────────

FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install pnpm — pinned to a Node 20-compatible release with lockfile v9 support.
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate

# Install os-level build deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Install prod + dev deps (devDeps needed for build)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Generate Prisma client
COPY prisma/ ./prisma/
RUN npx prisma generate

# Build application
# postcss.config.mjs and tailwind.config.ts must be present or the Tailwind
# directives in globals.css are emitted literally (no utilities are generated).
COPY tsconfig.json next.config.mjs postcss.config.mjs tailwind.config.ts ./
COPY public/ ./public/
COPY src/ ./src/
COPY server.ts ./
COPY scripts/ ./scripts/
# Explicit production env so the build writes to .next-prod (next.config.mjs
# distDir), keeping it separate from any dev .next artifacts.
ENV NODE_ENV=production
RUN pnpm build

# Bundle server + worker entrypoints (Next + Socket.IO in server, BullMQ in worker)
RUN pnpm build:server

# ──────────────────────────────────────────────
# Stage 2: Runner
# ──────────────────────────────────────────────
FROM node:20-bookworm-slim AS runner

# openssl needed by the Prisma schema engine (migrate deploy) at runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Without this, next({ dev }) picks dev-mode and needs the source tree in the image.
# Compose/Helm .env must not rely on the host defaulting NODE_ENV.
ENV NODE_ENV=production

# next({ dev: false }) custom servers sanity-check for a pages/app dir; the
# compiled bundles render from .next, so an empty marker suffices in the image.
RUN mkdir -p /app/src/app

# node:20-bookworm-slim ships user `node` (uid/gid 1000) — run unprivileged
USER node
# Production build lives in .next-prod (see distDir in next.config.mjs).
COPY --from=builder --chown=node:node /app/.next-prod ./.next-prod
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/package.json ./
COPY --from=builder --chown=node:node /app/next.config.mjs ./
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/scripts/entrypoint.sh ./entrypoint.sh
COPY --from=builder --chown=node:node /app/scripts/migration-preflight.ts ./scripts/migration-preflight.ts

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/v1/health?ready=1').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

LABEL org.opencontainers.image.title=TaskApp \
      org.opencontainers.image.description="Enterprise task management" \
      org.opencontainers.image.version=1.0.0

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "dist/server.js"]