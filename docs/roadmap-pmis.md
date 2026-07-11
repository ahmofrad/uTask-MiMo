# PMIS Extension Roadmap — Detailed Gap Analysis

> Companion to [`TASKS.md`](../TASKS.md) § Backlog and [`SPEC.md`](../SPEC.md) §18.
> Source of truth for the PMIS/EPM features that **uTask does not yet have** but
> the reference implementation "ProjectHub" (a.k.a. TaskHub) ships as waves R0–R9.
> This document is intentionally detailed so each module can be planned and built
> later without re-deriving the design. Nothing here is committed to the V1 contract.

## How to read this doc

- Each gap is a **G** entry (G1–G16) with: goal, data model, endpoint sketch,
  RBAC subject, audit targets, i18n keys, and dependencies.
- Dependency order (build sequence):
  - **Planning spine:** G1 (deps) → G2 (WBS) → G3 (Gantt/CPM) → G4 (baselines/EVM)
  - **Resource/cost spine:** G5 (resources) → G6 (timesheets) → G7 (cost ledger)
  - **Lifecycle spine:** G8 (risk) → G9 (change requests) → G10 (procurement) → G11 (quality/NCR) → G12 (records framework)
  - **Governance spine:** R0 plumbing → G13 (portfolio/org-units) → G14 (profiles/module registry)
  - **Cross-cutting:** G15 (RACI, approval gate, RAG, automations, intake forms, standalone tasks, holidays) — mostly independent, land anytime after Phase 4
  - **Ops/spine:** G16 (themes, PWA, 2FA, SCIM, password policy, in-app backup, datetime prefs)
- Every new model is **additive** (new migration, no backfill unless noted) and
  follows uTask conventions: soft-delete via `deletedAt`, `WHERE deletedAt IS NULL`,
  cursor pagination, audit on every mutation, Zod validation, RBAC via `lib/rbac/can`,
  i18n via `useTranslations`, dates via `lib/date/`, design tokens only, logical CSS.

---

## G1 — Task dependencies & enforcement

**Goal.** Let a task block/unblock others, with FS/SS/FF/RELATES_TO edges and
configurable enforcement (`off`/`warn`/`block`). Mirror ProjectHub `TaskDependency`.

**Data model.**

```prisma
model TaskDependency {
  id          String   @id @default(cuid())
  taskId      String   // the dependent (B)
  dependsOnId String   // the predecessor/blocker (A)
  type        DependencyType // FINISH_TO_START | START_TO_START | FINISH_TO_FINISH | RELATES_TO
  lag         Int      @default(0)        // signed lag/lead in days
  lagUnit     LagUnit  @default(DAY)      // DAY | HOUR
  teamId      String   // denormalized for tenancy
  createdBy   String
  createdAt   DateTime @default(now())
  deletedAt   DateTime?
  @@unique([taskId, dependsOnId, type])
  @@index([dependsOnId])
  @@index([teamId])
}
```

**Enforcement rules** (status-based, not date-based), gated by instance setting
`tasks.dependencyEnforcement`:

| Edge | Blocks B from…                              |
|------|---------------------------------------------|
| FS   | IN_PROGRESS / DONE while A != DONE          |
| SS   | IN_PROGRESS while A == TODO                 |
| FF   | DONE while A != DONE                        |
| RELATES_TO | never blocks                          |

- `countBlockersFor(taskId, nextStatus)` → `{ fs, ss, ff }` incomplete counts.
- `block` mode → `403 DEPENDENCY_BLOCKED`; `warn`/`off` → advisory only.
- `wouldCreateCycle` walks the edge graph (type-agnostic) → `409 DEPENDENCY_CYCLE`.
- On status advance, `notifyUnblocked()` fans `TASK_UNBLOCKED` to freed tasks' assignee + responsible.

**Endpoints.** `POST/DELETE /api/v1/projects/:projectId/tasks/:taskId/dependencies`
(+ `/:dependsOnId`), `GET …/dependencies`. Kanban blocker badge = FS-only count.

**RBAC.** Project WRITE to edit edges. **Audit:** dependency create/delete.
**i18n:** `dependencies.*` (blocked, unblocked, cycleError, enforced, warn).

---

## G2 — WBS (n-level task tree)

**Goal.** Nest Tasks into an outline with derived `wbsCode` ("1.2.3"), depth,
summary flag, and rollup `%`. Subtasks remain the flat leaf checklist.

