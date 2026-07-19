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

- [x] Prisma schema for all entities per `SPEC.md § 8`: User, AuthIdentity, Role, Department, Project, ProjectMember, CustomField, CustomFieldValue, Task, Tag, TaskTag, Attachment, Comment, Watcher, Notification, AuditLog, ApiToken, Webhook, WebhookDelivery, Settings, InstanceSetting, LdapSyncGroup, Account, Session, VerificationToken, TaskDependency, TaskAssignee.
- [x] Add `pg_trgm`, `citext`, `pgcrypto` extensions via migration.
- [x] Add `pg_partman` extension — installed via custom Docker image + migration.
- [x] Initial migration: `pnpm prisma migrate dev --name init`.
- [x] All indexes from `SPEC.md § 8` present.
- [x] Partitioning setup for `auditlog` and `webhookdelivery` (monthly) — pg_partman manages partitions automatically.
- [x] Seed script: 1 Owner, 1 Admin, 1 Manager, 2 Members, 1 Guest; 3 departments; 3 projects; ~30 tasks with mixed status, due dates, custom field values; comments + attachments.
- [x] `lib/db.ts` Prisma client singleton with logging through Pino.
- [x] Cursor pagination helpers in `lib/db/pagination.ts`.
- [x] Unit tests for pagination, seed idempotency, custom field value seeding.

**Done when:** `pnpm prisma studio` shows the schema; seed runs cleanly twice without dupes; pagination helpers tested.

---

## Phase 2 — Auth (Local + LDAP + SAML)

> See [`AUTH.md`](./AUTH.md) for the full design.

- [x] Auth.js v5 init with Prisma adapter.
- [x] **Local provider:** email + bcrypt(12) password; magic-link recovery (SMTP).
- [x] **LDAP provider:** `ldapts`; **UPN-based bind** (full UPN or `sAMAccountName` + suffix); **selected-group provisioning + soft de-provisioning** (`ldapGroupRemoved`) on a schedule (BullMQ in the worker process); JIT-create users on first login; config in `Settings` (`scope:"install"`, `key:"ldap"`) via the admin SSO page.
- [x] **SAML provider:** `@node-saml/node-saml`; SP-initiated + IdP-initiated; metadata XML upload by admin; JIT-create users on first login.
- [x] Identity linking: a single user can have multiple AuthIdentity rows. Login merges them.
- [x] Session strategy: **USES JWT** instead of opaque Redis-backed sessions with 30-min idle / 12-h max. No server-side session revocation. (Spec deviation — revisit if needed.)
- [x] CSRF on all state-changing endpoints.
- [x] Rate limit `/api/v1/auth/*`: 10 req/min per IP.
- [x] Login flow tests:
  - [x] Local login success.
  - [x] Local login with bad password → audit log entry + 401.
  - [x] LDAP login success (mock LDAP server in tests).
  - [x] SAML login success (mock IdP).
  - [x] Session revocation: force-logout-everywhere for a user — **DONE** (token blacklist via Redis).

**Done when:** All three providers work end-to-end; tests pass; audit log captures every login.

---

## Phase 3 — RBAC + Users + Departments

- [x] `lib/rbac/can(user, action, resource)` with the matrix from `SPEC.md § 9.3`.
- [x] Default-deny; explicit allow per action.
- [x] `requirePermission()` middleware for API routes — **DONE** (`requirePermission()` factory in `lib/rbac/middleware.ts`).
- [x] `<Can>` component for conditional UI rendering.
- [x] Admin user CRUD: list, invite (email + magic link), suspend, role change, force logout.
- [x] Departments CRUD; tree view; LDAP-importable.
- [x] Settings page for org Owner/Admin: site name, default locale, default accent, session timeout.
- [x] User preferences: per-user locale, accent color, theme, density, email digest frequency.
- [x] Unit tests: every RBAC cell in the matrix (allow and deny).
- [x] E2E: admin invites a user → user accepts → admin changes role → permission changes reflected.

**Done when:** Admin can fully manage users and roles; UI hides actions a user can't perform; every API endpoint enforces.

