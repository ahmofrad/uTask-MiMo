# AGENTS.md — Briefing for the AI Coding Agent (Enterprise Edition)

> Read [`SPEC.md`](./SPEC.md), then [`AUTH.md`](./AUTH.md), [`i18n.md`](./i18n.md), [`DEPLOYMENT.md`](./DEPLOYMENT.md), and [`DESIGN.md`](./DESIGN.md), then this file. This is the "how to work in this codebase" doc for an enterprise on-prem task management platform.

You are an AI coding agent helping build a **self-hosted, enterprise task management platform**. The user has approved the spec. Your job is to implement it, phase by phase.

---

## 1. Project Snapshot

- **Name:** placeholder — flag to the user.
- **Stack:** Next.js 15 (App Router) + React 19 · TypeScript strict · Node 20 · Fastify (extracted if scaling demands) · PostgreSQL 16 + PgBouncer · Redis 7 · BullMQ · Socket.IO · Auth.js v5 · `ldapts` · `@node-saml/node-saml` · `next-intl` · `date-fns-jalali` · Tailwind + shadcn/ui · Docker / Helm.
- **Scale target:** 1k–10k concurrent users per organization, p95 < 300 ms.
- **Deployment:** on-prem, customer's infrastructure, no outbound traffic.
- **Repo state at handoff:** empty. You scaffold.

## 2. How to Work