**Data model.** Add to `Task`: `parentId String?` (self-FK, same project, `onDelete: SetNull`),
`wbsOrder Int @default(0)`. `MAX_WBS_DEPTH = 20`.

**Endpoints.** `POST /api/v1/projects/:projectId/tasks` accepts `parentId` (append as last child).
`POST …/tasks/:id/move { newParentId, position }` reparents/reorders with self-parent,
cross-project, cycle (walk ancestor chain), and depth-cap guards. Both reuse project WRITE.
`GET …/projects/:id/wbs` returns flat DFS pre-order with derived fields; `rollupPercentComplete`
= leaf-weighted average over subtree. Soft-deleted parent → child floats to a root in the view.

**RBAC/Audit/i18n.** WRITE to move; audit move/reparent; `wbs.*` (code, summary, depth).

---

## G3 — Gantt + CPM scheduling engine

**Goal.** Timeline view with critical-path highlighting, lag labels, milestone diamonds,
baseline ghost bars. Build on G1+G2.

**Data model.** `Task.isMilestone Boolean @default(false)`, `milestoneKind?`;
`Project.scheduleVersion Int @default(0)` bumped on any schedule-shaping change (dates, deps,
baseline capture/activate) to bust the in-memory CPM cache.

**Engine.** `lib/scheduling/cpm.ts`: on-demand forward/backward CPM over WBS-leaf tasks
(summary tasks excluded); cycles → `DEPENDENCY_CYCLE`; cache keyed `(projectId, scheduleVersion)`.

**Endpoints.** `GET /api/v1/projects/:id/reports/gantt?include=criticalPath,baseline,milestones`
returns `{ tasks, links, criticalChain }`; legacy subtask `rows` unchanged. `criticalPath` gated
`cpm_schedule`, `baseline` gated `baselines`. Frontend overlay: critical-path highlight, lag labels
(`FS+2d`), milestone diamonds, baseline ghost bars; row virtualization in the chart body.

**RBAC/Audit/i18n.** READ on project; `gantt.*` (criticalPath, milestone, baseline, lag).

---

## G4 — Baselines & Earned Value Management (EVM)

**Goal.** Freeze project baselines and compute EVM metrics (CPI/SPI/EAC) for S-curves.
Builds on G2+G3.

**Data model.**

```prisma
model ProjectBaseline {
  id         String         @id @default(cuid())
  projectId  String
  teamId     String         // denormalized tenancy
  name       String
  source     BaselineSource // MANUAL | CHANGE_REQUEST
  isCurrent  Boolean        @default(false)
  snapshot   Json
  capturedBy String
  capturedAt DateTime       @default(now())
  @@unique([projectId, isCurrent]) // exactly one current per project
}
model BaselineEntry {
  id          String   @id @default(cuid())
  baselineId  String
  taskId      String
  startDate   DateTime?
  endDate     DateTime?
  percentComplete Int?
}
model EvmSnapshot {
  id          String   @id @default(cuid())
  projectId   String
  snapshotDate DateTime
  bac, pv, ev, ac, cv, sv, cpi, spi, eac, vac, tcpi Float
  eacMethod   EacMethod // CPI_BASED | SPI_BASED | TCPI_BASED
  currency    String
}
```

**Logic.** Capture snapshots every live task's plan/progress into `BaselineEntry`; a new capture
demotes the rest in one transaction. `EvmService.computeEvm()`: BAC = Σ BudgetLines; PV = linear
interpolation over baseline bars × task budget; EV = Σ(percentComplete/100 × leafTaskBudget);
AC = Σ ActualCostEntry up to `asOf`. Three EAC methods. Snapshot → S-curve via `GET …/evm/series`.

**Endpoints.** `GET/POST …/projects/:id/baselines` (capture gated WRITE + `core.capture_baseline`),
`POST …/baselines/:id/activate`, `GET …/baselines/compare`, `GET …/reports/variance`, `GET …/evm/series`.
**Audit:** baseline capture/activate. **i18n:** `baselines.*`, `evm.*` (cpi, spi, eac, variance).

---

## G5 — Resource management

**Goal.** Catalog resources (people/equipment), skills, and assign them to tasks with units/hours.

**Data model.**

