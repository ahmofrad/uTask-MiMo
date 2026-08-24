<div align="center">

# 🚀 TaskApp

**Enterprise Task Management Platform — Self-Hosted**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-TBD-blue)](#license)

Persian 🇮🇷 · English 🇺🇸 — Full RTL support, Jalali calendar

[English](./README.md) | [فارسی](./README.fa.md)

</div>

---

## What is TaskApp?

TaskApp is a **self-hosted, enterprise task management platform** built for companies that run their own infrastructure. It combines a modern task/project management UI with project management information system (PMIS) capabilities — baselines, earned value, risk tracking, change requests, and automation.

**Key highlights:**

- 🔐 **3 auth modes** — Local (email/password), LDAP/AD, SAML 2.0 SSO
- 🌐 **Bilingual** — Persian (default, RTL, Jalali calendar) + English
- 📊 **PMIS** — Baselines, EVM, risk register, change requests
- 🤖 **Automation** — Trigger → condition → action engine
- 🌙 **Theming** — Light/dark mode, 8 accent colors + custom hex
- 🔌 **Public REST API** — Bearer tokens, OpenAPI 3.1, Swagger UI
- 📡 **Webhooks** — HMAC-SHA256 signed, auto-retry, dead-letter
- 🏠 **On-prem** — Docker Compose for small, Helm for large. No telemetry.

---

## ✨ Features

### Core Task Management
- Projects, tasks, subtasks with drag-to-reorder
- Comments, mentions, attachments
- Rich custom fields per project (text, number, date, select, user, checkbox, URL)
- Kanban board, list, Gantt chart, WBS, calendar views
- Working days / holidays / capacity planning

### PMIS & EPM
- **Baselines & EVM** — Snapshot project schedules, compute CPI/SPI/EAC, S-curves, variance reports
- **Risk Register** — Probability × impact scoring, response plans (mitigate/accept/transfer/avoid)
- **Change Requests** — Formal CR lifecycle with automatic baseline snapshot on apply
- **Automation Rules** — Trigger on status change, assignment, due date → execute actions

### Authentication & Security
- Local accounts with bcrypt hashing + brute-force lockout
- LDAP / Active Directory integration with group-based provisioning
- SAML 2.0 SSO (Azure AD, Okta, Keycloak, AD FS)
- TOTP 2FA with QR enrollment, encrypted secrets, recovery codes
- RBAC — Owner, Admin, Manager, Member, Guest with project-scoped permissions

### Integrations
- Public REST API with per-user bearer tokens and per-token scopes
- Webhooks with HMAC-SHA256 signing and automatic retry
- Real-time via Socket.IO

### Deployment
- Docker Compose for single-VM deployments (< 500 users)
- Helm chart for Kubernetes (1k–10k users)
- No outbound traffic, no telemetry, no third-party dependencies

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [`SPEC.md`](./SPEC.md) | Full product specification |
| [`AGENTS.md`](./AGENTS.md) | Briefing for AI coding agents |
| [`TASKS.md`](./TASKS.md) | Phased build plan |
| [`AUTH.md`](./AUTH.md) | Local + LDAP + SAML SSO guide |
| [`i18n.md`](./i18n.md) | Persian + English, RTL, Jalali calendar |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | On-prem deployment (Docker + Helm) |
| [`DESIGN.md`](./DESIGN.md) | Design system — tokens, typography, components |
| [`INSTALL.md`](./INSTALL.md) | Installation guide |
| [`docs/admin-guide.md`](./docs/admin-guide.md) | System administration |
| [`docs/user-guide.md`](./docs/user-guide.md) | End-user documentation |
| [`docs/api-integration.md`](./docs/api-integration.md) | REST API integration |
| [`docs/webhook-integration.md`](./docs/webhook-integration.md) | Webhook integration |
| [`docs/roadmap-pmis.md`](./docs/roadmap-pmis.md) | PMIS feature roadmap |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind CSS · shadcn/ui |
| **Backend** | Node.js 20 LTS · Fastify (optional) |
| **Database** | PostgreSQL 16 · PgBouncer · Prisma ORM |
| **Cache / Queue** | Redis 7 · BullMQ |
| **Realtime** | Socket.IO with Redis adapter |
| **Auth** | Auth.js v5 · `ldapts` · `@node-saml/node-saml` |
| **i18n** | `next-intl` · `date-fns-jalali` |
| **Storage** | S3-compatible (MinIO) |
| **Logging** | Pino → Loki |
| **Metrics** | prom-client → Prometheus → Grafana |
| **Tracing** | OpenTelemetry → Tempo |
| **PWA** | Serwist service worker |
| **Testing** | Vitest · Playwright · Testcontainers |
| **Deployment** | Docker Compose · Helm |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 9 (`npm i -g pnpm`)
- **Docker** + Docker Compose v2.20+
- 4 GB RAM free

### Development Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Start the local stack (Postgres, Redis, MinIO, Mailhog)
pnpm docker:up

# 3. Set up environment
cp .env.example .env

# 4. Initialize database
pnpm db:baseline    # Sync schema + baseline migration history
pnpm db:seed        # Create admin@utask.local (password: password)
pnpm db:sample      # Optional: add sample data

# 5. Start dev server
pnpm dev
```

Open **http://localhost:3000** 🎉

### Default Accounts (after `db:sample`)

| Role | Email | Password |
|------|-------|----------|
| Owner | owner@utask.local | password |
| Admin | admin@utask.local | password |
| Manager | manager@utask.local | password |
| Member | sara@utask.local | password |
| Member | ali@utask.local | password |
| Guest | guest@utask.local | password |

---

## 📦 Available Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Dev server |
| `pnpm worker` | Background worker (BullMQ + LDAP sync) |
| `pnpm build` | Production build |
| `pnpm start` | Production server |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript check |
| `pnpm test` | Unit + integration tests |
| `pnpm test:e2e` | Playwright E2E tests |
| `pnpm test:a11y` | Accessibility tests |
| `pnpm test:visual` | Visual regression tests |
| `pnpm docker:up` | Start dev stack |
| `pnpm docker:down` | Stop dev stack |
| `pnpm db:seed` | Seed sample data |
| `pnpm db:baseline` | Sync dev schema |
| `pnpm dev:clean` | Clear cache + restart dev |
| `pnpm i18n:check` | Check translation completeness |
| `pnpm design:check` | Lint design token violations |

---

## 🔌 Public REST API

Base: `/api/v1/public/` · Auth: `Authorization: Bearer <token>`

| Endpoint | Scopes | Description |
|----------|--------|-------------|
| `GET /me` | — | Current identity |
| `GET/POST /tasks` | `tasks:read` / `tasks:write` | List / create |
| `GET/PATCH/DELETE /tasks/:id` | as above | Read / update / delete |
| `GET/POST /projects` | `projects:read` / `projects:write` | List / create |
| `GET/POST /webhooks` | `webhooks:manage` | Webhook CRUD |
| `GET/POST/DELETE /tokens` | — | Manage own tokens |

📋 Full spec: [`/api/v1/public/openapi.json`](/api/v1/public/openapi.json)
📖 Swagger UI: [`/api/v1/public/docs`](/api/v1/public/docs)

See the [API Integration Guide](./docs/api-integration.md) for code examples and best practices.

---

## 🌐 Internationalization

- **Default:** Persian (fa-IR) — RTL, Jalali calendar
- **Secondary:** English (en-US) — LTR, Gregorian calendar
- Per-user locale preference
- Zero hardcoded strings — all UI text via `useTranslations()`
- Full RTL with CSS logical properties

---

## 🎨 Design System

Defined in [`DESIGN.md`](./DESIGN.md):

- Token-based CSS variables for colors, spacing, typography, motion
- Light + dark mode with per-user override
- 8 accent colors + custom hex picker (WCAG AA contrast)
- RTL-ready with logical CSS properties
- Component library on shadcn/ui primitives

---

## 🚢 Deployment

| Scale | Approach |
|-------|----------|
| Small (< 500 users) | Docker Compose — single VM |
| Large (1k–10k users) | Helm chart on Kubernetes |

No outbound traffic. No telemetry. No third-party dependencies.

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for details.

---

## 📊 Observability

- **Logs:** Pino → Loki (structured JSON)
- **Metrics:** prom-client → Prometheus → Grafana dashboards
- **Tracing:** OpenTelemetry → Tempo (optional)
- Pre-built Grafana dashboards in `ops/grafana/`

---

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/v1/             # Internal REST API
│   ├── api/v1/public/      # Public REST API (bearer tokens)
│   └── [locale]/           # i18n routes
├── components/             # UI components
├── lib/                    # Domain logic
│   ├── auth/               # Local + LDAP + SAML
│   ├── baselines/          # EVM & baselines
│   ├── risks/              # Risk register
│   ├── change-requests/    # CR lifecycle
│   ├── automation/         # Automation engine
│   ├── custom-fields/      # Field schema & values
│   ├── api-token/          # Token management
│   ├── webhook/            # Event dispatch + signing
│   └── openapi/            # Spec generator
├── styles/tokens.css       # Design tokens
└── messages/               # ICU translations (fa-IR, en-US)

prisma/                     # Schema + migrations + seed
ops/                        # Docker, Helm, Grafana, Prometheus
scripts/                    # Backup, restore, smoke tests
tests/                      # Unit, integration, E2E
```

---

## 📄 License

TBD by the organization deploying this.

---

<div align="center">

**Built with ❤️ for enterprise teams that value data sovereignty.**

</div>
