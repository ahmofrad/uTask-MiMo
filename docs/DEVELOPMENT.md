# Development Guide

## Local Development Setup

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for Postgres, Redis, MinIO, MailHog)

### Getting Started

```bash
# Install dependencies
pnpm install

# Start infrastructure
pnpm docker:up

# Copy environment file
cp .env.example .env.local

# Run migrations
pnpm prisma migrate dev

# Seed database
pnpm db:seed

# Start dev server
pnpm dev
```

## Reproducing CI Failures Locally

CI runs against a **separate Postgres container** with different credentials than the local dev DB. To reproduce CI failures faithfully:

### CI Database Setup

```bash
# Create a CI-like Postgres container (matching CI's ops/docker/postgres with pg_partman)
docker run --detach \
  --name ci-postgres \
  -e POSTGRES_USER=taskapp \
  -e POSTGRES_PASSWORD=taskapp \
  -e POSTGRES_DB=taskapp \
  -p 5433:5432 \
  taskapp-postgres  # built from ops/docker/postgres

# Wait for it to be ready
for i in $(seq 1 30); do
  pg_isready -h localhost -p 5433 -U taskapp && break
  sleep 1
done
```

### Run CI-like Pipeline

```bash
export DATABASE_URL="postgresql://taskapp:taskapp@localhost:5433/taskapp"

# Run migrations
pnpm prisma migrate deploy

# Seed + sample data
pnpm db:seed
pnpm db:sample

# Build production
pnpm build

# Start production server
PORT=3100 DATABASE_URL="$DATABASE_URL" pnpm start &

# Run e2e tests (excluding @visual)
BASE_URL=http://localhost:3100 DATABASE_URL="$DATABASE_URL" \
  pnpm exec playwright test --grep-invert '@visual'
```

### Key Differences Between Dev and CI

| Aspect | Dev | CI |
|--------|-----|-----|
| Postgres port | 5432 | 5433 |
| Credentials | `postgres:postgres` | `taskapp:taskapp` |
| Database state | Persistent | Fresh tmpfs |
| Server | Dev mode (`pnpm dev`) | Prod build (`pnpm start`) |
| MailHog | Optional | Required for invite tests |

### CI Workflow Steps

The CI workflow (`.github/workflows/ci.yml`) runs:

1. **Docker services**: Postgres (with pg_partman), Redis, MinIO, MailHog
2. **Migration + Seed**: `prisma migrate deploy` → `db:seed` → `db:sample`
3. **Build**: `pnpm build` (production build with Sentry)
4. **E2E**: `pnpm exec playwright test` with `retries: 2`, `workers: 1`
5. **Unit tests**: `pnpm test`
6. **Quality**: `pnpm typecheck`, `pnpm lint`, `pnpm i18n:check`, `pnpm design:check`, `pnpm pwa:check`

### Common CI Failure Patterns

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Invite test fails ("invalid or expired") | MailHog not running or `AUTH_URL` mismatch | Ensure MailHog is on port 8025 and `AUTH_URL` matches the server port |
| Gantt tests fail serially | Date mutation contamination between tests | Check `afterEach` restores original dates |
| `networkidle` timeout | Socket.IO keeps connections alive | Use `domcontentloaded` + explicit element wait |
| Prisma Decimal leak | `estimatedHours`/`spentHours` not converted | Use `toNumber()` or `Number()` before passing to client |

## Testing

```bash
# Quick smoke test (~3s)
pnpm test:smoke

# Full unit + integration
pnpm test

# E2E (requires server running)
pnpm test:e2e

# Accessibility
pnpm test:a11y

# Visual regression
pnpm test:visual
```

## Architecture Notes

- **Ports**: Dev server on 3000, prod on 3000 (configurable via `PORT`)
- **Auth**: Auth.js v5 with credentials, LDAP, and SAML providers
- **Database**: PostgreSQL 16 with PgBouncer, Prisma ORM
- **Cache**: Redis 7 for sessions, queues, and realtime
- **Queues**: BullMQ for background jobs (email, webhooks, exports)
- **Realtime**: Socket.IO with Redis adapter
- **i18n**: `next-intl` with `fa-IR` and `en-US` locales
- **Styling**: Tailwind + shadcn/ui, design tokens via `tokens.css`