```prisma
model Resource {
  id           String       @id @default(cuid())
  teamId       String
  type         ResourceType // PERSON | EQUIPMENT
  userId       String?      // optional link to User
  email        String?
  maxUnits     Decimal      @default(1)
  costRateMinor Int?
  calendarId   String?
  deletedAt    DateTime?
}
model Skill { id String @id @default(cuid()); teamId String; name String }
model ResourceSkill { resourceId String; skillId String; level Int @default(1)
  @@id([resourceId, skillId]) }
model ResourceAssignment { taskId String; resourceId String; units Decimal @default(1);
  plannedHours Decimal?; actualHours Decimal? @@unique([taskId, resourceId]) }
```

**Endpoints.** `GET/POST/PUT/DELETE /api/v1/teams/:teamId/resources`, `/skills`,
`/tasks/:taskId/resource-assignments`. `setResourceSkills` uses replace-set semantics.
**RBAC:** `resource.manage`. **Audit:** resource/skill/assignment CRUD. **i18n:** `resources.*`.

---

## G6 — Timesheets & rate cards

**Goal.** Log time against projects/tasks, approve via period workflow, snapshot cost rates.

**Data model.**

```prisma
model RateCard { id String @id @default(cuid()); scope RateCardScope // USER | ROLE
  userId String?; role Role?; costRateMinor Int; billRateMinor Int?; currency String;
  effectiveFrom DateTime; effectiveTo DateTime? }
model TimesheetPeriod { id String @id @default(cuid()); teamId String; ownerId String;
  periodStart DateTime; periodEnd DateTime;
  status TimesheetStatus // OPEN | SUBMITTED | APPROVED | REJECTED | REOPENED }
model TimeEntry { id String @id @default(cuid()); periodId String?; projectId String; taskId String?;
  userId String; minutes Int; billable Boolean @default(true);
  costRateMinorSnapshot Int; currencySnapshot String }
```

**Logic.** Snapshot the cost rate at log time so historical actuals never drift. Period status is
the approval machine. Approving a timesheet posts labour into the cost ledger (see G7) in one
transaction; reopening posts reversals.

**Endpoints.** `GET/POST /api/v1/teams/:teamId/timesheets/periods`, `POST …/entries`,
`POST …/periods/:id/submit|approve|reject|reopen`. **RBAC:** logging own time needs no perm;
`timesheet.approve`, `timesheet.manage_rates`. **Audit:** period state changes, entries.
**i18n:** `timesheets.*`.

---

## G7 — Cost control ledger

**Goal.** Proper project cost management: CBS tree, budget lines, commitments, expenses, and an
append-only actual-cost ledger with FX. Builds on G5/G6. Money as integer `amountMinor: bigint` + ISO currency.

**Data model.**

```prisma
model CostAccount { id String @id @default(cuid()); projectId String; code String;
  name String; parentId String?; path String /* materialized */ }
model BudgetLine { id String @id @default(cuid()); projectId String; costAccountId String?;
  plannedValueMinor Int; source BudgetLineSource // MIGRATED | MANUAL }
model Commitment { id String @id @default(cuid()); projectId String; amountMinor Int; currency String;
  source String }
model Expense { id String @id @default(cuid()); projectId String; amountMinor Int; currency String;
  status ExpenseStatus // DRAFT | APPROVED; approvedAt DateTime? }
model ActualCostEntry { id String @id @default(cuid()); projectId String; source ActualCostSource
  // TIMESHEET | EXPENSE | INVOICE | MANUAL
  baseAmountMinor BigInt; currency String; fxRateId String?; createdAt DateTime @default(now()) }
model FxRate { id String @id @default(cuid()); fromCurrency String; toCurrency String;
  rate Decimal; asOf DateTime }
```

**Logic.** Approving an `Expense` posts an `ActualCostEntry`. Corrections post a **reversing row**,
never edit. `POST /api/v1/projects/:id/cost/summary` = authoritative view
(planned/committed/actual/remaining per currency + reporting-currency base). Rollups never sum
across currencies.

**Endpoints.** `GET/POST …/cost/accounts`, `/budget-lines`, `/commitments`, `/expenses`,
`POST …/expenses/:id/approve`, `GET …/cost/summary`. Gated `requireModule('cost_control')` /
`cost.manage`. **Audit:** all cost mutations. **i18n:** `cost.*`.

---

## G8 — Risk register

**Goal.** Per-project risk log with probability × impact scoring and response plans.

