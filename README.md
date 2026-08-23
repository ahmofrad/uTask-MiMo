# TaskApp — Enterprise Task Management Platform

> **Self-hosted, on-premise task management for companies.**
> Local accounts, LDAP, and SAML SSO. Persian + English with full RTL.
> Public REST API and webhooks for third-party integrations.
> Per-project custom fields. Built to handle 1k–10k concurrent users per organization.

> ✅ **Status:** v1.0.0 GA — all 12 build phases complete. See [`SPEC.md`](./SPEC.md) for the full product spec, [`TASKS.md`](./TASKS.md) for the build plan.

---

## What is this?

A multi-user, multi-project task management platform designed for companies that run their own infrastructure. The platform supports:

### Core features
- **Three authentication modes** — local email/password, LDAP/Active Directory, and SAML 2.0 SSO (switchable per organization).
- **Projects + tasks + subtasks** with drag-to-reorder, mentions, comments, attachments.
- **Custom fields per project** — admins define a schema per project (text, number, date, select, multi-select, user, checkbox, URL); users fill values on tasks; filterable and searchable.
- **Bilingual UI** — Persian (default, RTL, Jalali calendar) and English.
- **Per-user theming** — accent color customization, light/dark mode.
- **RBAC** — Owner, Admin, Manager, Member, Guest roles with project-scoped permissions.
- **Two-factor authentication (TOTP)** — per-user enrollment with QR code, encrypted secret at rest, single-use recovery codes, and a second login step for local accounts. Password brute-force lockout with configurable attempts/window.
- **Per-user datetime preferences** — IANA timezone, 12/24-hour format, and an optional dual Jalali/Gregorian display.
- **Audit logging** — every action captured, queryable by admin.
- **Notifications** — in-app notifications (assigned, mentioned, commented, status changed, due soon). Email + daily digest is V1.1 backlog.
- **Installable PWA** — add to the home screen; the app shell works offline while live data stays network-only. Web app manifest + maskable icons; service worker via Serwist.

### Integrations
- **Public REST API** — programmatic access via personal API tokens with per-token scopes. Full OpenAPI 3.1 spec and Swagger UI.
- **Webhooks** — push event notifications (task created/updated/deleted/assigned, comment created, etc.) with HMAC-SHA256 signing, automatic retry with exponential backoff, and dead-letter handling.

### Deployment
- **On-prem installable** — single `docker compose up` for small deployments, Helm chart for k8s at scale.
- **No outbound traffic** — no telemetry, no third-party analytics, no SaaS dependencies.

---

## Documentation

| File | Purpose |
|------|---------|
| [`SPEC.md`](./SPEC.md) | Full product spec — read this first |
| [`AGENTS.md`](./AGENTS.md) | Briefing for AI coding agents working in this repo |
| [`TASKS.md`](./TASKS.md) | Phased build plan (Phases 0–12) |
| [`AUTH.md`](./AUTH.md) | Local + LDAP + SAML SSO integration guide |
| [`i18n.md`](./i18n.md) | Persian + English, RTL, Jalali calendar guide |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | On-prem deployment (Docker Compose + Helm) |
| [`DESIGN.md`](./DESIGN.md) | Design system — tokens, typography, components, RTL |
| [`INSTALL.md`](./INSTALL.md) | Installation guide (single-VM, k8s, HA, backup) |
| [`docs/admin-guide.md`](./docs/admin-guide.md) | System administration guide |
| [`docs/user-guide.md`](./docs/user-guide.md) | End-user documentation |
| [`docs/api-integration.md`](./docs/api-integration.md) | Public REST API integration guide |
| [`docs/webhook-integration.md`](./docs/webhook-integration.md) | Webhook receiver integration guide |

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript strict |
| Runtime | Node.js 20 LTS |
| Database | PostgreSQL 16 + PgBouncer |
| Cache / queue / sessions | Redis 7 |
| Background jobs | BullMQ |
| Realtime | Socket.IO with Redis adapter |
| Auth | Auth.js v5 + LDAP (`ldapts`) + SAML (`@node-saml/node-saml`) |
| i18n | `next-intl` + `date-fns-jalali` |
| UI | Tailwind CSS + shadcn/ui (theme-able via CSS variables per `DESIGN.md`) |
| Public API | REST with bearer tokens, OpenAPI 3.1 generated from Zod schemas |
| Webhooks | HMAC-SHA256 signed, BullMQ-delivered, retry + dead-letter |
| Object storage | S3-compatible (MinIO bundled) |
| Email | SMTP (customer-provided) |
| Logging | Pino → Loki |
| Metrics | prom-client → Prometheus → Grafana |
| Tracing | OpenTelemetry (optional Tempo export) |
| PWA | Serwist service worker + web app manifest (installable, offline app shell) |
| Testing | Vitest + Playwright + Testcontainers |
| Deployment | Docker Compose (small) + Helm (large) |