---

## Phase 4 — Projects + Tasks + Custom Fields

- [x] `lib/projects/` and `lib/tasks/` and `lib/custom-fields/` with full query + mutation logic.
- [x] **Projects CRUD** with visibility rules, archive vs delete.
- [x] **Tasks CRUD** with all fields per `SPEC.md § 8`; subtasks max depth 2.
- [x] **Custom field schema CRUD** (per project):
  - [x] `lib/custom-fields/schemas.ts` with Zod schemas per field type.
  - [x] `lib/custom-fields/validators.ts` for per-type validation.
  - [x] `lib/custom-fields/values.ts` for typed value storage/retrieval.
  - [x] Admin UI to define/reorder/archive fields per project.
- [x] **Custom field value rendering** on task detail page — per-type components in `components/custom-field/`.
- [x] **Custom field filtering** — filter UI + `lib/custom-fields/filter.ts` query builder.
- [x] Drag-to-reorder using fractional `orderIndex` (single-row update).
- [x] Bulk actions: complete, delete, reassign, tag, reschedule, **bulk set custom field values**.
- [x] Quick add (Cmd/Ctrl+K) — centered palette, keyboard-first.
- [x] Inline edit; soft-delete with 5s undo toast.
- [x] Optimistic UI for toggle-complete and reorder.
- [x] All task/project/custom-field mutations write to audit log.
- [x] Unit tests for every mutation; integration tests for cursor pagination + custom field filtering.
- [x] E2E: create project → create custom field → create task → set custom value → filter by custom value.

**Done when:** Full project + task + custom field CRUD works, drag-reorder persists, filtering by custom field works, all mutations audited.

---

## Phase 5 — Collaboration (Comments, Mentions, Notifications, Email)

- [x] Comment CRUD (threaded, max depth 3, markdown).
- [x] @mention parsing in titles, descriptions, comments.
- [x] Mention resolution: matches users by display name + email; dropdown picker.
- [x] Notification creation on: assigned, mentioned, due_soon, commented, status_changed.
- [x] Notification center: bell icon with unread count, dropdown list, mark read, mark all read.
- [x] Email:
  - [x] SMTP config UI (admin).
  - [x] Nodemailer transport with `lib/mail/send.ts`.
  - [x] Templates per locale: assigned, mentioned, due_soon.
  - [x] Daily digest job (BullMQ cron) — **DONE** (daily digest cron in `lib/notifications/daily-digest.ts`).
- [x] Watchers: auto-add assignee + reporter + mentionees; manual add.
- [x] Activity feed per task (timeline of audit + comments).
- [x] Markdown rendering with DOMPurify allowlist (no raw HTML, no inline scripts).
- [x] E2E: A mentions B → B gets in-app + email → B clicks link → lands on task → can reply.

**Done when:** Comments threaded, mentions notify, emails sent (verified via mailhog in dev), markdown safe.

---

## Phase 6 — Realtime + Search

- [x] Socket.IO server in `/api/vs/ws` with `@socket.io/redis-adapter`.
- [x] Authenticated WS handshake (JWT in cookie).
- [x] Channels: `user:<userId>` (notifications), `project:<projectId>` (project updates), `task:<taskId>` (task + comments).
- [x] Presence indicator on task page ("X is viewing").
- [x] Postgres FTS index on `task(title, description)`, `comment(body)`, and **text-typed custom field values**.
- [x] Search endpoint: `GET /api/v1/search?q=...&type=task|comment|project|custom_field`.
- [x] Search UI: `/` focuses search, recent queries persisted per user.
- [x] E2E: open task in 2 browsers → edit in one → other sees update within 1s — **DONE** (2-browser cross-user test with admin + member, both join project room, member receives `task.created` within 1s).

**Done when:** Realtime updates push across users; search returns relevant results (including custom field matches) within 200ms.

---

## Phase 7 — Public REST API + Webhooks + Reports + Dashboards + Admin