**Data model.** `RiskRecord { id, projectId, teamId, title, description?, probability Int /*1-5*/,
impact Int /*1-5*/, score Int /*=prob×impact, auto*/, response RiskResponse /*MITIGATE|ACCEPT|TRANSFER|AVOID*/,
mitigationPlan?, ownerId, status, closedAt? }`. Sequential `RISK-NNN` reference.

**Endpoints.** `GET/POST/PUT/DELETE /api/v1/projects/:id/risks`. **RBAC:** `risk.manage`.
**Audit:** risk create/update/close. **i18n:** `risk.*`.

---

## G9 — Change requests

**Goal.** Formal CR lifecycle that snapshots a baseline on apply. Builds on G4.

**Data model.** `ChangeRequest { id, projectId, teamId, title, description?,
status ChangeRequestStatus // DRAFT | SUBMITTED | APPROVED | APPLIED
scheduleDeltaDays Int?, costImpactMinor Int?, costCurrency String?,
submittedById, submittedAt, decidedById, decidedAt, baselineId? }`. Sequential `CR-NNN`.

**Logic.** `apply()` transaction snapshots a `CHANGE_REQUEST` baseline (flips prior to `isCurrent=false`)
and optionally posts an `ActualCostEntry`. **Endpoints:** `POST …/change-requests`,
`POST …/:id/submit|approve|reject|apply`. **RBAC:** `change.manage`, `change.approve`.
**Audit:** CR state changes. **i18n:** `changeRequest.*`.

---

## G10 — Procurement

**Goal.** Vendors, contracts, and purchase orders that auto-create cost commitments. Builds on G7.

**Data model.**

```prisma
model Vendor { id String @id @default(cuid()); teamId String; name String; contactEmail String?;
  deletedAt DateTime? }
model Contract { id String @id @default(cuid()); teamId String; vendorId String;
  title String; status ContractStatus // DRAFT | ACTIVE | CLOSED; valueMinor Int?; currency String? }
model PurchaseOrder { id String @id @default(cuid()); teamId String; projectId String; contractId String?;
  number String; status PoStatus // DRAFT | ISSUED | RECEIVED | CANCELLED; amountMinor Int; currency String }
```

**Logic.** On `PO → ISSUED`, auto-create a `Commitment` via `ensureDefaultCostAccount()`. Sequential `CON-NNN`/`PO-NNN`.
**Endpoints.** `GET/POST/PUT/DELETE /api/v1/teams/:teamId/vendors`, `/contracts`,
`/projects/:id/purchase-orders`, `POST …/purchase-orders/:id/issue`. **RBAC:** `procurement.manage`.
**Audit:** vendor/contract/PO mutations. **i18n:** `procurement.*`.

---

## G11 — Quality / NCR

**Goal.** Non-Conformance Reports linked to optional corrective tasks.

**Data model.** `QualityNcr { id, projectId, teamId, title, description?, severity NcrSeverity
// MINOR | MAJOR | CRITICAL, disposition NcrDisposition // OPEN | IN_REVIEW | CLOSED,
correctiveTaskId?, raisedById, closedAt? }`. Sequential `NCR-NNN`.

**Endpoints.** `GET/POST/PUT/DELETE /api/v1/projects/:id/ncrs`. **RBAC:** `quality.manage`.
**Audit:** NCR create/update/close. **i18n:** `quality.*`, `ncr.*`.

---

## G12 — Records framework

**Goal.** Generic, configurable record types (issue / RFI / document / stakeholder / MoM) per project.

**Data model.**

```prisma
model PmisRecordType { id String @id @default(cuid()); teamId String? // NULL = global built-in
  key String; name String; kind RecordKind // BUILTIN | CUSTOM
  statusSet Json; transitions Json; position Int }
model PmisRecord { id String @id @default(cuid()); projectId String; recordTypeId String;
  reference String // `${key}-NNN`; status String; fieldValues Json; assigneeId?; closedAt? }
model PmisRecordComment { id String @id @default(cuid()); recordId String; authorId?; body String }
```

**Logic.** `listRecordTypes` returns `OR: [{teamId: null}, {teamId}]` so built-ins always appear.
`reference` = sequential count within project. **Endpoints:** `GET/POST /api/v1/teams/:teamId/record-types`,
`GET/POST/PUT/DELETE /api/v1/projects/:id/records`. **RBAC:** `record.manage`. **Audit:**
record type + record mutations. **i18n:** `records.*`, `recordTypes.*`.