See [`SPEC.md` § 6](./SPEC.md) for the rationale.

---

## Quick Start (development)

```bash
# 1. Install dependencies
pnpm install

# 2. Bring up the local stack (Postgres, Redis, MinIO, Mailhog, WireMock)
pnpm docker:up

# 3. Initialize environment
# Prisma CLI reads .env; Next.js also loads it for local development.
cp .env.example .env
# Edit .env if you need non-default local endpoints

# 4. Initialize the database
pnpm db:baseline    # Sync schema (db push) + baseline migration history
pnpm db:seed        # Creates admin@utask.local (password: password; local only)
pnpm db:sample      # Optional: adds sample users, projects, tasks

# 5. Run the dev server
pnpm dev

# Open http://localhost:3000
# When opening the dev server through another hostname or IP, set
# NEXT_ALLOWED_DEV_ORIGINS=your-server-hostname,192.0.2.10 in .env first.
# Mailhog UI: http://localhost:8025
# MinIO console: http://localhost:9001

# 6. First login
# After the optional sample seed, log in with one of these local-only accounts:
#
#   Role     Email                  Password
#   ──────   ─────────────────────  ──────────
#   Owner    owner@utask.local      password
#   Admin    admin@utask.local      password
#   Manager  manager@utask.local    password
#   Member   sara@utask.local       password
#   Member   ali@utask.local        password
#   Guest    guest@utask.local      password
#   Member   john@utask.local       password
#
# The Owner account has full permissions. Use it to set up
# your first admin or invite team members.
```

### Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 9 (`npm i -g pnpm`)
- **Docker** + Docker Compose v2.20 or newer (`docker compose up --wait`)
- 4 GB RAM free for the dev stack

---

## Project Structure

```
.
├── SPEC.md              # Product spec
├── AGENTS.md            # AI agent briefing
├── TASKS.md             # Build plan
├── AUTH.md              # Auth integration guide
├── i18n.md              # i18n / RTL / Jalali guide
├── DEPLOYMENT.md        # On-prem deployment guide
├── DESIGN.md            # Design system — tokens, typography, components
├── README.md            # You are here
├── src/
│   ├── app/             # Next.js App Router
│   │   ├── api/v1/      # Internal REST
│   │   ├── api/v1/public/  # Public REST API (bearer tokens)
│   │   └── [locale]/    # i18n routing
│   ├── components/      # UI components
│   ├── lib/             # Domain logic
│   │   ├── auth/        # Local + LDAP + SAML
│   │   ├── custom-fields/  # Schema + value resolvers
│   │   ├── api-token/   # Token issue + scope check
│   │   ├── webhook/     # Event emitter + dispatcher + signing
│   │   ├── openapi/     # Spec generator
│   │   └── ...
│   ├── styles/
│   │   └── tokens.css   # Design tokens (CSS variables)
│   └── messages/        # ICU translation files (fa-IR, en-US)
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── ops/
│   ├── docker/
│   ├── helm/
│   ├── grafana/
│   └── prometheus/
├── scripts/
│   ├── backup.sh
│   ├── restore.sh
│   └── smoke.sh
└── tests/
    ├── unit/
    ├── integration/     # Testcontainers
    └── e2e/             # Playwright
```

---

## Available Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Run the dev server |
| `pnpm worker` | Run the background worker (BullMQ queues + LDAP sync + due-soon schedulers) |
| `pnpm build` | Production build |
| `pnpm start` | Run the production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript check |
| `pnpm test` | Vitest unit + integration |
| `pnpm test:e2e` | Playwright e2e |
| `pnpm test:a11y` | `@axe-core/playwright` |
| `pnpm test:visual` | Visual regression |
| `pnpm docker:up` | Start dev stack |
| `pnpm docker:down` | Stop dev stack |
| `pnpm prisma studio` | Browse the local DB |
| `pnpm prisma migrate dev` | Create/apply a new development migration |
| `pnpm prisma:deploy` | Apply tracked migrations non-interactively |
| `pnpm db:seed` | Seed sample data |
| `pnpm db:baseline` | Sync dev schema via `db push` and record migration history |
| `pnpm i18n:extract` | Extract i18n keys from code |
| `pnpm i18n:check` | Fail CI if `fa-IR` has missing keys |
| `pnpm design:check` | Lint for hardcoded colors / physical CSS properties |
| `pnpm pwa:gen-icons` | Regenerate PWA icons from `public/icon.svg` (`@resvg/resvg-js`) |
| `pnpm pwa:check` | Validate PWA manifest + icons + offline page for CI |

---

## Public REST API (V1)

Base URL: `/api/v1/public/`. Auth via `Authorization: Bearer <token>`.

Personal API tokens are issued per user (`tk_` prefix, shown once on creation, hashed at rest, scope-limited, revocable).