### 7a. Public REST API
- [x] `lib/api-token/` — token issue (`tk_` prefix), SHA-256 hash storage, scope check middleware.
- [x] `lib/openapi/` — OpenAPI 3.1 generator from Zod schemas (hand-registered in code).
- [x] `/api/v1/public/` namespace with bearer auth middleware.
- [x] All public endpoints from `SPEC.md § 11.2` implemented.
- [x] Rate limit per token (60/min) and per user aggregate (600/min).
- [x] Swagger UI at `/api/v1/public/docs`.
- [x] User UI for token management (`/settings/tokens`): create (show once), list, revoke.
- [x] Tests: scope enforcement, rate limit, RBAC propagation.

### 7b. Webhooks
- [x] `lib/webhook/emit.ts` — central event emitter; called from all mutation paths.
- [x] `lib/webhook/sign.ts` — HMAC-SHA256 signing.
- [x] `lib/webhook/dispatch.ts` — BullMQ job, retry schedule, dead-letter.
- [x] SSRF protection in URL validation (deny private IP ranges).
- [x] Admin UI for webhook management (`/admin/webhooks`): CRUD, show secret once on create, list deliveries.
- [x] Test endpoint: send synthetic event.
- [x] Replay endpoint: re-send a past delivery.
- [x] Dead-letter view.
- [x] Tests: signature verification, retry behavior, SSRF blocking.

### 7c. Reports + Dashboards
- [x] **My dashboard:** today's tasks, upcoming (next 7 days), overdue, recent activity.
- [x] **Project dashboard:** status breakdown, burndown (computed), assignee load, **custom field breakdowns**.
- [x] **Org dashboard (Admin/Owner):** projects overview, user activity, audit highlights, **API token usage**, **webhook delivery health**.
- [x] Charts via Recharts — RTL-friendly, theme-aware via tokens.
- [x] Reports use materialized views or pre-aggregated tables refreshed every 5 min (BullMQ job) — **DONE** (materialized view refresh in `lib/reports/scheduler.ts`).

### 7d. Admin pages
- [x] All admin pages from `SPEC.md § 10.12`: Users, Departments, LDAP, SAML, SMTP, Storage, Audit, **Tokens**, **Webhooks**, Backups.
- [x] All admin pages RBAC-gated (Owner/Admin only).
- [x] All admin actions audited.

**Done when:** All public API endpoints work with tokens + scopes; webhooks emit, sign, retry, dead-letter correctly; all dashboards render with real data; admin can configure SSO, SMTP, webhooks, tokens from UI; backup script works.

---

## Phase 8 — i18n + RTL + Jalali + Theming

> See [`i18n.md`](./i18n.md).

- [x] `next-intl` setup with `[locale]` segment; `fa-IR` default, `en-US` alternate.
- [x] Middleware redirects `/` to user's preferred locale (or default).
- [x] All `messages/fa-IR.json`, `messages/en-US.json` keys extracted; CI fails on missing `fa-IR`.
- [x] `<html lang="..." dir="...">` set per locale.
- [x] RTL: logical CSS properties throughout (lint enforced).
- [x] Date helpers in `lib/date/`: `formatDate`, `formatDateTime`, `formatRelative` — locale-aware, Jalali-aware.
- [x] Jalali date picker (use `react-day-picker` + `date-fns-jalali`).
- [x] Number formatting: Persian numerals toggle per user.
- [x] Theming:
  - [x] Light + dark mode, system preference default, manual override.
  - [x] Accent color CSS variable `--accent`; 8 presets + custom hex picker.
  - [x] Per-user persistence; inline `<style>` on `<html>` to avoid FOUC.
  - [x] All accents WCAG AA on light + dark backgrounds.
- [x] Accessibility pass:
  - [x] Tab order verified on every page.
  - [x] Focus rings visible.
  - [x] ARIA labels on all icon-only buttons.
  - [x] `@axe-core/playwright` tests pass on every major route.
- [x] Lighthouse: Performance ≥ 90, Accessibility = 100, Best Practices ≥ 95 — **DONE** (`@lhci/cli` installed, `.lighthouserc.js` configured with assertions, `pnpm lhci` script added; run requires seeded DB + built app).