### Cadence
1. Read `SPEC.md` end to end.
2. Read `TASKS.md`. Work top-to-bottom, one phase at a time.
3. For each task: read it → plan the change → make the change → test (unit + integration + e2e where relevant) → commit.
4. End-of-phase: write a short summary (what shipped, what's next, anything blocked). Do not start the next phase until the user acknowledges.
5. Surface ambiguities as a single batched question at end of phase, not mid-task.

### Output style
- Small, focused commits. Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `perf:`, `i18n:`, `design:`.
- Every commit group must leave the app runnable.
- PRs grouped logically, < 800 lines diff where possible.
- When you finish a phase, post:
  - what shipped (1–3 bullets per task)
  - what's next
  - anything blocked or any spec ambiguity you want to resolve

### Decision rules
- **Spec silent → pick the boring default.** Don't invent features.
- **Two reasonable approaches → fewer deps wins.**
- **Risky areas (auth, RBAC, audit, security, data migration) → pause and ask.**
- **Performance-critical paths → measure first, then optimize.** Don't pre-optimize.
- **Never commit secrets.** Use `.env.example` and `.env.local` (gitignored).
- **When DESIGN.md is silent, follow the boring default and update DESIGN.md in the same PR.**

## 3. Code Conventions

### TypeScript
- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
- No `any` except at clearly-commented external boundaries.
- Prefer `type` for plain data shapes; `interface` for extensible contracts.
- Validate every external boundary (HTTP, DB, env, webhook payload) with Zod.

### File / folder layout

```
src/
  app/                        # Next.js App Router
    (auth)/                   # login, saml-callback, ldap-redirect
    (app)/                    # authenticated app shell
      inbox/
      today/
      upcoming/
      projects/[projectId]/
        custom-fields/        # custom field schema editor
      tasks/[taskId]/
      admin/                  # admin-only routes
        tokens/               # API token management
        webhooks/             # webhook subscriptions
        webhook-deliveries/   # delivery log
      settings/
    api/
      v1/                     # internal REST
        auth/
        users/
        projects/
        projects/[id]/custom-fields/
        tasks/
        tags/
        notifications/
        audit/
        reports/
        tokens/               # user API token CRUD
        webhooks/             # webhook CRUD
      v1/public/              # public REST API (bearer token)
        openapi.json/
        docs/
        tasks/
        projects/
        users/
        webhooks/
        webhook-deliveries/
        tokens/
      ws/                     # Socket.IO handler
    [locale]/                 # i18n root segment (fa-IR | en-US)
  components/
    ui/                       # shadcn primitives, theme-aware
    task/
    project/
    custom-field/             # per-type custom field renderers
    api-token/
    webhook/
    admin/
    layout/
  lib/
    db.ts                     # prisma client singleton
    auth/                     # nextauth config, ldap, saml adapters
    rbac/                     # permission checks
    audit/                    # audit log helpers
    queue/                    # bullmq queue setup
    realtime/                 # socket.io client + server helpers
    storage/                  # s3 client (minio)
    mail/                     # nodemailer transport
    logging/                  # pino logger setup
    metrics/                  # prom-client setup
    crypto/                   # hashing, hmac, encryption
    validation/               # zod schemas
    i18n/                     # next-intl config
    date/                     # jalali + gregorian helpers
    custom-fields/            # schema + value resolvers
    webhook/                  # event emitter, signing, dispatch
    api-token/                # token issue, scope check
    openapi/                  # spec generator from zod
  hooks/
  stores/                     # zustand stores
  styles/
    globals.css
    tokens.css                # CSS variables (light + dark)
  messages/
    fa-IR.json
    en-US.json
prisma/
  schema.prisma
  migrations/
  seed.ts
ops/
  docker/
  helm/
  grafana/
  prometheus/
  alertmanager/
scripts/
  backup.sh
  restore.sh
  smoke.sh
tests/
  unit/
  integration/                # uses testcontainers
  e2e/                        # playwright
```

### Components
- Server components by default. `"use client"` only when needed.
- No component > 250 lines; extract.
- Props as named types: `type TaskRowProps = { ... }`. No `React.FC`.
- All user-visible strings go through `useTranslations()`. **No hardcoded English.**
- All dates go through `useFormattedDate()` helpers from `lib/date/`. **No raw `new Date().toLocaleDateString()`.**
- **No hardcoded colors, spacing, or fonts.** Use design tokens via Tailwind utilities that map to `tokens.css`.
- **Logical CSS properties only.** `ms-*`, `me-*`, `ps-*`, `pe-*` — never `ml-*`, `mr-*`, `pl-*`, `pr-*`.

### Styling
- Tailwind utility classes only. No CSS modules. No styled-components.
- Use shadcn/ui primitives.
- Icons via the `<Icon>` wrapper (handles RTL mirroring).
- Component file structure: `Component.tsx` + colocated test if non-trivial.
- See `DESIGN.md` for the visual language — read it before designing new components.

### Database
- All schema changes via Prisma migrations. Never edit DB directly.
- Every query through `lib/<domain>/` wrappers. No raw prisma in components.
- All list endpoints use cursor pagination, never offset.
- Soft-delete via `status` column (or `deletedAt`). Never hard-delete user data.
- Always include `WHERE deletedAt IS NULL` filters by default.
- Custom field values: separate table with typed columns, not JSONB blob on Task.

### API
- All internal endpoints under `/api/v1/`.
- All public API endpoints under `/api/v1/public/`.
- Versioned from day 1.
- All endpoints require auth (middleware enforces).
- All endpoints validate input with Zod. Reject unknown fields.
- All list endpoints accept `?cursor=...&limit=...&filter[...]`.
- All mutations return `{ data } | { error: { code, message, field? } }`.
- All errors use RFC 7807 problem details format.
- Mutations require `Idempotency-Key` header for `POST /tasks` and `POST /comments`.
- Rate limit: per-IP, per-user, per-token (different limits for each).

### Public API specifics
- Bearer token via `Authorization: Bearer <token>`.
- Token stored hashed (SHA-256); lookup is O(1) via index.
- Scope check: every endpoint declares required scopes; `requireScope('tasks:write')` middleware.
- OpenAPI 3.1 spec generated from Zod schemas; served at `/api/v1/public/openapi.json`.
- Swagger UI at `/api/v1/public/docs` (server-rendered, no client JS leak).
- Rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

### Custom Fields specifics
- Schema defined per project; stable `key` (slug) used in API and URLs.
- Each type has a dedicated renderer in `components/custom-field/` and a Zod schema in `lib/custom-fields/schemas.ts`.
- Value storage: typed columns (`valueText`, `valueNumber`, `valueDate`, `valueBool`, `valueJson`).
- Validators: per-type (number min/max, text regex/maxLength, date not-in-past optional).
- Filter integration: filter parser knows how to query each type's column.
- Bulk set: `PATCH /tasks/:id` accepts `customFields: { [key]: value }`.

### Webhooks specifics
- Event emission is centralized in `lib/webhook/emit.ts` — never emit from a component.
- Each emission creates a `WebhookDelivery` row and enqueues a BullMQ job.
- Job attempts delivery, records result, schedules retry on failure.
- Signing: `crypto.createHmac('sha256', secret).update(body).digest('hex')`.
- Secret encrypted at rest in DB (AES-256-GCM via `lib/crypto/encrypt.ts`).
- Delivery HTTP client uses undici with 10 s timeout, no automatic redirects (avoid SSRF-like loops).
- SSRF protection: webhook URL host validated against an allowlist or deny-list of internal ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.0.0/16`, `::1/128`, `fc00::/7`). Optionally customer-configurable per webhook.
- All webhook payloads validated by the same Zod schema as the API response.

### Realtime
- Socket.IO with Redis adapter.
- All events go through `lib/realtime/`. Channels: `user:<userId>`, `project:<projectId>`, `task:<taskId>`.
- Always send a `requestId` on every emit for traceability.

### Background jobs
- BullMQ for: email, webhooks, audit compaction, exports, LDAP sync, custom field reindex.
- All jobs idempotent. Job ID derived from the action being performed.
- Failed jobs retry with exponential backoff up to 5 attempts, then dead-letter.
- Webhook delivery is its own queue (`webhook-delivery`) with its own backoff schedule.

### Logging
- Pino with `requestId`, `userId`, `route` in context.
- Never log PII (emails, names) at info level. Use debug.
- Audit-worthy actions go through `lib/audit/log.ts` — do not call this from components.
- Webhook deliveries log payload ID + response status; not full payload (recoverable from DB).

### Error handling
- Typed result objects across boundaries. Never `throw` across the wire.
- React error boundaries at the route level.
- Server: 5xx returns generic message; full error in logs with requestId.

## 4. RBAC

- All permission checks via `lib/rbac/can(user, action, resource)`.
- Never inline `if (user.role === 'admin')` — always through the helper.
- Default-deny: any unlisted action returns false.
- Test every new endpoint with at least one permission-denied case.
- Public API: token holder's role is the RBAC subject; token scopes are an additional filter.

## 5. Audit

- Every mutation of `task`, `project`, `customfield`, `customfieldvalue`, `user`, `role`, `authidentity`, `apitoken`, `webhook` writes to `auditlog`.
- Every login/logout/session revoke writes to `auditlog`.
- API token creation/revocation writes to `auditlog` with action `api_token_created` / `api_token_revoked`.
- Webhook CRUD writes to `auditlog`.
- Before/after JSON captured for updateable entities.
- Read events on `auditlog` itself are NOT audited (avoids recursion).

## 6. Testing

- **Unit (Vitest):** domain logic, RBAC, audit, validation, date helpers, custom field validators, webhook signing/verification, token scope checks, OpenAPI schema. > 80% on `lib/`.
- **Integration (Testcontainers):** real Postgres + Redis for queries, RBAC checks, queue jobs, webhook delivery.
- **E2E (Playwright):** one happy path + one permission-denied path per core flow.
- **Webhook E2E:** spin up a test HTTP server, register webhook, trigger event, verify delivery + signature.
- **Token E2E:** issue token, call public API with token, verify scope enforcement.
- **No snapshot tests.** AI agents write terrible snapshots.
- **i18n e2e:** smoke test that loads `/fa-IR` and `/en-US` and asserts translated strings.
- **RTL e2e:** at least one test that runs in `dir="rtl"` for each major view.
- **Accessibility:** Playwright + `@axe-core/playwright` on every major page.
- **Visual regression:** Playwright + screenshot comparison on a small set of key views (home, task detail, settings). Snapshots committed; reviewed in PR.
- Run `pnpm test && pnpm test:e2e` before every PR.

## 7. Things You Must NOT Do

- ❌ Add features not in `SPEC.md`. Backlog them in `TASKS.md` § Backlog.
- ❌ Introduce new dependencies without flagging why in the PR.
- ❌ Write `any`, `// @ts-ignore`, `eslint-disable` to silence errors.
- ❌ Commit `.env`, secrets, `node_modules`, build output.
- ❌ Leave TODOs in code without a `TASKS.md` entry.
- ❌ Use offset pagination. Always cursor.
- ❌ Hardcode English strings. Always `useTranslations`.
- ❌ Use `new Date().toLocaleDateString()` or `toLocaleString()` directly. Always go through `lib/date/`.
- ❌ Skip RBAC checks because "this route is admin only".
- ❌ Skip scope checks on public API endpoints.
- ❌ Mutate DB without writing to audit log.
- ❌ Store raw user input as HTML. Always markdown → DOMPurify.
- ❌ Send telemetry to any external service.
- ❌ Allow webhook URLs pointing to internal/private network ranges (SSRF protection).
- ❌ Log webhook secrets or API tokens.
- ❌ Optimize prematurely.
- ❌ Hardcode hex colors, spacing, or fonts outside `tokens.css`.
- ❌ Use physical CSS properties (`ml-*`, `mr-*`, `pl-*`, `pr-*`).
- ❌ Use `text-white` / `text-black` — use `text-fg` / `text-fg-inverse`.

## 8. Commands Cheatsheet

```bash
# Dev
pnpm install
pnpm dev
pnpm docker:up                # postgres + redis + minio + mailhog
pnpm docker:down

# DB
pnpm prisma migrate dev
pnpm prisma migrate deploy
pnpm prisma studio
pnpm db:seed

# Quality
pnpm lint
pnpm typecheck
pnpm test                     # unit + integration
pnpm test:e2e                 # playwright
pnpm test:a11y                # axe
pnpm test:visual              # visual regression

# i18n
pnpm i18n:extract
pnpm i18n:check               # fails CI if fa-IR missing

# Design
pnpm design:check             # lints for hardcoded colors, physical properties, etc.

# Production
pnpm build
pnpm start

# Ops
./scripts/backup.sh
./scripts/restore.sh <dump>
./scripts/smoke.sh
```

## 9. Definition of Done (per phase)

- [ ] All tasks in phase complete.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` all green.
- [ ] `pnpm i18n:check && pnpm design:check` clean.
- [ ] App boots via `pnpm docker:up && pnpm dev`.
- [ ] New audit log entries written for any new mutations.
- [ ] RBAC tests pass for any new endpoint.
- [ ] Scope tests pass for any new public API endpoint.
- [ ] Webhook integration test passes for any new emitted event.
- [ ] README.md and relevant docs updated.
- [ ] Commits grouped logically; PR description references the phase.

## 10. When You're Stuck

1. Re-read the relevant section of `SPEC.md` (and `AUTH.md` / `i18n.md` / `DEPLOYMENT.md` / `DESIGN.md` if relevant).
2. Check `TASKS.md` — known issue?
3. If still unclear, write the assumption in a comment + continue. Surface it in the phase summary.
4. Block the user only if the decision changes auth, RBAC, data model, security, or audit semantics.

---

**TL;DR for the agent:** Build the boring, well-typed, well-tested, audited version of what's in `SPEC.md`. Every action audited. Every endpoint RBAC-checked. Every public API endpoint scope-checked. Every webhook signed. Every string translated. Every date Jalali-aware. Every color from a token. Every CSS property logical. Don't get clever. Keep commits small. Ask only when the answer changes the product, the security model, or the design system.