| Endpoint | Scopes | Purpose |
|----------|--------|---------|
| `GET /api/v1/public/me` | (token) | Current identity |
| `GET POST /api/v1/public/tasks` | `tasks:read` / `tasks:write` | List / create |
| `GET PATCH DELETE /api/v1/public/tasks/:id` | as above | Read / update / delete |
| `GET POST /api/v1/public/projects` | `projects:read` / `projects:write` | List / create |
| `GET /api/v1/public/projects/:id/custom-fields` | `projects:read` | Get schema |
| `GET POST /api/v1/public/webhooks` | `webhooks:manage` | Webhook CRUD |
| `POST /api/v1/public/webhooks/:id/test` | `webhooks:manage` | Send test event |
| `GET POST DELETE /api/v1/public/tokens` | (none) | Manage own tokens |

Full spec: `GET /api/v1/public/openapi.json`. Swagger UI: `/api/v1/public/docs`.

See the [API Integration Guide](./docs/api-integration.md) for complete documentation, code examples (cURL, Node.js, Python, Go), rate limiting, pagination, and error handling.

---

## Webhooks (V1)

Subscribe to events from the admin panel. Each webhook receives HMAC-SHA256-signed POST requests with:

```
Headers:
  Content-Type: application/json
  X-TaskApp-Event-Id: evt_<uuid>
  X-TaskApp-Event-Type: task.created
  X-TaskApp-Delivery-Id: <id>
  X-TaskApp-Signature: sha256=<hex>
  X-TaskApp-Timestamp: <unix_seconds>
```

Subscribed events: `task.created`, `task.updated`, `task.deleted`, `task.status_changed`, `task.assigned`, `comment.created`, `project.created`, `project.updated`, `user.created`, `custom_field.updated`.

Retry on transient failures with exponential backoff (5 s → 80 s, 5 attempts). Permanent failures land in dead-letter view.

See the [Webhook Integration Guide](./docs/webhook-integration.md) for signature verification code examples (Node.js, Python, Go), best practices, and event reference.

---

## Authentication Modes

Three modes, configurable per organization:

1. **Local** — email + password, magic-link recovery, optional per-user TOTP 2FA (enrolled from Settings → Security), and automatic lockout after `AUTH_MAX_FAILED_ATTEMPTS` (default 5) failed attempts for `AUTH_LOCKOUT_MINUTES` (default 15).
2. **LDAP / Active Directory** — UPN-based bind (full UPN or `sAMAccountName`); selected groups provision users and soft-de-provision them (`ldapGroupRemoved`) on a schedule. Configured via the admin SSO page.
3. **SAML 2.0 SSO** — integrate with Azure AD, Okta, AD FS, Keycloak, or any SAML IdP.

A single user can be linked to multiple identities. See [`AUTH.md`](./AUTH.md) for the full integration guide.

---

## Internationalization

- **Default locale:** `fa-IR` (Persian, RTL, Jalali calendar).
- **Secondary locale:** `en-US` (English, LTR, Gregorian calendar).
- **Per-user preference** stored in the user profile.
- **No hardcoded strings** in components — every label goes through `useTranslations()`.
- **RTL-ready** layout uses CSS logical properties throughout.
- **Jalali date picker** with Gregorian toggle.

See [`i18n.md`](./i18n.md) for the full guide.

---

## Design System

The visual language is defined in [`DESIGN.md`](./DESIGN.md):
- **Token-based** — all colors, spacing, typography, motion defined as CSS variables in `src/styles/tokens.css`.
- **Light + dark mode** with per-user override.
- **Per-user accent color** (8 presets + custom hex picker) verified for WCAG AA contrast.
- **Logical CSS properties** for clean RTL mirroring.
- **Component library** built on shadcn/ui primitives, extended with enterprise-specific components.

---

## Deployment

Two deployment topologies are supported:

| Scale | Approach |
|-------|----------|
| Small (< 500 users, single VM) | Docker Compose — single host with Postgres, Redis, MinIO |
| Large (1k–10k users, k8s) | Helm chart on Kubernetes with HA (active-passive) |

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for full installation instructions, hardware sizing, HA topology, backup/restore procedures, upgrade paths, and webhook egress requirements.

---

## Observability

- **Logs:** structured JSON via Pino, shipped to Loki.
- **Metrics:** Prometheus scrapes `/metrics` from each app instance. Includes custom metrics for API token usage and webhook delivery success/failure.
- **Tracing:** OpenTelemetry SDK, OTLP exporter (optional Tempo).
- **Pre-built Grafana dashboards** in `ops/grafana/`.

---

## License

TBD by the organization deploying this.

## Status

This project is **v1.0.0 GA** — all 12 build phases complete. See [`TASKS.md`](./TASKS.md) for the build plan and [`docs/admin-guide.md`](./docs/admin-guide.md) for administration.

## Roadmap (post-V1)

See [`SPEC.md` § 18](./SPEC.md) for the explicit out-of-scope list and [`TASKS.md` § Backlog](./TASKS.md) for candidate V1.1 / V2 features.