---

## G13 — Portfolio / Program / Org units

**Goal.** Hierarchical org structure (HOLDING/COMPANY/PORTFOLIO/PROGRAM) with subtree rollups.
Builds on R0 plumbing (G14). uTask already has Departments/Units; this adds the PMIS reporting tree.

**Data model.** `OrgUnit { id, parentId?, type OrgUnitType // HOLDING | COMPANY | PORTFOLIO | PROGRAM,
name, code?, path String /* materialized, startsWith prefix */, managerId?, currency? }`.
Optional `TeamOrgUnit { teamId, orgUnitId }`. `Project.orgUnitId` FK (column may already exist as `unitId`).

**Logic.** Strict type hierarchy (HOLDING root only; COMPANY under HOLDING/COMPANY; PORTFOLIO under
HOLDING/COMPANY/PORTFOLIO; PROGRAM under PORTFOLIO/PROGRAM). Move reparents node + rewrites descendant
`path` in one transaction. `Team` remains the sole RBAC boundary — no per-subtree visibility filtering.
Reports reuse team-report math grouped by subtree.

**Endpoints.** Global `GET/POST/PUT/DELETE /api/v1/org-units`, `PUT /api/v1/org-units/:id/attach-project`.
**RBAC:** `portfolio.*` perms. **Audit:** org-unit + attachment mutations. **i18n:** `portfolio.*`, `orgUnit.*`.

---

## G14 — Project profiles + module registry

**Goal.** Enable/disable feature modules per project/team with a dependency DAG. R0 plumbing first.

**Data model.**

```prisma
model ProjectProfile { id String @id @default(cuid()); key String; name String;
  kind ProfileKind // BUILTIN | CUSTOM; ownerScope OwnerScope // SYSTEM | TEAM
  teamId String?; version Int; status ProfileStatus // DRAFT | PUBLISHED | DEPRECATED
  basedOnProfileId? }
model ProfileModuleSetting { id String @id @default(cuid()); profileId String; moduleKey String;
  enabled Boolean; requiredFields Json; defaults Json; config Json }
```

**Logic.** `lib/moduleRegistry.ts`: authoritative 15-module key list + dependency DAG
(e.g., `evm`→`baselines`+`cost_control`) + `expandWithDependencies` closure. Snapshot-at-create:
project pins `profileId`+`profileVersion` at creation (resolved `group default ▸ team default ▸ system NEUTRAL`)
so re-publishing never mutates live projects; `effective-config` layers `profileOverrides` then closes over
the DAG. Published profiles immutable (edit = clone to new DRAFT, `version+1`). `requireModule(key)` preHandler
403s `module_disabled` when off (additive to RBAC; neutral core never gated). Seed SYSTEM built-ins
NEUTRAL/IT/EPC/OPERATIONS.

**Endpoints.** `GET/POST/PUT/DELETE /api/v1/teams/:teamId/profiles`, `GET/POST /api/v1/profiles/:id/publish`,
`PUT /api/v1/teams/:teamId/default-profile`. **RBAC:** `pmo.*` perms. **Audit:** profile publish/assign.
**i18n:** `profiles.*`, `modules.*`.

---

## G15 — Cross-cutting collaboration & UX features

### G15a — Full RACI
`TaskRaci { taskId, userId, role RaciRole // CONSULTED | INFORMED }` `@@unique([taskId, userId, role])`,
replace-set semantics. Responsible = `Task.responsibleId`, Accountable = `Project.accountableId` (already scalar).
READ on project, WRITE on task. Audit RACI replace. i18n `raci.*`.

### G15b — Task approval gate
`TaskStatus.PENDING_APPROVAL` + `Task.requiresApproval Boolean`, `Task.approverId`. A DONE transition on a
require-approval task reroutes to `PENDING_APPROVAL` unless the actor is a finalizer (designated approver,
project MANAGER, global ADMIN, or full-edit delegate). `POST …/tasks/:id/approve|reject` (reject requires reason).
Audit approval/reject. i18n `approval.*`.

### G15c — Project health / RAG
`RagStatus` enum + `Project.ragStatus` (default GREEN), `ragReason`, `healthUpdatedAt`. `PUT …/projects/:id/health`
gated project WRITE. Included on every project response. Audit health change. i18n `rag.*`.

