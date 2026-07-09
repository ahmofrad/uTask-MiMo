# ──────────────────────────────────────────────
# TaskApp — Production Dockerfile
# Multi-stage build for minimal final image
# ──────────────────────────────────────────────

FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install os-level build deps
RUN apk add --no-cache python3 make g++

# Install prod + dev deps (devDeps needed for build)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Generate Prisma client
COPY prisma/ ./prisma/
RUN npx prisma generate

# Build application
COPY tsconfig.json next.config.mjs ./
COPY public/ ./public/
COPY src/ ./src/
RUN pnpm build

# ──────────────────────────────────────────────
# Stage 2: Runner
# ──────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Create unprivileged user (UID 1000)
RUN addgroup -g 1000 node && \
    adduser -u 1000 -G node -s /bin/sh -D node

# Copy built assets — only what's needed at runtime
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/package.json ./
COPY --from=builder --chown=node:node /app/next.config.mjs ./

USER node:node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

LABEL org.opencontainers.image.title=TaskApp \
      org.opencontainers.image.description="Enterprise task management" \
      org.opencontainers.image.version=1.0.0

ENTRYPOINT ["sh", "-c", "npx prisma migrate deploy && node server.js"]