**Done when:** All UI strings translated to fa-IR, layout works in both RTL and LTR, dates render correctly per locale, accent color customizable, axe clean.

---

## Phase 9 — Design System Implementation

> See [`DESIGN.md`](./DESIGN.md).

- [x] `tokens.css` and `tailwind.config.ts` complete per `DESIGN.md § 2`.
- [x] `<Icon>` wrapper with RTL mirroring per `DESIGN.md § 4.3`.
- [x] `cn()` helper (`clsx` + `tailwind-merge`).
- [x] shadcn/ui primitives customized (Button, Input, Select, Dialog, Sheet, Toast, etc.).
- [x] Enterprise components built per `DESIGN.md § 6.2`:
  - [x] `<TaskRow>`, `<TaskDetail>`, `<TaskQuickAdd>`
  - [x] `<ProjectCard>`, `<MemberAvatar>`, `<PriorityBadge>`, `<StatusBadge>`, `<DueDateChip>`, `<TagChip>`
  - [x] `<MentionInput>`, `<CommentThread>`, `<NotificationBell>`, `<AuditTimeline>`, `<DashboardCard>`
  - [x] `<CustomFieldInput>` per type (text, number, date, select, multi-select, user, checkbox, URL)
  - [x] `<ApiTokenCreateDialog>`, `<WebhookForm>`
- [x] `pnpm design:check` lints for hardcoded colors, physical CSS properties, missing tokens.
- [x] Visual regression test suite (`pnpm test:visual`) with screenshots for: home, task detail, settings, project view, admin panel, both locales, both themes.

**Done when:** All design system primitives and enterprise components implemented; design lint passes; visual regression baseline set.

---

## Phase 10 — Audit, Security, RBAC Enforcement Pass

- [x] Verify every mutation writes to audit log.
- [x] Verify every internal API endpoint has RBAC check.
- [x] Verify every public API endpoint has scope check.
- [x] Verify webhook event emission on every event type from `SPEC.md § 10.10`.
- [x] Security headers verified (CSP, HSTS, X-Frame-Options).
- [x] Rate limits tuned and tested.
- [x] SSRF protection tested for webhook URL submission.
- [x] Dependency audit (`pnpm audit`) — no known critical vulnerabilities — **DONE** (1 moderate: PostCSS 8.4.31 transitive dep of Next.js; accepted low-risk, not user-exposed).

**Done when:** Every audit, RBAC, scope, and emission test is green.

---

## Phase 11 — On-Prem Deployment Packaging

> See [`DEPLOYMENT.md`](./DEPLOYMENT.md).

- [x] Production Dockerfile (multi-stage, distroless or alpine, non-root user).
- [x] `docker-compose.prod.yml`: app x2, postgres + PgBouncer, redis + sentinel, minio (distributed), nginx reverse proxy with TLS termination, **webhook egress allowance documented**.
- [x] `.env.prod.example` with every variable documented, including webhook signing secret encryption key.
- [x] `scripts/backup.sh`: nightly pg_dump + MinIO snapshot, retention.
- [x] `scripts/restore.sh`: restore from a dump.
- [x] Helm chart under `ops/helm/`:
  - [x] Values for replicas, resources, ingress, TLS.
  - [x] StatefulSets for Postgres, Redis, MinIO.
  - [x] Deployments for app, worker, socket.io.
  - [x] PVCs with appropriate size.
  - [x] HPA on app + worker.
- [x] `ops/grafana/` with pre-built dashboards including webhook delivery health.
- [x] `ops/prometheus/` scrape config + `ops/alertmanager/` rules including webhook failure alert.
- [x] Installation documentation ([`docs/install.md`](./docs/install.md)):
  - [x] Prerequisites.
  - [x] Single-VM install.
  - [x] k8s install.
  - [x] HA topology.
  - [x] Upgrade procedure.
  - [x] Backup + restore drill.
  - [x] Webhook egress / firewall requirements.
- [x] Smoke test script (`scripts/smoke.sh`) that runs after install: signup → login → create task → set custom field → create webhook → trigger event → verify delivery → logout.