### G15d — Automation rules
`AutomationRule` + `AutomationCondition` + `AutomationAction` + `AutomationRun` (team-scoped). Engine runs
after-commit beside webhooks; loop guard = shared `(ruleId, taskId)` fired-set + max depth 5; actions call real
services (tasks, labels, custom fields, comments). Perm `automation.manage`. Audit rule CRUD + runs. i18n `automations.*`.

### G15e — Public intake forms
`Form { teamId, title, fields Json, mode INTAKE | PUBLIC, token?, honeypot Boolean }`. `POST …/teams/:teamId/forms`;
public submit `GET /public/forms/:token` (labels/types only) → `POST` creates tasks via existing task service +
custom-field validators. PUBLIC opt-in: opaque token, IP rate-limit + honeypot, no team/member leak, assignee/PERSON
fields rejected, system user as creator. Perm `form.manage`. Audit form CRUD + submissions. i18n `forms.*`.

### G15f — Standalone personal tasks
`StandaloneTask { ownerId, title, description?, status StandaloneTaskStatus // TODO | IN_PROGRESS | DONE,
priority?, dueDate?, completedAt?, sortOrder Int, lastDueNotifiedAt?, promotedTaskId?, deletedAt? }` — outside any
team. Me-scoped routes `/api/v1/me/standalone-tasks` (`tasks:read`/`tasks:write`). D5: additive branch in due-date
scheduler emits `STANDALONE_TASK_DUE` (make `Notification.teamId` nullable). D8: one-way `POST …/:id/promote {projectId}`
reuses task service, soft-deletes standalone row, records `promotedTaskId` as plain string (no relation). Audit
promote. i18n `standaloneTasks.*`.

### G15g — Holidays + working-day calendar
`Holiday { date DateTime /*UTC midnight*/, name, recurring Boolean, source }`. `isOffDay()` = weekend OR holiday.
Instance settings `calendar.weekend`, `scheduling.rollOffdayDueDates`, `scheduling.workingDaysOnly`. Working-day
scheduling rolls due dates on create/update/spawn only. Iranian holiday import: vendored JSON, admin-only
`GET/POST /api/v1/holidays/import/*`, idempotent upsert (`source: IMPORT`). `Notification.teamId` nullable already
needed by G15f. Audit holiday CRUD/import. i18n `holidays.*`, `calendar.*`.

---

## G16 — Cross-cutting platform / ops features

### G16a — Multiple themes
`ThemePreference` enum `LIGHT | DARK | SYSTEM | MIDNIGHT | SOLARIZED | HIGH_CONTRAST | NORD`. Stored preference may be
`SYSTEM`; resolved palette always concrete. `SYSTEM` → `matchMedia('(prefers-color-scheme: dark)')` + live listener.
`<html>` carries one `theme-*` class; dark-family also get legacy `dark`. Semantic tokens in `tokens.css`
(`--color-bg`, `--color-text`, …); Tailwind references `var(--color-*)`. Pre-paint bootstrap in layout sets the class
before React mounts. i18n `theme.*`.

### G16b — PWA / installable

> **Status: ✅ SHIPPED (post-GA).** Commit `124b823`. Implementation differs from the original
> Workbox sketch below (Next.js App Router → Serwist instead of `vite-plugin-pwa`).

