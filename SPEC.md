# Product Spec — Task Management Platform (Enterprise Edition)

> **Read this first.** Source of truth for what we're building. Anything not here is out of scope.
> **Audience:** engineering team, AI coding agents, product, ops.
> **Status:** v0.2 — kickoff.

---

## 0. TL;DR

A self-hosted, multi-user task management platform for companies. Runs on the customer's own infrastructure (on-premise or private cloud). Supports **local accounts, LDAP, and SAML SSO**. Ships in **Persian (default) and English** with full RTL. Built to handle **1k–10k concurrent users per organization** with horizontal scaling. Designed for IT departments that need control, auditability, and compliance — not for hobbyists.

**V1 ships with:**
- Local + LDAP + SAML auth
- Projects + tasks + subtasks + comments + mentions
- **Custom fields per project** (define schema, render on tasks, filter by)
- **Public REST API + webhooks** for third-party integrations
- Notifications (in-app + email) + realtime updates
- Reports + dashboards + admin panel
- Persian + English with RTL + Jalali calendar
- Theming with per-user accent color
- Audit log + RBAC
- On-prem deployment via Docker Compose or Helm

---

## 1. Decisions Locked From The User

| # | Decision | Default picked |
|---|----------|----------------|
| 1 | Auth providers | **Local (email+password) + LDAP + SAML 2.0** (all three, switchable per organization) |
| 2 | Deployment | **On-premise / customer-managed**. No SaaS. No telemetry to vendor. |
| 3 | Data export | **V1.1** (not in MVP) |
| 4 | i18n | **Persian (fa-IR) — default**, **English (en-US)**. RTL ready, Jalali calendar. |
| 5 | Theming | **User-customizable accent color** (per-user, persisted) |
| 6 | Custom fields per project | **V1** (in scope) |
| 7 | Public REST API + webhooks | **V1** (in scope) |

> If any of these are wrong, fix this file before coding starts. Re-litigating mid-build is expensive.

---

## 2. Open Architectural Questions (decide now or it bites later)

| # | Question | Recommended default | Why it matters |
|---|----------|--------------------|----------------|
| A1 | **Multi-tenant SaaS** OR **single-org-per-install**? | **Single-org-per-install** | Multi-tenant would force tenant_id on every row, row-level security, separate DB schemas per tenant. **Confirm with the user before Phase 0.** |
| A2 | **High availability** posture? | **Single-region active-passive**, hot standby | Multi-region active-active is overkill for V1 and doubles the ops cost. |
| A3 | **Database** for V1? | **PostgreSQL 16** with **PgBouncer** in front | Required for LDAP group queries, JSONB, FTS, partitioning for audit logs. |
| A4 | **WebSocket gateway** for realtime? | **Yes, Socket.IO with Redis adapter** | Tasks/comments must update live across users. |
| A5 | **File attachments**? | **Yes, S3-compatible (MinIO default)** | Tasks have attachments (images, PDFs). |
| A6 | **Email** for notifications? | **SMTP**, customer provides their own mail server | No external mail service. |
| A7 | **Public API auth model** | **Personal API tokens (per-user, scoped, expiring)** | OAuth2 deferred to V2; tokens cover the 90% case. |
| A8 | **Webhook signing** | **HMAC-SHA256** with shared secret per webhook | Industry standard (GitHub-style), no PKI needed. |
| A9 | **Webhook delivery model** | **At-least-once with exponential backoff + dead-letter** | Customer integrations should be tolerant; we prefer visibility over strict-once. |
| A10 | **Custom field value store** | **Separate `CustomFieldValue` table** (not JSONB blob on Task) | Filterable, indexable, validated per-type. |
| A11 | **Custom field types in V1** | text, number, date, single-select, multi-select, user, checkbox, URL | Cover 90% of enterprise use cases. File/multi-user/relation deferred to V1.1. |

---

## 3. Goals & Non-Goals

### Goals (V1)
- **1k–10k concurrent users per organization**, p95 API latency < 300 ms.
- **Three auth modes** in the same UI, switchable per organization: local, LDAP, SAML.
- **SSO-ready** — admin configures the IdP once, users sign in via their corporate credentials.
- **Audit log** of every read/write of every task by every user, queryable by admin.
- **RBAC** — roles (Owner, Admin, Manager, Member, Guest) + per-project permissions.
- **Custom fields per project** — admins define a schema per project; users fill values on tasks; filterable and searchable.
- **Public REST API** — programmatic access for third-party integrations, with personal API tokens and per-token scopes.
- **Webhooks** — push event notifications to customer URLs, HMAC-signed, retried with backoff.
- **Bilingual** — `fa-IR` (RTL, Jalali dates) and `en-US`, switchable per user.
- **On-prem installable** — single `docker compose up` for small deployments, Helm chart for k8s.
- **No outbound traffic** — no analytics, no error reporting to third parties, no CDN.

