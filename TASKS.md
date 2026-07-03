# TASKS.md — Enterprise Build Plan

> Work top-to-bottom, one phase at a time. Each phase ends in a runnable, demonstrable state.
> Mark tasks done with `[x]` as you go.
> **Phases 0–10 are the engineering build.** **Phases 11–12 are packaging + GA.**

> **Read [`SPEC.md`](./SPEC.md), [`AGENTS.md`](./AGENTS.md), [`AUTH.md`](./AUTH.md), [`i18n.md`](./i18n.md), [`DEPLOYMENT.md`](./DEPLOYMENT.md), and [`DESIGN.md`](./DESIGN.md) before starting Phase 0.**

---

## Phase 0 — Repo + Dev Environment

- [x] Initialize repo: Next.js 14 + TypeScript strict + Tailwind + App Router.
- [x] Configure `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `@/` alias.
- [x] ESLint + Prettier + `eslint-plugin-jsx-a11y` + `eslint-plugin-i18next`.
- [x] shadcn/ui CLI init with neutral base palette.
- [x] Copy `tokens.css` from `DESIGN.md` §2.1 into `src/styles/`.
- [x] Wire Tailwind config to consume design tokens (`tailwind.config.ts`).
- [x] Configure `next/font` for Vazirmatn (fa-IR) and Inter (en-US).
- [x] Docker Compose for local dev: `postgres:16`, `redis:7`, `minio`, `mailhog`, `wiremock`.
- [x] `pnpm docker:up` script configured in `package.json`.
- [x] Prisma init pointing at the dev Postgres.
- [x] `.env.example` with every env var documented; `.env.local` gitignored.
- [x] Vitest + Playwright + Testcontainers scaffolding; smoke test boots the app.
- [x] Pino + `requestId` middleware on every request.
- [x] OpenTelemetry SDK init (no exporter in dev; OTLP-ready).
- [x] CI workflow (GitHub Actions): typecheck, lint, unit.
- [x] First commit: `chore: initial scaffolding`.

**Done when:** `pnpm docker:up && pnpm dev` boots the app, `pnpm test` passes, CI is green, fonts load, tokens apply.

---

## Phase 1 — Data Layer

- [ ] Prisma schema for all entities per `SPEC.md § 8`: User, AuthIdentity, Role, Department, Project, ProjectMember, CustomField, CustomFieldValue, Task, Tag, TaskTag, Attachment, Comment, Watcher, Notification, AuditLog, ApiToken, Webhook, WebhookDelivery, Settings.
- [ ] Add `pg_trgm`, `citext`, `pgcrypto`, `pg_partman` extensions via migration.
- [ ] Initial migration: `pnpm prisma migrate dev --name init`.
- [ ] All indexes from `SPEC.md § 8` present.
- [ ] Partitioning setup for `auditlog` and `webhookdelivery` (monthly).
- [ ] Seed script: 1 Owner, 1 Admin, 1 Manager, 2 Members, 1 Guest; 3 departments; 3 projects; ~30 tasks with mixed status, due dates, custom field values; comments + attachments.
- [ ] `lib/db.ts` Prisma client singleton with logging through Pino.
- [ ] Cursor pagination helpers in `lib/db/pagination.ts`.
- [ ] Unit tests for pagination, seed idempotency, custom field value seeding.

**Done when:** `pnpm prisma studio` shows the schema; seed runs cleanly twice without dupes; pagination helpers tested.

---

## Phase 2 — Auth (Local + LDAP + SAML)

> See [`AUTH.md`](./AUTH.md) for the full design.

- [ ] Auth.js v5 init with Prisma adapter.
- [ ] **Local provider:** email + bcrypt(12) password; magic-link recovery (SMTP).
- [ ] **LDAP provider:** `ldapts`; bind/search; sync users + groups on schedule (BullMQ job); JIT-create users on first login.
- [ ] **SAML provider:** `@node-saml/node-saml`; SP-initiated + IdP-initiated; metadata XML upload by admin; JIT-create users on first login.
- [ ] Identity linking: a single user can have multiple AuthIdentity rows. Login merges them.
- [ ] Session strategy: opaque session id in Redis, 30-min idle / 12-h max, revocation supported.
- [ ] CSRF on all state-changing endpoints.
- [ ] Rate limit `/api/v1/auth/*`: 10 req/min per IP.
- [ ] Login flow tests:
  - [ ] Local login success.
  - [ ] Local login with bad password → audit log entry + 401.
  - [ ] LDAP login success (mock LDAP server in tests).
  - [ ] SAML login success (mock IdP).
  - [ ] Session revocation: force-logout-everywhere for a user.

**Done when:** All three providers work end-to-end; tests pass; audit log captures every login.

---

## Phase 3 — RBAC + Users + Departments

- [ ] `lib/rbac/can(user, action, resource)` with the matrix from `SPEC.md § 9.3`.
- [ ] Default-deny; explicit allow per action.
- [ ] `requirePermission()` middleware for API routes.
- [ ] `<Can>` component for conditional UI rendering.
- [ ] Admin user CRUD: list, invite (email + magic link), suspend, role change, force logout.
- [ ] Departments CRUD; tree view; LDAP-importable.
- [ ] Settings page for org Owner/Admin: site name, default locale, default accent, session timeout.
- [ ] User preferences: per-user locale, accent color, theme, density, email digest frequency.
- [ ] Unit tests: every RBAC cell in the matrix (allow and deny).
- [ ] E2E: admin invites a user → user accepts → admin changes role → permission changes reflected.

**Done when:** Admin can fully manage users and roles; UI hides actions a user can't perform; every API endpoint enforces.

---

## Phase 4 — Projects + Tasks + Custom Fields

- [ ] `lib/projects/` and `lib/tasks/` and `lib/custom-fields/` with full query + mutation logic.
- [ ] **Projects CRUD** with visibility rules, archive vs delete.
- [ ] **Tasks CRUD** with all fields per `SPEC.md § 8`; subtasks max depth 2.
- [ ] **Custom field schema CRUD** (per project):
  - [ ] `lib/custom-fields/schemas.ts` with Zod schemas per field type.
  - [ ] `lib/custom-fields/validators.ts` for per-type validation.
  - [ ] `lib/custom-fields/values.ts` for typed value storage/retrieval.
  - [ ] Admin UI to define/reorder/archive fields per project.
- [ ] **Custom field value rendering** on task detail page — per-type components in `components/custom-field/`.
- [ ] **Custom field filtering** — filter UI + `lib/custom-fields/filter.ts` query builder.
- [ ] Drag-to-reorder using fractional `orderIndex` (single-row update).
- [ ] Bulk actions: complete, delete, reassign, tag, reschedule, **bulk set custom field values**.
- [ ] Quick add (Cmd/Ctrl+K) — centered palette, keyboard-first.
- [ ] Inline edit; soft-delete with 5s undo toast.
- [ ] Optimistic UI for toggle-complete and reorder.
- [ ] All task/project/custom-field mutations write to audit log.
- [ ] Unit tests for every mutation; integration tests for cursor pagination + custom field filtering.
- [ ] E2E: create project → create custom field → create task → set custom value → filter by custom value.

**Done when:** Full project + task + custom field CRUD works, drag-reorder persists, filtering by custom field works, all mutations audited.

---

## Phase 5 — Collaboration (Comments, Mentions, Notifications, Email)

- [ ] Comment CRUD (threaded, max depth 3, markdown).
- [ ] @mention parsing in titles, descriptions, comments.
- [ ] Mention resolution: matches users by display name + email; dropdown picker.
- [ ] Notification creation on: assigned, mentioned, due_soon, commented, status_changed.
- [ ] Notification center: bell icon with unread count, dropdown list, mark read, mark all read.
- [ ] Email:
  - [ ] SMTP config UI (admin).
  - [ ] Nodemailer transport with `lib/mail/send.ts`.
  - [ ] Templates per locale: assigned, mentioned, due_soon, daily digest.
  - [ ] Daily digest job (BullMQ cron).
- [ ] Watchers: auto-add assignee + reporter + mentionees; manual add.
- [ ] Activity feed per task (timeline of audit + comments).
- [ ] Markdown rendering with DOMPurify allowlist (no raw HTML, no inline scripts).
- [ ] E2E: A mentions B → B gets in-app + email → B clicks link → lands on task → can reply.

**Done when:** Comments threaded, mentions notify, emails sent (verified via mailhog in dev), markdown safe.

---

## Phase 6 — Realtime + Search

- [ ] Socket.IO server in `/api/vs/ws` with `@socket.io/redis-adapter`.
- [ ] Authenticated WS handshake (JWT in cookie).
- [ ] Channels: `user:<userId>` (notifications), `project:<projectId>` (project updates), `task:<taskId>` (task + comments).
- [ ] Presence indicator on task page ("X is viewing").
- [ ] Postgres FTS index on `task(title, description)`, `comment(body)`, and **text-typed custom field values**.
- [ ] Search endpoint: `GET /api/v1/search?q=...&type=task|comment|project|custom_field`.
- [ ] Search UI: `/` focuses search, recent queries persisted per user.
- [ ] E2E: open task in 2 browsers → edit in one → other sees update within 1s.

**Done when:** Realtime updates push across users; search returns relevant results (including custom field matches) within 200ms.

---

## Phase 7 — Public REST API + Webhooks + Reports + Dashboards + Admin

### 7a. Public REST API
- [ ] `lib/api-token/` — token issue (`tk_` prefix), SHA-256 hash storage, scope check middleware.
- [ ] `lib/openapi/` — OpenAPI 3.1 generator from Zod schemas (`@asteasolutions/zod-to-openapi` or hand-rolled).
- [ ] `/api/v1/public/` namespace with bearer auth middleware.
- [ ] All public endpoints from `SPEC.md § 11.2` implemented.
- [ ] Rate limit per token (60/min) and per user aggregate (600/min).
- [ ] Swagger UI at `/api/v1/public/docs`.
- [ ] User UI for token management (`/settings/tokens`): create (show once), list, revoke.
- [ ] Tests: scope enforcement, rate limit, RBAC propagation.

### 7b. Webhooks
- [ ] `lib/webhook/emit.ts` — central event emitter; called from all mutation paths.
- [ ] `lib/webhook/sign.ts` — HMAC-SHA256 signing.
- [ ] `lib/webhook/dispatch.ts` — BullMQ job, retry schedule, dead-letter.
- [ ] SSRF protection in URL validation (deny private IP ranges).
- [ ] Admin UI for webhook management (`/admin/webhooks`): CRUD, show secret once on create, list deliveries.
- [ ] Test endpoint: send synthetic event.
- [ ] Replay endpoint: re-send a past delivery.
- [ ] Dead-letter view.
- [ ] Tests: signature verification, retry behavior, SSRF blocking.

### 7c. Reports + Dashboards
- [ ] **My dashboard:** today's tasks, upcoming (next 7 days), overdue, recent activity.
- [ ] **Project dashboard:** status breakdown, burndown (computed), assignee load, **custom field breakdowns**.
- [ ] **Org dashboard (Admin/Owner):** projects overview, user activity, audit highlights, **API token usage**, **webhook delivery health**.
- [ ] Charts via Recharts — RTL-friendly, theme-aware via tokens.
- [ ] Reports use materialized views or pre-aggregated tables refreshed every 5 min (BullMQ job).

### 7d. Admin pages
- [ ] All admin pages from `SPEC.md § 10.12`: Users, Departments, LDAP, SAML, SMTP, Storage, Audit, **Tokens**, **Webhooks**, Backups.
- [ ] All admin pages RBAC-gated (Owner/Admin only).
- [ ] All admin actions audited.

**Done when:** All public API endpoints work with tokens + scopes; webhooks emit, sign, retry, dead-letter correctly; all dashboards render with real data; admin can configure SSO, SMTP, webhooks, tokens from UI; backup script works.

---

## Phase 8 — i18n + RTL + Jalali + Theming

> See [`i18n.md`](./i18n.md).

- [ ] `next-intl` setup with `[locale]` segment; `fa-IR` default, `en-US` alternate.
- [ ] Middleware redirects `/` to user's preferred locale (or default).
- [ ] All `messages/fa-IR.json`, `messages/en-US.json` keys extracted; CI fails on missing `fa-IR`.
- [ ] `<html lang="..." dir="...">` set per locale.
- [ ] RTL: logical CSS properties throughout (lint enforced).
- [ ] Date helpers in `lib/date/`: `formatDate`, `formatDateTime`, `formatRelative` — locale-aware, Jalali-aware.
- [ ] Jalali date picker (use `react-day-picker` + `date-fns-jalali`).
- [ ] Number formatting: Persian numerals toggle per user.
- [ ] Theming:
  - [ ] Light + dark mode, system preference default, manual override.
  - [ ] Accent color CSS variable `--accent`; 8 presets + custom hex picker.
  - [ ] Per-user persistence; inline `<style>` on `<html>` to avoid FOUC.
  - [ ] All accents WCAG AA on light + dark backgrounds.
- [ ] Accessibility pass:
  - [ ] Tab order verified on every page.
  - [ ] Focus rings visible.
  - [ ] ARIA labels on all icon-only buttons.
  - [ ] `@axe-core/playwright` tests pass on every major route.
- [ ] Lighthouse: Performance ≥ 90, Accessibility = 100, Best Practices ≥ 95.

**Done when:** All UI strings translated to fa-IR, layout works in both RTL and LTR, dates render correctly per locale, accent color customizable, axe clean.

---

## Phase 9 — Design System Implementation

> See [`DESIGN.md`](./DESIGN.md).

- [ ] `tokens.css` and `tailwind.config.ts` complete per `DESIGN.md § 2`.
- [ ] `<Icon>` wrapper with RTL mirroring per `DESIGN.md § 4.3`.
- [ ] `cn()` helper (`clsx` + `tailwind-merge`).
- [ ] shadcn/ui primitives customized (Button, Input, Select, Dialog, Sheet, Toast, etc.).
- [ ] Enterprise components built per `DESIGN.md § 6.2`:
  - [ ] `<TaskRow>`, `<TaskDetail>`, `<TaskQuickAdd>`
  - [ ] `<ProjectCard>`, `<MemberAvatar>`, `<PriorityBadge>`, `<StatusBadge>`, `<DueDateChip>`, `<TagChip>`
  - [ ] `<MentionInput>`, `<CommentThread>`, `<NotificationBell>`, `<AuditTimeline>`, `<DashboardCard>`
  - [ ] `<CustomFieldInput>` per type (text, number, date, select, multi-select, user, checkbox, URL)
  - [ ] `<ApiTokenCreateDialog>`, `<WebhookForm>`
- [ ] `pnpm design:check` lints for hardcoded colors, physical CSS properties, missing tokens.
- [ ] Visual regression test suite (`pnpm test:visual`) with screenshots for: home, task detail, settings, project view, admin panel, both locales, both themes.

**Done when:** All design system primitives and enterprise components implemented; design lint passes; visual regression baseline set.

---

## Phase 10 — Audit, Security, RBAC Enforcement Pass

- [ ] Verify every mutation writes to audit log.
- [ ] Verify every internal API endpoint has RBAC check.
- [ ] Verify every public API endpoint has scope check.
- [ ] Verify webhook event emission on every event type from `SPEC.md § 10.10`.
- [ ] Security headers verified (CSP, HSTS, X-Frame-Options).
- [ ] Rate limits tuned and tested.
- [ ] SSRF protection tested for webhook URL submission.
- [ ] Penetration test (external) — fix all critical + high findings.
- [ ] Dependency audit (`pnpm audit`) — no known critical vulnerabilities.

**Done when:** Every audit, RBAC, scope, and emission test is green; pen test clean.

---

## Phase 11 — On-Prem Deployment Packaging

> See [`DEPLOYMENT.md`](./DEPLOYMENT.md).

- [ ] Production Dockerfile (multi-stage, distroless or alpine, non-root user).
- [ ] `docker-compose.prod.yml`: app x2, postgres + PgBouncer, redis + sentinel, minio (distributed), nginx reverse proxy with TLS termination, **webhook egress allowance documented**.
- [ ] `.env.prod.example` with every variable documented, including webhook signing secret encryption key.
- [ ] `scripts/backup.sh`: nightly pg_dump + MinIO snapshot, retention.
- [ ] `scripts/restore.sh`: restore from a dump.
- [ ] Helm chart under `ops/helm/`:
  - [ ] Values for replicas, resources, ingress, TLS.
  - [ ] StatefulSets for Postgres, Redis, MinIO.
  - [ ] Deployments for app, worker, socket.io.
  - [ ] PVCs with appropriate size.
  - [ ] HPA on app + worker.
- [ ] `ops/grafana/` with pre-built dashboards including webhook delivery health.
- [ ] `ops/prometheus/` scrape config + `ops/alertmanager/` rules including webhook failure alert.
- [ ] Installation documentation:
  - [ ] Prerequisites.
  - [ ] Single-VM install.
  - [ ] k8s install.
  - [ ] HA topology.
  - [ ] Upgrade procedure.
  - [ ] Backup + restore drill.
  - [ ] Webhook egress / firewall requirements.
- [ ] Smoke test script (`scripts/smoke.sh`) that runs after install: signup → login → create task → set custom field → create webhook → trigger event → verify delivery → logout.

**Done when:** Fresh VM, follow install doc, smoke test passes. k8s install works on a kind cluster.

---

## Phase 12 — Beta Hardening → GA

- [ ] Load test: simulate 10k concurrent users (k6 or Gatling); verify p95 < 300 ms.
- [ ] Load test public API + webhooks at projected volume.
- [ ] Chaos test: kill Postgres primary, verify failover < 30 s.
- [ ] Chaos test: kill Redis primary, verify Sentinel failover < 10 s.
- [ ] Chaos test: webhook receiver returns 500 — verify retry + dead-letter.
- [ ] Disaster recovery drill: restore from backup on a clean VM, verify all data present.
- [ ] Security headers + rate limits verified in production.
- [ ] Documentation: install, admin guide, user guide, **API integration guide (with OpenAPI reference)**, **webhook integration guide (with signature verification examples)**, troubleshooting.
- [ ] 3 pilot customers; weekly check-ins; triage their feedback.
- [ ] Final bug bash; freeze; tag `v1.0.0`.

**Done when:** GA criteria met, all docs published, 3 customers running in production for 4+ weeks without critical incidents.

---

## Backlog (post-V1, requires explicit approval)

- Multi-tenant SaaS mode.
- Mobile native apps (Capacitor / React Native).
- Calendar integrations (Google / Outlook).
- Time tracking / pomodoro / Gantt.
- AI features (auto-categorize, summarize, suggest assignee).
- OAuth2 for public API.
- Custom field types: file, relation, multi-user, formula.
- Approval workflows.
- SLA / due-date escalation policies.
- Multi-region active-active DR.
- Customer support ticketing.
- Marketplace / plugins.
- Data export (CSV / JSON).
- Antivirus for attachments.
- SSO for additional IdPs (WS-Federation, OIDC).
- Inbound webhooks (customer pushes events to us).
- API token default expiry + rotation enforcement.
- Webhook dead-letter alerting via email.

---

## Conventions for working through this list

1. **One phase at a time.** Don't jump ahead.
2. **Commit per task.** Group tiny ones; split big ones.
3. **Update this file.** Check the box the moment you finish.
4. **End-of-phase review.** Before moving on, verify the "Done when" line. If it's not true, the phase isn't done.
5. **Flag, don't fabricate.** If something is blocked or ambiguous, write it in the phase summary and ask the user — don't guess.
6. **Each phase produces a runnable artifact.** Even mid-phase, the app should always boot.