**Actual implementation (as shipped):**
- **Service worker:** [`Serwist`](https://serwist.pages.dev/) (`@serwist/next` v9) wrapping the Next.js build via `next.config.mjs` (`withSerwist({ swSrc: "src/app/sw.ts", swDest: "public/sw.js" })`).
- **Strategy:** `NetworkFirst` navigations (5s timeout → offline fallback), `NetworkOnly` for `/api/*` (no offline
  data sync — per the original "No offline data sync" constraint), `StaleWhileRevalidate` for static assets.
- **Manifest:** standalone display, `theme_color`, maskable icons (192/512) + apple-touch icon; `public/manifest.webmanifest`.
- **Offline page:** `public/offline.html` precached and served as the navigation fallback.
- **Icons:** generated from `public/icon.svg` by `scripts/gen-pwa-icons.ts` (`@resvg/resvg-js`); re-run via `pnpm pwa:gen-icons`.
- **Registration:** `src/components/pwa/register.tsx` registers the SW **in production only** (`NODE_ENV === "production"`);
  dev server never registers it. `scripts/pwa-check.ts` (`pnpm pwa:check`) validates manifest + icons + offline page in CI.
- **Middleware:** `src/middleware.ts` matcher excludes PWA static assets (`manifest.webmanifest`, `sw.js`, `offline.html`,
  icons) from the locale/auth gate so they are served publicly without a redirect.
- **Install:** requires HTTPS (localhost OK for dev testing).
- **i18n:** `pwa.*` keys reserved (currently the manifest is locale-neutral; translations can be added later).

**Original sketch (for reference):** `vite-plugin-pwa` (Workbox), `registerType: 'autoUpdate'`, `StaleWhileRevalidate`
scripts/styles, `CacheFirst` fonts/images, `navigateFallback → index.html`; `/api/*` always `NetworkOnly`.

### G16c — 2FA (TOTP)
Per-user TOTP enrollment + recovery codes; login second step when enabled. Bind secret encrypted. i18n `twoFactor.*`.
(Note: uTask currently has local + LDAP/AD + SAML; 2FA is an additional factor on local accounts.)

### G16d — SCIM provisioning
SCIM 2.0 `/api/scim/v2/Users|Groups` endpoints for JIT user/group sync from IdPs (complement to existing LDAP/AD JIT).
Group → role mappings. i18n `scim.*`.

### G16e — Password policy + lockout + security audit
`InstanceSetting.security.passwordPolicy` (min length, classes, expiry, history) enforced by a single
`PasswordPolicyService` used by change/reset/admin. Lockout after N failures; `SecurityAuditEvent` rows (login
failures, lockouts, privilege changes) for forensic signal, enumeration-safe. i18n `security.*`, `passwordPolicy.*`.

### G16f — In-app backup scheduler + offsite (Kopia)
`backupScheduler` → `backupsService` runs `pg_dump --format=custom` into a volume on a schedule (retention via
InstanceSetting). Offsite shipping via rclone/rsync or **Kopia** (encrypted, deduplicating, versioned) to a remote.
Admin UI at `/settings/backups` (start now, download, restore, configure schedule/retention/offsite). i18n `backups.*`.

### G16g — Self-updater sidecar
Privileged updater service polls GitHub for newer tag (opt-in `UPDATE_CHECK_ENABLED`); admin "Run upgrade now"
button triggers sidecar. Admin-only, no-op when disabled. i18n `updater.*`.

### G16h — Per-user datetime prefs
`User.timeZone` (nullable IANA), `User.timeFormat` (H12/H24), `User.dualCalendar` (Jalali+Gregorian). Display-only;
instants stay UTC. `lib/date/` splits `formatDate` (calendar, zone-neutral) vs `formatDateTime` (user zone + 12/24h).
Invalid IANA → 400. i18n `datetime.*`. (uTask already has Jalali; this adds per-user TZ/format + dual display.)

---

## Mapping back to uTask's current SPEC/Backlog

Items below were already in `TASKS.md` § Backlog / `SPEC.md` §18 and are **covered or expanded** here:

| Existing backlog item | Maps to |
|-----------------------|---------|
| Time tracking / Gantt | G1, G2, G3, G6 |
| Approval workflows | G15b |
| SLA / due-date escalation | extends G15g (off-day rolling) |
| Custom field types (future) | retained; G12 records add Json fieldValues |
| SSO for additional IdPs (OIDC, WS-Fed) | G16d (SCIM) complements SAML/LDAP |
| OAuth2 for public API | separate (unchanged) |
| Multi-tenant SaaS | separate (unchanged) |

## Open questions to resolve before building any wave

1. **Adopt the full PMIS model or a subset?** uTask is positioned as enterprise *task* management; the
   G1–G16 set is a full EPM/PMIS. Recommend phasing: start with G1–G4 (planning) + G15 (RACI/approval/RAG/forms)
   as the highest-value, then resource/cost (G5–G7) only if customers need EVM.
2. **Money representation:** adopt integer `amountMinor: bigint` (G7) vs uTask's existing `Decimal` budgets.
   Decision needed before G7 to avoid dual representations.
3. **`Project.orgUnitId`** already may exist as `unitId` (Departments/Units). Confirm G13 reuses it or adds a separate PMIS tree.
4. **Module registry (G14)** is large; do we need it before individual modules, or ship modules on by default and add G14 later?
5. **Standalone tasks (G15f)** require `Notification.teamId` nullable — coordinate with Phase 5 notification work.