### Non-Goals (V1)
- Multi-tenant SaaS (one install = one org).
- Mobile native apps (responsive web only; PWA installable).
- Calendar integrations (Google/Outlook).
- Time tracking / pomodoro / kanban (lite kanban may ship in V1; full kanban in V1.1).
- Customer support ticketing / helpdesk features.
- Marketplace / third-party plugins.
- OAuth2 for the public API (V2; tokens cover V1).
- Custom field types beyond the 8 listed (file, relation, formula — V1.1).
- Approval workflows, SLA policies (V2).
- Multi-region active-active.

---

## 4. Target Customer

**Mid-market to enterprise companies** (200–10,000 employees) that:
- Run their own IT infrastructure or private cloud.
- Have an LDAP/AD or SAML IdP already.
- Need Persian-language UI for their workforce.
- Require audit logs for compliance (SOX-style, ISO 27001).
- Have integration needs with internal systems (ERP, CRM, custom apps) — driving the public API + webhooks.
- Are willing to deploy and operate the platform themselves with our documentation.

**Not** targeting: freelancers, small teams (use a SaaS), regulated industries that demand FedRAMP / HIPAA / IRAP (that's a future compliance edition).

---

## 5. Personas

| Persona | Wants | Cares about |
|---------|-------|-------------|
| **End user (employee)** | Capture tasks fast, see today's work, collaborate with team | Speed, keyboard shortcuts, Persian UI |
| **Project manager** | Define project workflow (custom fields), assign work, track progress | Reports, dashboards, filtering by custom fields |
| **Department head** | Oversee all projects in their department | Cross-project reports, load by team member |
| **Integration developer** | Read/write tasks from internal systems, react to events | Public API, webhooks, OpenAPI spec |
| **IT admin** | Install, configure, integrate with AD/LDAP/SAML, monitor | Deployment simplicity, SSO config UI, logs |
| **Org owner** | Full control, user provisioning | User management, audit, backup/restore |
| **Auditor / compliance** | Prove who did what when | Immutable audit log |

---

## 6. Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| **App framework** | Next.js 14 (App Router) + TypeScript strict | Unified frontend + BFF; SSR for fast first paint; mature ecosystem |
| **API runtime** | Node.js 20 LTS, Fastify (extracted if scaling demands) | Fastify is ~3x faster than Express; first-class TS |
| **Database** | PostgreSQL 16 + PgBouncer | Required for FTS, JSONB, partitioning; pooling mandatory at scale |
| **Cache / pub-sub / sessions** | Redis 7 | Session store, BullMQ queue backend, Socket.IO adapter, rate limiting, idempotency keys |
| **Background jobs** | BullMQ (Redis-backed) | Email, webhooks, audit log compaction, exports, LDAP sync |
| **Object storage** | S3-compatible — MinIO bundled in Docker Compose | Attachments; swappable to customer S3 in prod |
| **Realtime** | Socket.IO with `@socket.io/redis-adapter` | Live task updates, presence indicators, notifications |
| **Auth** | Auth.js v5 (NextAuth) + custom LDAP & SAML providers | Local + LDAP + SAML in one framework |
| **LDAP client** | `ldapts` | Promise-based, modern, well-maintained |
| **SAML** | `@node-saml/node-saml` | Standard-compliant, maintained |
| **i18n** | `next-intl` | SSR-friendly, ICU MessageFormat, RTL built-in |
| **Date (Jalali)** | `date-fns-jalali` | Tree-shakable, paired with `date-fns` |
| **Styling** | Tailwind CSS + shadcn/ui | Fast, accessible, theme-able via CSS variables — see `DESIGN.md` |
| **Forms / validation** | React Hook Form + Zod | Shared client/server validation |
| **Email** | Nodemailer (SMTP) | Customer provides server; no external dep |
| **Logging** | Pino → Loki (via Promtail) | Structured JSON, no SaaS |
| **Metrics** | prom-client → Prometheus → Grafana | Standard self-hosted observability |
| **Tracing** | OpenTelemetry → Tempo (optional) | Standard, vendor-neutral |
| **API docs** | OpenAPI 3.1 generated from Zod schemas | Spec drives docs, codegen, contract tests |
| **Webhook signing** | HMAC-SHA256 (`crypto.createHmac`) | Standard, simple |
| **Testing** | Vitest (unit) + Playwright (e2e) + Testcontainers (integration) | Real DB/Redis in tests |
| **Containerization** | Docker + Docker Compose (small) + Helm chart (k8s) | Customer-friendly |
| **CI/CD** | GitHub Actions OR GitLab CI (customer chooses) | No lock-in |

**If the user wants a different runtime** (e.g., Go backend for raw perf, or Java for enterprise conservatism), say so now — the spec changes meaningfully.

---

## 7. Deployment Topology

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for full sizing, install, and ops guidance.

### 7.1 Small deployment (< 500 users, single host)
Single VM, Docker Compose, all services on one host. Webhook egress must be allowed to customer-defined URLs.

### 7.2 Large deployment (1k–10k users, k8s)
Kubernetes with HA Postgres (Patroni), Redis Sentinel, distributed MinIO, horizontally-scaled app + worker + socket.io pods.

### 7.3 HA (active-passive, single region)
- Postgres: primary + 1 synchronous replica, automatic failover.
- Redis: Sentinel (3-node) for HA.
- App: stateless, ≥ 2 replicas behind LB.
- Object storage: MinIO distributed (4 drives) or external S3.

> **Customer is responsible for backups.** We provide `scripts/backup.sh` for nightly pg_dump + MinIO snapshot to customer's storage of choice.

---

## 8. Data Model

Single-org per install, so **no `orgId` everywhere**. The DB user is dedicated to this application.

```
User
  id (uuid), email (citext, unique), passwordHash (nullable for SSO users),
  displayName, avatarUrl, locale (fa-IR | en-US), accentColor,
  theme (light | dark | system), density (compact | comfortable | spacious),
  status (active | suspended | invited), createdAt, lastLoginAt

AuthIdentity                        -- one user can have multiple linked identities
  id, userId, provider (local | ldap | saml),
  providerSubject (DN or NameID), providerIssuer,
  linkedAt, lastUsedAt

Role                                -- 'owner' | 'admin' | 'manager' | 'member' | 'guest'
  id, userId, scopeType (global | project), scopeId (nullable),
  grantedBy, grantedAt

Department
  id, name, parentId (nullable, tree), managerUserId (nullable)

Project
  id, name, description (markdown), color, ownerId,
  departmentId (nullable), visibility (private | department | org),
  status (active | archived), createdAt, archivedAt

ProjectMember
  projectId, userId, projectRole (lead | contributor | viewer),
  addedAt, addedBy

CustomField                         -- schema definition per project
  id, projectId, name, key (stable, slug, unique per project),
  type (text | number | date | select | multi_select | user | checkbox | url),
  required (bool), orderIndex,
  configJson:
    -- select/multi_select: { options: [{ value, label, color }], allowOther: bool }
    -- number: { min, max, step, unit }
    -- text: { maxLength, regex }
    -- date: { includeTime }
  createdAt, updatedAt, archivedAt

CustomFieldValue                    -- value per task per field
  id, taskId, customFieldId,
  valueText, valueNumber, valueDate, valueBool, valueJson (for multi_select, user)
  createdAt, updatedAt
  -- uniqueness: (taskId, customFieldId)

Task
  id, projectId, parentTaskId (nullable, max depth 2),
  title, description (markdown),
  status (open | in_progress | done | cancelled),
  priority (low | med | high | urgent),
  dueDate (timestamptz, nullable), startDate (nullable),
  recurrenceRule (RRULE string, nullable),
  assigneeId (nullable), reporterId, createdById,
  estimatedHours (numeric, nullable), spentHours (numeric, nullable),
  orderIndex (bigint, fractional), -- for drag-reorder
  completedAt, createdAt, updatedAt

Tag
  id, name (unique within project), color, projectId (nullable for global)

TaskTag (join)                      taskId, tagId

Attachment
  id, taskId, filename, mimeType, sizeBytes, storageKey (S3 key),
  uploadedById, createdAt

Comment                             -- threaded comments on tasks
  id, taskId, authorId, parentCommentId (nullable, max depth 3),
  bodyMarkdown, editedAt, deletedAt

Watcher                             -- users watching a task for changes
  taskId, userId, addedAt

Notification
  id, userId, type (assigned | mentioned | due_soon | commented | status_changed),
  payloadJson, taskId (nullable), readAt (nullable), createdAt

AuditLog                            -- append-only
  id, actorUserId (nullable for system actions), actorIp,
  action (created | updated | deleted | viewed | exported | ...),
  entityType (task | project | user | ...), entityId,
  beforeJson (nullable), afterJson (nullable),
  occurredAt (timestamptz), requestId

ApiToken                            -- for public REST API
  id, userId, name, hashedToken (sha256), prefix (first 8 chars, for display),
  scopes (text[]),                  -- e.g., ['tasks:read', 'tasks:write']
  expiresAt (nullable), lastUsedAt, createdAt, revokedAt (nullable)

Webhook                             -- outbound HTTP hooks
  id, name, url, secret (encrypted), -- HMAC signing key
  events (text[]),                  -- e.g., ['task.created', 'task.updated']
  active (bool), description,
  createdById, createdAt, updatedAt, lastDeliveryAt

WebhookDelivery                    -- one row per delivery attempt
  id, webhookId, eventType, eventId (uuid for idempotency),
  attemptNumber, requestPayload (jsonb), responseStatus (nullable),
  responseBody (nullable, truncated), responseHeaders (nullable, jsonb),
  durationMs, error (nullable),
  scheduledAt, deliveredAt (nullable), nextRetryAt (nullable)

Settings                            -- single row per install + per-user overrides
  id, scope (install | user), scopeId,
  key, valueJson
```

**Indexes (mandatory):**
- `task(projectId, status, dueDate)` — main list queries.
- `task(assigneeId, status, dueDate)` — "my tasks" view.
- `task(projectId, orderIndex)` — drag-reorder within project.
- `customfield(projectId, key)` — schema lookup.
- `customfieldvalue(taskId)` — load all values for a task.
- `customfieldvalue(customFieldId, valueText)` and `(customFieldId, valueNumber)` and `(customFieldId, valueDate)` — filter by custom field.
- `auditlog(entityType, entityId, occurredAt DESC)` — audit timeline.
- `auditlog(actorUserId, occurredAt DESC)` — "what did X do".
- `notification(userId, readAt, createdAt DESC)` — inbox.
- `comment(taskId, createdAt)`.
- `apitoken(hashedToken)` — token lookup (O(1) on auth).
- `apitoken(userId)` — list user's tokens.
- `webhookdelivery(webhookId, scheduledAt)` — delivery queue view.
- `webhookdelivery(eventId)` — dedupe on retry.

**Partitioning:**
- `auditlog` partitioned monthly (pg_partman or manual). Retention default 2 years, configurable.
- `webhookdelivery` partitioned monthly; rows pruned 30 days after `deliveredAt` or final failure.

---

## 9. Authentication & Authorization

See [`AUTH.md`](./AUTH.md) for the full integration guide.

### 9.1 Three providers, switchable
- **Local:** email + bcrypt(12) password, magic-link recovery.
- **LDAP:** bind to corporate AD/OpenLDAP. Sync users + groups on a schedule.
- **SAML 2.0:** integrate with any IdP (Azure AD, Okta, AD FS, Keycloak). SP-initiated and IdP-initiated.

### 9.2 Just-In-Time provisioning
- LDAP/SAML users are created in our DB on first successful auth, mapped to a default role.
- Admin can change role after first login.

### 9.3 RBAC matrix

| Action | Owner | Admin | Manager | Member | Guest |
|--------|:-----:|:-----:|:-------:|:------:|:-----:|
| Manage org settings | ✅ | ✅ | — | — | — |
| Create / delete projects | ✅ | ✅ | ✅ (in dept) | — | — |
| Define custom field schema | ✅ | ✅ | ✅ (lead) | — | — |
| Assign project role | ✅ | ✅ | ✅ (lead) | — | — |
| Create tasks | ✅ | ✅ | ✅ | ✅ | — |
| Edit own tasks | ✅ | ✅ | ✅ | ✅ | — |
| Edit others' tasks | ✅ | ✅ | ✅ | — | — |
| Comment | ✅ | ✅ | ✅ | ✅ | ✅ (if allowed) |
| View audit log | ✅ | ✅ | — | — | — |
| Export data | ✅ | ✅ | ✅ (own dept) | — | — |
| Manage users / roles | ✅ | ✅ | — | — | — |
| Manage API tokens (own) | ✅ | ✅ | ✅ | ✅ | — |
| Manage webhooks | ✅ | ✅ | — | — | — |
| Configure SSO / LDAP | ✅ | ✅ | — | — | — |

### 9.4 Session strategy
- JWT session token in httpOnly + secure + sameSite=lax cookie.
- Sliding expiration (30 min idle, 12h max).
- Server-side session record in Redis for revocation (logout-everywhere button).
- CSRF token required for all state-changing requests.

### 9.5 API token (separate from session)
- See §11.3.

---

## 10. Core Features

### 10.1 Tasks
- Create / edit / delete / complete / archive / restore.
- Subtasks (max depth 2).
- Fields: title, description (markdown), assignee, reporter, due date, start date, priority, tags, recurrence, estimated/spent hours, attachments, **custom field values**.
- Bulk actions: complete, delete, reassign, tag, reschedule, set custom field values.
- Quick add via `Cmd/Ctrl+K` from anywhere.
- Inline edit; soft-delete with undo (5 s toast).
- Drag-to-reorder within a project.

### 10.2 Projects
- Group tasks into projects. Each has owner, color, visibility, optional department.
- Private / Department / Org visibility.
- Archive (read-only) vs delete (Owner only, soft delete, 30-day restore window).
- Project templates (V1.1).

### 10.3 Custom Fields (per project) ← V1

**Goal:** each project can extend the task schema with fields its workflow needs. Examples: "Story points" (number), "Component" (single-select), "Reviewers" (multi-user, V1.1), "Severity" (single-select), "QA URL" (url).

**Schema definition (Admin / Manager / Project Lead):**
- Add / edit / reorder / archive fields within a project.
- Field types: text, number, date, single-select, multi-select, user, checkbox, URL.
- Per-field config: required, default value, validation (number min/max/step, text maxLength/regex, select options with colors).
- Archived fields hidden from new tasks but preserved on existing tasks (read-only).

**Value rendering:**
- Each task detail page shows the project's field schema as a form section.
- Required fields validated on save.
- Filter UI: "Filter by [Field] = [Value]" for any field type.
- Sort: by number, date, or select fields.

**Search integration:**
- Custom field values indexed in FTS where type permits (text fields).
- Search query syntax: `custom:Component=Backend` (V1.1).

**API integration:**
- `GET /api/v1/projects/:id/custom-fields` — list schema.
- Task create/update payloads accept `customFields: { key: value }` map.
- Response includes resolved custom field values.

### 10.4 Views
- **Today** — due today + overdue, my tasks.
- **Upcoming** — next 14 days, grouped by day, Jalali or Gregorian per user.
- **Inbox** — unassigned + watching.
- **All tasks in project.**
- **My tasks** — assigned to me across projects.
- **Custom filters** — saved per user (V1.1).

### 10.5 Filters & Search
- Filter by: project, assignee, reporter, priority, tags, status, due range, **custom field value**.
- Full-text search (Postgres FTS) on title + description + comments + text-typed custom fields.
- Search persists recent queries per user.

### 10.6 Collaboration
- @mentions in task title/description/comment → notification + email.
- Comments threaded (max 3 levels).
- Watchers (auto-add assignee + reporter + mentionees; manual add).
- Activity feed per task.

### 10.7 Real-time
- Live task updates across users (Socket.IO).
- Presence indicator ("X is viewing this task").
- Live comment thread.
- Webhook fan-out on entity changes (see §11.4).

### 10.8 Notifications
- In-app notification center (badge + dropdown).
- Email digests: instant for mentions/assignments; daily summary configurable.
- User preferences per category.

### 10.9 Public REST API ← V1

**See §11 for endpoints.** Summary:

- Base URL: `/api/v1/public/` (separate from internal `/api/v1/`).
- Auth: `Authorization: Bearer <token>` (personal API tokens; see §11.3).
- Full OpenAPI 3.1 spec at `/api/v1/public/openapi.json` and Swagger UI at `/api/v1/public/docs`.
- Same RBAC enforced as internal endpoints (token holder's role determines what they can do).
- Per-token scopes (e.g., `tasks:read`, `tasks:write`, `projects:read`, `webhooks:manage`).
- Rate limit: 60 req/min/token; 600 req/min/user aggregate.
- Versioned: `/api/v1/public/` — new minor versions add fields; breaking changes get `/v2/`.

### 10.10 Webhooks ← V1

**See §11.4 for delivery internals.** Summary:

- Admin / Owner can register webhook subscriptions at `/admin/webhooks`.
- Each webhook has: name, target URL, subscribed events, signing secret (auto-generated, shown once).
- Events emitted: `task.created`, `task.updated`, `task.deleted`, `task.status_changed`, `task.assigned`, `comment.created`, `project.created`, `project.updated`, `user.created`, `custom_field.updated`.
- Delivery: HMAC-SHA256 signed POST, JSON payload, 10 s timeout.
- Retry: exponential backoff (1 m, 5 m, 30 m, 2 h, 12 h, 24 h) — 6 attempts.
- After exhaustion: marked `failed`, listed in dead-letter view.
- Delivery log per webhook with full request/response capture (truncated).
- Test endpoint: `POST /api/v1/public/webhooks/:id/test` sends a synthetic event.
- Replay endpoint: `POST /api/v1/public/webhook-deliveries/:id/replay` re-sends a past delivery.

### 10.11 Reports & Dashboards
- **My dashboard:** today's tasks, upcoming, overdue, recent activity.
- **Project dashboard:** progress by status, burndown, assignee load.
- **Org dashboard (Admin/Owner):** projects overview, user activity, audit highlights, **webhook delivery health**.
- All exportable as CSV (V1.1) / PDF (V2).

### 10.12 Admin
- **Users:** list, invite, suspend, role change, force logout.
- **Departments:** CRUD, tree view.
- **LDAP config:** server URL, bind DN, base DN, sync schedule, attribute mapping.
- **SAML config:** metadata upload, attribute mapping, test login.
- **Email config (SMTP):** host, port, user, password, from address, test send.
- **Storage config:** S3 / MinIO connection, bucket, test.
- **Audit log search:** filter by user, entity, date range, action; export CSV.
- **API tokens** (per user) + **webhooks** (org-wide) management.
- **Backup / restore:** manual trigger of backup script; restore from uploaded dump.
- **Settings:** site name, default locale, accent color default, session timeout.

### 10.13 Keyboard shortcuts (table stakes)

| Key | Action |
|-----|--------|
| `C` | New task (in current project) |
| `Cmd/Ctrl+K` | Quick add / command palette |
| `Cmd/Ctrl+Enter` | Save & close |
| `E` | Edit focused task |
| `Space` | Toggle complete |
| `Del` | Delete (with undo) |
| `M` | Assign |
| `T` | Set due date |
| `P` | Set priority |
| `/` | Focus search |
| `G I` / `G T` / `G U` / `G P` | Go to Inbox / Today / Upcoming / Project |
| `?` | Shortcut help |

---

## 11. API Surface

### 11.1 Internal REST (`/api/v1/`)

Session-cookie auth. Used by the web UI.

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/auth/login` | Local login |
| `POST` | `/api/v1/auth/logout` | Logout (revokes session) |
| `POST` | `/api/v1/auth/ldap/start` | Begin LDAP flow |
| `POST` | `/api/v1/auth/saml/start` | Begin SAML flow |
| `GET/POST/PATCH/DELETE` | `/api/v1/users[/:id]` | User CRUD (admin) |
| `POST` | `/api/v1/users/:id/suspend` | Suspend user |
| `GET/POST/PATCH/DELETE` | `/api/v1/projects[/:id]` | Project CRUD |
| `POST` | `/api/v1/projects/:id/members` | Add member |
| `GET/POST/PATCH/DELETE` | `/api/v1/projects/:id/custom-fields[/:fieldId]` | Custom field schema CRUD |
| `GET/POST/PATCH/DELETE` | `/api/v1/tasks[/:id]` | Task CRUD (custom field values in payload) |
| `POST` | `/api/v1/tasks/reorder` | Bulk reorder |
| `POST` | `/api/v1/tasks/:id/comments` | Add comment |
| `POST` | `/api/v1/tasks/:id/attachments` | Upload attachment |
| `GET/POST/PATCH/DELETE` | `/api/v1/tags[/:id]` | Tag CRUD |
| `GET` | `/api/v1/notifications` | List my notifications |
| `POST` | `/api/v1/notifications/:id/read` | Mark read |
| `GET` | `/api/v1/audit` | Audit log search (admin) |
| `GET` | `/api/v1/reports/*` | Reports |
| `WS` | `/ws` | Socket.IO realtime gateway |

### 11.2 Public REST (`/api/v1/public/`)

Bearer-token auth. Same RBAC as internal, but per-token scope filtering.

| Method | Path | Scopes | Purpose |
|--------|------|--------|---------|
| `GET` | `/api/v1/public/openapi.json` | (none) | OpenAPI 3.1 spec |
| `GET` | `/api/v1/public/docs` | (none) | Swagger UI |
| `GET` | `/api/v1/public/me` | (token) | Current identity (token holder) |
| `GET` `/POST` | `/api/v1/public/tasks` | `tasks:read` / `tasks:write` | List / create |
| `GET` `/PATCH` `/DELETE` | `/api/v1/public/tasks/:id` | `tasks:read` / `tasks:write` | Read / update / delete |
| `POST` | `/api/v1/public/tasks/:id/comments` | `tasks:write` or `comments:write` | Comment |
| `GET` | `/api/v1/public/projects` | `projects:read` | List |
| `GET` `/POST` | `/api/v1/public/projects` | `projects:read` / `projects:write` | List / create |
| `GET` | `/api/v1/public/projects/:id` | `projects:read` | Read |
| `GET` | `/api/v1/public/projects/:id/custom-fields` | `projects:read` | Get schema |
| `GET` `/POST` | `/api/v1/public/users` | `users:read` / `users:write` | List / create |
| `GET` | `/api/v1/public/users/:id` | `users:read` | Read |
| `GET` `/POST` `/PATCH` `/DELETE` | `/api/v1/public/webhooks[/:id]` | `webhooks:manage` | Webhook CRUD |
| `POST` | `/api/v1/public/webhooks/:id/test` | `webhooks:manage` | Send test event |
| `GET` | `/api/v1/public/webhook-deliveries` | `webhooks:manage` | List deliveries |
| `POST` | `/api/v1/public/webhook-deliveries/:id/replay` | `webhooks:manage` | Replay a delivery |
| `GET` `/POST` `/DELETE` | `/api/v1/public/tokens[/:id]` | (none) | User manages own tokens |
| `GET` `/POST` | `/api/v1/public/api-docs` | (none) | API docs / changelog |

### 11.3 API Token Model

```
Token = "tk_" + base64url(32 random bytes)   // 36 chars total
Stored as SHA-256 hash. Shown once on creation.
Prefix "tk_" + first 4 chars of the random portion displayed for identification ("tk_aB3x...").
Scopes: subset of [tasks:read, tasks:write, projects:read, projects:write, users:read, users:write, comments:write, webhooks:manage]
Expires: optional; default no expiry; UI warns for tokens older than 1 year.
Revocation: instant via DELETE; existing in-flight requests allowed to complete.
Last used: tracked per request; surfaced in token list.
```

Auth header: `Authorization: Bearer tk_aB3x...`.

Rate limits: 60 req/min per token, 600 req/min per user aggregate, configurable per token in V1.1.

### 11.4 Webhook Delivery

```
Event payload (POST to webhook URL):
{
  "id": "evt_<uuid>",                  // unique per delivery attempt-set
  "type": "task.created",
  "createdAt": "2024-12-01T10:30:00Z",
  "apiVersion": "2024-12-01",
  "data": { ... event-specific object ... },
  "actor": { "id": "...", "type": "user" | "system" | "api_token" }
}

Headers:
  Content-Type: application/json
  User-Agent: TaskApp-Webhooks/1.0
  X-TaskApp-Event-Id: evt_<uuid>
  X-TaskApp-Event-Type: task.created
  X-TaskApp-Delivery-Id: <webhookdelivery_id>
  X-TaskApp-Signature: sha256=<hex_hmac_sha256(body, secret)>
  X-TaskApp-Timestamp: <unix_seconds>

Signing: HMAC-SHA256 of the raw body using the webhook's secret.
Receivers verify by recomputing and constant-time comparing.
Receivers should also reject events whose timestamp is more than 5 minutes old (replay protection).
```

Retry policy:
- On 2xx: success, no retry.
- On 4xx (except 408, 429): no retry — client config error; mark delivery `failed`, alert admin.
- On 408, 429, 5xx, network error: retry.
- Backoff: 1 m, 5 m, 30 m, 2 h, 12 h, 24 h — 6 attempts total.
- After 6 failures: `failed_dead`, no further retries; visible in dead-letter view.

Concurrency: webhook deliveries for the same webhook are serialized to preserve order. Different webhooks run in parallel.

Idempotency: receivers dedupe on `X-TaskApp-Event-Id`. We may send the same event multiple times (at-least-once delivery).

### 11.5 Conventions
- List endpoints: `?limit=50&cursor=...&filter[...]` — cursor-based pagination.
- Mutations: result is `{ data }` or `{ error: { code, message, field? } }`.
- All errors RFC 7807 (Problem Details for HTTP APIs).
- Rate limit: 100 req/min/user general, 10 req/min on `/auth/*`.
- Idempotency key required for `POST /tasks` and `POST /comments` (retry-safe).
- Public API: same conventions; `Authorization: Bearer` instead of session cookie.

---

## 12. Internationalization

See [`i18n.md`](./i18n.md) for the full guide.

- **Locales:** `fa-IR` (default), `en-US`.
- **Direction:** `fa-IR` is RTL; layout must mirror.
- **Calendar:** `fa-IR` users see Jalali dates by default, with toggle to Gregorian per task.
- **Numbers:** Persian numerals optional per user.
- **Translations** in `messages/fa-IR.json`, `messages/en-US.json` (ICU format).
- **No hardcoded strings** in components — every label via `useTranslations()`.
- **RTL testing** in Playwright with `locale=fa-IR` in the browser context.

---

## 13. Theming & Visual Design

See [`DESIGN.md`](./DESIGN.md) for the full design system.

Summary:
- **Tokens-based:** all colors, spacing, typography, motion defined as CSS variables in `tokens.css`.
- **Light + dark mode** following system preference, manual override.
- **Accent color** per user (CSS variable `--accent`), 8 preset options + custom hex picker.
- **Persisted** in DB and applied via inline `<style>` on `<html>` to avoid FOUC.
- **RTL-first** layouts using logical CSS properties.
- **All accents meet WCAG AA contrast** on both backgrounds.

---

## 14. Security

- **Transport:** TLS required; HSTS; secure cookies.
- **Auth:** bcrypt (cost 12) for local passwords; SSO bypasses local password.
- **Sessions:** opaque session id in cookie; server-side record in Redis; revocation supported.
- **CSRF:** double-submit cookie on state-changing endpoints.
- **Input validation:** Zod on all endpoints, reject unknown fields.
- **SQL:** Prisma only — no raw SQL with string interpolation.
- **XSS:** markdown rendered with DOMPurify + allowlist; never `dangerouslySetInnerHTML`.
- **Secrets:** env vars only, never committed; `.env.example` provided.
- **Audit:** every read of audit-restricted entities logged; every write logged with before/after.
- **File uploads:** mime sniff, size limit (25 MB default), antivirus hook (V2 optional).
- **Headers:** CSP, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy same-origin.
- **Rate limiting:** per IP and per user, Redis-backed.
- **API tokens:** hashed at rest (SHA-256); shown once on creation; scope-limited; revocable.
- **Webhooks:** HMAC-SHA256 signed; receivers verify signature + timestamp; replay window 5 min.
- **Webhook egress:** customer must allow outbound HTTPS from app/worker pods to webhook URLs.
- **Webhook secrets:** encrypted at rest (AES-256-GCM with key from env).
- **Pen test:** required before V1 ships.

---

## 15. Observability

- **Logs:** Pino → stdout (JSON) → Promtail → Loki. Every request gets a `requestId`.
- **Metrics:** Prometheus scrapes `/metrics` from each app instance.
  - HTTP duration histogram, status code counter, WS connections gauge, queue depth gauge, DB pool utilization, **webhook delivery success/failure counter by webhook, API token usage counter by token**.
- **Dashboards:** Grafana with pre-built JSON dashboards in `ops/grafana/`.
- **Alerts:** Alertmanager rules for high error rate, queue backlog, disk full, replica lag, **webhook delivery failure rate**.

---

## 16. Non-Functional Requirements

- **Performance:** p95 API latency < 300 ms (cached < 50 ms); LCP < 1.5 s on 4G.
- **Availability target:** 99.5% per quarter (active-passive HA).
- **Capacity (small deployment):** 500 users, 50k tasks, 10 GB attachments.
- **Capacity (large deployment):** 10k users, 5M tasks, 1 TB attachments, horizontal scale.
- **Backup RPO:** 24 h (nightly dump). RTO: 4 h.
- **Browser support:** last 2 versions of Chrome, Firefox, Edge, Safari.
- **Accessibility:** WCAG 2.1 AA, including RTL and screen reader compatibility.
- **API stability:** minor versions add fields without breaking; breaking changes get a new version path.

---

## 17. Success Metrics (V1)

- **Time to install** (small deployment, customer with admin skills): < 4 hours from `docker compose up` to first user signup.
- **Time to first task:** < 5 minutes from signup.
- **Daily active rate:** > 40% of provisioned users at 8 weeks.
- **SSO setup success rate:** > 90% of admins complete SAML config without our help.
- **Public API adoption:** ≥ 10% of customers register an API token within 60 days of install.
- **Webhook success rate:** ≥ 99% of webhook deliveries succeed on first attempt over a rolling 30-day window.

---

## 18. Out of Scope (V1)

- Multi-tenant SaaS mode.
- Mobile native apps.
- Calendar integrations.
- Time tracking / pomodoro / kanban (lite kanban possible in V1).
- AI features (auto-categorize, summarize, suggest assignee).
- OAuth2 for public API (V2).
- Custom field types beyond the 8 in §10.3 (V1.1).
- Approval workflows (V2).
- SLA / due-date escalation policies (V2).
- Multi-region active-active DR (V2).
- Customer support ticketing.
- Marketplace / plugins.
- Data export (CSV / JSON) (V1.1).
- Antivirus for attachments (V2).
- SSO for additional IdPs (WS-Federation, OIDC) (V2).

These are listed in `TASKS.md` § Backlog for future planning.

---

## 19. Phased Delivery

See [`TASKS.md`](./TASKS.md) for the build plan.

| Phase | Outcome | Target |
|-------|---------|--------|
| 0 | Repo scaffolding, Docker Compose dev env | Internal |
| 1 | DB schema, migrations, seed | Internal |
| 2 | Auth: local + LDAP + SAML | Internal |
| 3 | RBAC + Users + Departments | Internal |
| 4 | Projects + Tasks + **Custom Fields** CRUD, realtime | Internal |
| 5 | Collaboration (comments, mentions, notifications, email) | Internal |
| 6 | Realtime + Search | Internal |
| 7 | **Public REST API + Webhooks**, Reports, Dashboards, Admin | Internal |
| 8 | i18n (fa-IR + en-US), RTL, Jalali | Internal |
| 9 | Audit log, RBAC enforcement, security pass, **token + webhook RBAC tests** | Internal |
| 10 | **DESIGN system implementation**, theming + accessibility | Internal |
| 11 | On-prem deployment packaging (Docker, Helm) | **Beta** |
| 12 | Beta with 3 pilot customers, harden | **GA** |

---

## 20. Open Questions Still To Resolve

1. **A1 — Multi-tenant vs single-org-per-install.** (See §2.) **Default: single-org-per-install. Confirm.**
2. **Email deliverability** — customer provides SMTP, but do we provide a fallback SMTP relay for V1?
3. **Lite kanban view** in V1 or V1.1? (User said kanban is V2/out-of-scope; lite kanban = just columns for status, no other kanban features.)
4. **Custom field user-picker** — single user only, or multi-user in V1? (Currently specified as single-user; multi-user is V1.1.)
5. **Webhooks for internal events only** or also expose to inbound (customer pushes events to us)? — Inbound is V2.
6. **API token default expiry** — none, or 1 year with warning?
7. **Webhook dead-letter alerting** — alert admin via email when delivery permanently fails?
8. **Multi-region DR** — V1 or V2?
9. **Compliance certifications** — ISO 27001 / SOC 2 — target timeline?

---

**Last updated:** kickoff v0.2
**Next review:** end of Phase 2 (auth done)