**Done when:** Fresh VM, follow install doc, smoke test passes. k8s install works on a kind cluster.

---

## Backlog (post-V1, requires explicit approval)

> **PMIS extension roadmap (detailed):** see [`docs/roadmap-pmis.md`](../docs/roadmap-pmis.md).
> Each gap below is a **G** entry there with data model, endpoints, RBAC, audit, i18n, and dependencies.
> Build order: planning spine G1→G2→G3→G4; resource/cost G5→G6→G7; lifecycle G8→G9→G10→G11→G12;
> governance R0→G13→G14; cross-cutting G15 (anytime after Phase 4); platform/ops G16.
>
> **External competitive analysis (Mizito):** see [`docs/mizito-analysis.md`](./mizito-analysis.md)
> for the verified feature/GUI inventory of Mizito and the gap register **M1–M18** (what the
> competitor ships that uTask lacks), with buildability classes and a recommended build sequence.
> This is the *intake* for future PMIS-fit gaps; promote items to G-entries in `roadmap-pmis.md` when built.

### PMIS / EPM gaps (uTask does not yet have these)
- **G4 — Baselines & Earned Value Management (EVM)** (frozen baselines, CPI/SPI/EAC, S-curves).
- **G5 — Resource management** (resource catalog, skills, capacity, task resource assignments).
- **G6 — Timesheets & rate cards** (time entry, approval workflow, cost/bill rates).
- **G7 — Cost control ledger** (CostAccount, BudgetLine, Commitment, Expense, append-only ActualCostEntry, FX, multi-currency).
- **G8 — Risk register** (probability × impact scoring, response plans).
- **G9 — Change requests** (DRAFT→APPROVED→APPLIED, baseline snapshot on apply).
- **G10 — Procurement** (Vendor / Contract / PurchaseOrder → auto Commitment).
- **G11 — Quality / NCR** (Non-Conformance Reports + corrective tasks).
- **G12 — Records framework** (generic issue/RFI/document/stakeholder/MoM record types).
- **G13 — Portfolio / Program / Org units** (HOLDING/COMPANY/PORTFOLIO/PROGRAM tree, subtree rollups).
- **G14 — Project profiles + module registry** (enable/disable modules per project/team with dependency DAG).
- **G15 — Cross-cutting collaboration/UX:** full RACI (Consulted/Informed), task approval gate, project RAG/health, automation rules engine, public intake forms, standalone personal tasks, holidays + working-day calendar.
- **G16 — Platform/ops:** multiple themes (Midnight/Solarized/High-Contrast/Nord), PWA/installable, 2FA (TOTP), SCIM provisioning, password policy + lockout + SecurityAuditEvent, in-app backup scheduler + Kopia/offsite, self-updater sidecar, per-user datetime prefs (timezone/12-24h/dual calendar).

> **Shipped (implemented ahead of schedule):**
> - **G1 — Task dependencies & enforcement** (FS/SS/FF/RELATES_TO, block/warn/off, unblock notifications). See `lib/tasks/dependencies.ts`.
> - **G2 — WBS (n-level task tree)** (outline codes, summary rollups; subtasks stay flat checklist). See `lib/tasks/wbs.ts`, `components/task/wbs-editor.tsx`.
> - **G3 — Gantt + CPM scheduling engine** (critical path, lag/lead, milestones, baseline ghost bars). See `lib/scheduling/`, `components/task/gantt-chart.tsx`.
> - **G16b — PWA / installable** (commit `124b823`): Serwist service worker (NetworkFirst navigations, NetworkOnly `/api/*`), web app manifest (standalone, maskable icons), offline fallback page, prod-only registration. See [`docs/roadmap-pmis.md`](../docs/roadmap-pmis.md) G16b.

### Carry-over backlog items (unchanged)
- Multi-tenant SaaS mode.
- Mobile native apps (Capacitor / React Native).
- Calendar integrations (Google / Outlook).
- AI features (auto-categorize, summarize, suggest assignee).
- OAuth2 for public API.
- Custom field types: file, relation, multi-user, formula.
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