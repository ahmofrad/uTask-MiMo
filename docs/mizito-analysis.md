# Mizito Competitive Analysis & uTask Gap Register

> **Purpose.** A single source of truth capturing the full feature/GUI inventory of
> **Mizito** (`https://www.mizito.ir`, `https://help.mizito.ir`, `https://mizito.ir/features`)
> and a detailed gap analysis against **uTask**. Intended to be polished and implemented
> later — nothing here is committed to the V1 contract.
>
> **Companion docs.** [`TASKS.md`](../TASKS.md), [`SPEC.md`](../SPEC.md),
> [`docs/roadmap-pmis.md`](./roadmap-pmis.md) (the internal PMIS/EPM gap register, G1–G16).
> This document is the *external competitive* counterpart: it records what a shipping
> Iranian PMIS competitor already offers that uTask does not.
>
> **Status.** Draft for later polishing. Design sketches follow uTask conventions
> (additive migrations, soft-delete via `deletedAt`, `WHERE deletedAt IS NULL`, cursor
> pagination, audit on every mutation, Zod validation, RBAC via `lib/rbac/can`, i18n via
> `useTranslations`, dates via `lib/date/`, design tokens only, logical CSS).

---

## 1. Method, sources, confidence

- **Sources (all fetched 2026-07-11, reachable):**
  - Landing page `https://www.mizito.ir` (hero, module tiles, team verticals, customer logos).
  - Features page `https://mizito.ir/features` (per-module deep dive with screenshots).
  - Help center `https://help.mizito.ir` (category tree + key articles: Gantt, task weight, correspondence, CRM, chat, notes, monitoring).
- **Confidence legend:**
  - **High** — stated explicitly on the marketing/help pages (module existence, named sub-features).
  - **Medium** — inferred from screenshots / help wording (exact GUI behavior, edge cases).
  - **Low** — guessed from comparable products; flagged as such.
- **Verification of uTask side** done by reading the repo (`prisma/schema.prisma`,
  `src/components/task/gantt-chart.tsx`, `src/components/task/calendar-view.tsx`, route tree,
  `TASKS.md`). Items marked `has` / `partial` / `planned` / `lacks` reflect actual code state.

---

## 2. Mizito feature inventory (verified)

Mizito positions itself as an **"all-in-one workspace / میزکار"** replacing Telegram,
WhatsApp, Trello, Monday, MS Project, HubSpot/Zoho/Salesforce, and Google Keep/OneNote.
It claims 442,600+ organizations and offers **native Android (Google Play + direct APK) and
iOS web apps**, plus **on-prem install on the customer's own servers**.

### 2.1 Modules (top-level)
| Module (FA) | Module (EN) | High-confidence sub-features |
|---|---|---|
| گفتگو / شبکه اجتماعی اختصاصی | Chat / private social network | Private + group chat, **channels**, file sharing, **voice messages**, **emoji**, **in-app video meetings**, **polls**, @mentions, **AI smart assistant** |
| وظایف | Tasks | Assignee(s) + **approver (تاییدکننده)**, tags, reports-with-mention, attachments, **priority/weight**, **recurring tasks**, emoji |
| پروژه‌ها | Projects | Unlimited projects + grouping, Gantt, Scrum/Kanban board, **calendar** view, list view |
| نامه‌ها | Correspondence / official letters | Send/receive, **paraf** (annotate/approve), **refer/forward**, **letter numbers (دبیرخانه/indicator)**, **create task + tag from a letter** |
| پرونده مشتریان | CRM / customer files | Per-customer file: contacts, **financial documents**, **meeting minutes**, **sales opportunities/leads**, tags + rich filters; CRM monitoring |
| مانیتورینگ | Team/pm monitoring | Graphical dashboards for projects / members / tasks / CRM files / **meeting minutes** |
| یادداشت‌ها | Personal notes | Personal notes + checklists, images, color, tags (Keep/OneNote replacement) |
| صورتجلسه | Meeting minutes | Digital minutes, **invite external people**, record decisions, **attendee signatures** |
| تقویم | Calendar | Month view, drag-and-drop reschedule between days |
| گانت چارت | Gantt | Phases (فاز), tasks, dependencies (arrows), today line, **overdue/delay → red**, **invalid overlapping dependency → red**, progress %, per-day columns, module toggle (advanced) |

### 2.2 Gantt specifics (from help article, Medium confidence on visuals)
- **Title** = project title (edit project to rename).
- **List** = phases + tasks in order.
- **Phase (فاز)** = project subdivision; tasks may belong to a phase or stand alone.
- **Dependency** = FS-style edge drawn as an arrow; one task may depend on / be depended on by several.
- **Time range** auto-spans first task start → last task due.
- **Today marker** = vertical line.
- **Delayed task** = timeline past today → drawn **red**.
- **Done task** = greyed.
- **Progress %** = thin bar under the task bar.
- **Correct dependency** = no date overlap; **incorrect (red)** = overlapping dates.
- **Module gating** = Gantt is an "advanced version" feature toggled per project; only the project manager sees it.

### 2.3 Task weight / KPI (from help article)
- Each task carries an abstract **weight/چگالی** number (organization-defined unit: minutes/hours/days or arbitrary).
- Enabled per project in advanced settings.
- **KPI report:** sum of weights completed by a person over a date range → printable table
  ("کارتابل وظایف / انجام شده روزانه"). This is a per-person throughput/output metric.

### 2.4 Correspondence specifics (from /features)
- Send official in-org letters/requests to people in other departments.
- Receive + see new letters.
- **Paraf** (approve/reply on a letter).
- **Create task + tag** from a letter.
- **Register letter numbers** (incoming/outgoing, secretariat/indicator) for ordering.
- **Refer/forward** a received letter to others for review/opinion.

### 2.5 Chat specifics (from /features)
- Private + group chat, channels.
- File/docs/image sharing in chat.
- **Voice messages** (record + send).
- **@mention** to flag people.
- **In-app video meetings** (no 3rd-party install).
- **Polls** for quick decisions.
- **AI smart assistant (دستیار هوشمند میزیتو)** reachable in chat.

### 2.6 CRM specifics (from /features + monitoring)
- Customer file: contacts, financial documents, meeting minutes, sales opportunities/leads.
- Tagging + diverse filter search.
- Separate **CRM monitoring** dashboard (interaction status, customer info).

### 2.7 Monitoring (from /features)
Five graphical dashboards: **projects**, **members**, **tasks**, **CRM files**, **meeting minutes**.
Member monitoring = per-member performance/activity across projects & tasks.

### 2.8 Meeting minutes (from /features "امکانات بیشتر")
- Digital minutes, invite people **outside the organization**, record **decisions (مصوبات)**,
  **attendee signatures**.

### 2.9 Other confirmed
- **Recurring tasks** (daily/weekly repeats).
- **Task approver** (separate person approves completion).
- **Guest users (کاربر مهمان)** — invite external guests (HR vertical).
- **Emoji** in chat + task reports.
- **On-prem dedicated-server install** (explicitly offered).
- **Native mobile apps** (Android Play + APK, iOS web app) — uTask ships PWA only (G16b).

---

## 3. uTask current-state snapshot (baseline)

**Present (verified in code):**
- Projects (CRUD, visibility, archive), project members + roles, owner inline-edit (recent).
- Tasks: CRUD, `priority` (TaskPriority), `status`, `startDate`, `dueDate`, `estimatedHours`,
  `progress`, assignee, tags, attachments, comments (threaded, @mention, markdown).
- **WBS** (n-level `parentId`, outline `wbsCode`, summary rollups) — G2.
- **Dependencies** (FS/SS/FF/RELATES_TO, enforcement, unblock notifications) — G1.
- **Gantt** (`gantt-chart.tsx`): today line, dependency arrows, progress fill, status colors,
  critical-path ring, milestones, drag-to-move, clickable titles, Jalali months — G3.
- **Calendar view** component (`calendar-view.tsx`) used on dashboard + project page:
  **read-only month grid** of tasks by `dueDate` (Jalali + Gregorian). **No drag-reschedule, no `/calendar` route.**
- Kanban board, list views, custom fields (typed/filterable), watchers, notifications.
- RBAC matrix + `isProjectOwner` helper, audit log, admin insights, reports (my/project/org).
- LDAP + SAML SSO, public REST API + scoped tokens + OpenAPI/Swagger, signed webhooks (retry/dead-letter).
- Search, PWA (G16b), i18n (fa-IR/en-US), RTL, theming.

**Absent (relevant to this analysis):** chat, correspondence, CRM, notes, meeting minutes,
recurring tasks, task approver, weight-KPI report, native apps, AI assistant, video/polls/voice in chat.

---

## 4. Gap register (M1–M18)

Legend for `uTask`: `has` · `partial` · `planned` (in TASKS/roadmap) · `lacks`.
`Class`: **PMIS-fit** (buildable within uTask charter, additive) · **Separate product**
(large, distinct domain) · **Platform**.

| # | Mizito capability | uTask | Class | Conf. |
|---|---|---|---|---|
| M1 | Team chat / social (private, group, channel, files, voice, video, polls, emoji, AI) | lacks | Separate product | High |
| M2 | Official correspondence / letters (paraf, refer, letter numbers, task-from-letter) | lacks | Separate product | High |
| M3 | CRM / customer files (contacts, financials, leads, minutes) | lacks | Separate product | High |
| M4 | Meeting minutes (external invite, decisions, signatures) | lacks (G12 records planned) | PMIS-fit | High |
| M5 | Personal notes + checklists (images, color, tags) | lacks | PMIS-fit | High |
| M6 | Team monitoring dashboards (members/CRM/minutes) | partial (admin insights/reports) | PMIS-fit | High |
| M7 | Recurring tasks | partial (spawn-on-completion; no UI/cron) | PMIS-fit | High |
| M8 | Task approver (approval gate on completion) | planned (G15) | PMIS-fit | High |
| M9 | Task weight + per-person KPI output report | lacks (has priority/estHours/progress) | PMIS-fit | High |
| M10 | Calendar drag-and-drop reschedule + `/calendar` route | has | PMIS-fit | High |
| M11 | Gantt delay-red + dependency-validity-red coloring | has | PMIS-fit | High |
| M12 | Native mobile apps (Android/iOS) | partial (PWA G16b) | Platform | High |
| M13 | AI smart assistant | lacks (AI in backlog) | Separate product | High |
| M14 | In-app video meetings | lacks | Separate product | High |
| M15 | Polls / voice messages / emoji in chat | lacks | Separate product | High |
| M16 | Guest / external users | partial (Guest role seeded, no guest flow) | PMIS-fit | High |
| M17 | Unified workspace shell (module tiles) | partial (project-centric nav) | PMIS-fit | High |
| M18 | On-prem dedicated-server install | has (uTask is on-prem by design) | — | High |

### M1 — Team chat / private social network  `Separate product`
- **Mizito:** private + group chat, channels, file sharing, voice messages, emoji, in-app
  video meetings, polls, @mentions, AI assistant. Pitched as Telegram/WhatsApp replacement.
- **uTask:** lacks any messaging. `src/lib/realtime` scaffolding exists but the Socket.IO
  server (TASKS Phase 6) is not built.
- **Design sketch (future):** `Conversation` (dm | group | channel), `Message`
  (body, attachments, voiceUrl, pollId, mentions), `Reaction`, `Call` (for video, needs
  WebRTC/SFU). Channels: `user:<id>`, `project:<id>`, `conversation:<id>`. Heavily depends
  on Phase 6 realtime + storage + notifications. **Out of PMIS charter** — treat as a
  distinct product workstream.

### M2 — Official correspondence / letters  `Separate product`
- **Mizito:** send/receive official letters, **paraf** (approve/annotate), **refer/forward**,
  **letter numbers** (in/out, secretariat/indicator), **create task + tag from a letter**.
- **uTask:** lacks. This is an "automation/office" domain (دبیرخانه) common in Iranian orgs.
- **Design sketch (future):** `Letter` (direction in/out, number, subject, body, status),
  `LetterParaf`, `LetterForward`, `LetterTaskLink`. RBAC: secretary/admin vs member.
  Audit every mutation. Deep integration: "create task from letter" reuses task creation.
  **Large, domain-specific** — separate workstream.

### M3 — CRM / customer files  `Separate product`
- **Mizito:** customer file (contacts, financial documents, meeting minutes, sales
  opportunities/leads), tagging + filters, CRM monitoring.
- **uTask:** lacks any customer entity.
- **Design sketch (future):** `Customer`, `Contact`, `Lead`/`Opportunity` (stage, amount),
  `CustomerDocument` (financial), relation to `Task` + `MeetingMinutes` (M4). CRM monitoring
  reuses reporting infra. **Large** — separate workstream, but data models can be additive.

### M4 — Meeting minutes  `PMIS-fit`  (planned as G12 records framework)
- **Mizito:** digital minutes, invite external people, record decisions, attendee signatures.
- **uTask:** lacks; `G12` (records framework: issue/RFI/document/stakeholder/MoM) is planned.
- **Design sketch:** model `MeetingMinutes` { id, projectId, title, heldAt, location?,
  externalAttendees Json[], decisions String[], attendees Signatures[] {userId|name, signedAt} }.
  Soft-delete, audit, RBAC = project VIEW. i18n `meetingMinutes.*`. Could land under G12.

### M5 — Personal notes + checklists  `PMIS-fit`
- **Mizito:** personal notes with checklists, images, color, tags.
- **uTask:** lacks (only task comments).
- **Design sketch:** `Note` { id, ownerId, title, body(markdown), color?, pinned?,
  deletedAt } + `NoteTag` + `NoteChecklistItem` { id, noteId, text, done }. Personal scope
  (owner-only). Endpoints `GET/POST /api/v1/notes`, `/api/v1/notes/:id`. RBAC: self only.
  Audit optional (personal). i18n `notes.*`.

### M6 — Team monitoring dashboards  `PMIS-fit`
- **Mizito:** graphical dashboards for projects / members / tasks / CRM / minutes.
- **uTask:** has `admin/insights`, `reports/org`, `reports/project/[id]`, `reports/my-dashboard`.
  **No dedicated per-member activity monitoring UI.**
- **Gap:** add a **member monitoring** view (per-member task throughput, on-time %, workload)
  reusing existing report primitives. Likely an extension of `reports/org`. Low new-model cost.

### M7 — Recurring tasks  `PMIS-fit`
- **Mizito:** daily/weekly repeating tasks.
- **uTask:** lacks. `Task` has no recurrence fields.
- **Design sketch:** add to `Task`: `recurrence RecurrenceRule?` (RRULE-ish or simple
  {freq: DAILY|WEEKLY|MONTHLY, interval, byDay[], anchor: startDate|dueDate, count?, endDate?}),
  `recurrenceParentId?`. On completion/advance, a scheduler (BullMQ cron) spawns the next
  occurrence. Endpoints: recurrence lives in task PATCH/POST. RBAC = task WRITE. Audit on
  spawn. i18n `task.recurrence.*`. Dependency: scheduler worker (BullMQ exists).

### M8 — Task approver (approval gate)  `PMIS-fit`  (planned G15)
- **Mizito:** a separate person (تاییدکننده) must approve task completion.
- **uTask:** planned under G15 (task approval gate); not built. `Task` has `assigneeId` only.
- **Design sketch:** add `approverId?` to `Task`; status machine gains an `IN_REVIEW`/
  `PENDING_APPROVAL` state between `IN_PROGRESS` and `DONE`. Completing requires approver
  action; approver gets a notification. RBAC: approver (project role or named user) can
  approve. Audit on approval. i18n `task.approval.*`.

### M9 — Task weight + per-person KPI output  `PMIS-fit`
- **Mizito:** abstract `weight/چگالی` per task; per-project enable; report = sum of weights
  completed by a person over a date range, printable table.
- **uTask:** has `priority`, `estimatedHours`, `progress` — but **no weight** and **no
  per-person weight-output report**.
- **Design sketch:** add `weight Int?` (or Decimal) to `Task`; project setting
  `tasks.weightEnabled`. New report `GET /api/v1/reports/member-output?from&to&userId?`
  aggregating `SUM(weight)` of `DONE` tasks in range, grouped by assignee, with CSV/print
  output. Reuses reporting infra. RBAC: project VIEW / org admin for cross-member. i18n
  `reports.memberOutput.*`, `task.weight`.

### M10 — Calendar drag-and-drop + `/calendar` route  `PMIS-fit`
- **Mizito:** month calendar with drag-and-drop reschedule between days.
- **uTask:** `calendar-view.tsx` exists (read-only month grid on dashboard + project page);
  **no drag**, **no standalone `/calendar` route**.
- **Design sketch:** (a) promote calendar to its own route `/[locale]/(app)/calendar`
  (global, across projects) and `/projects/[id]/calendar`; (b) add pointer-drag on a day cell
  → `PATCH /api/v1/tasks/:id` updating `dueDate` (and `startDate`) with optimistic UI;
  (c) reuse the existing Gantt drag handler pattern. RBAC = task WRITE. Audit on move.

### M11 — Gantt delay-red + dependency-validity-red  `PMIS-fit`
- **Mizito:** overdue tasks → red bar; overlapping/invalid dependency → red arrow + warning.
- **uTask:** `gantt-chart.tsx` has today line + arrows + status colors + critical ring, but
  **no delay coloring** and **no invalid-dependency flagging**.
- **Design sketch (no schema change):**
  - Delay: if `status != done && dueDate < today` → render bar with `bg-danger` (or a danger
    ring) + `title` "delayed N days". Add `t("task.ganttDelayed")`.
  - Invalid dependency: for each `link`, if `source.dueDate > target.startDate` (FS overlap)
    → stroke the arrow `text-danger` and surface a small warning chip near the bar; add
    `t("task.ganttInvalidDep")`. Compute in `gantt-chart.tsx` from existing `rows`.

### M12 — Native mobile apps  `Platform`
- **Mizito:** Android (Play + APK) and iOS web app.
- **uTask:** PWA only (G16b, committed). Native apps = Capacitor/React Native (in TASKS
  carry-over backlog). Decision needed later; PWA may suffice for v1.

### M13 / M14 / M15 — AI assistant / video meetings / polls+voice+emoji  `Separate product`
- All chat-centric; depend on M1 realtime + media infra. Track as one "rich chat" workstream.
- Emoji in task reports is cheap (front-end only) and could be lifted independently.

### M16 — Guest / external users  `PMIS-fit`
- **Mizito:** invite external guests (e.g., HR vertical "امکان دعوت کاربر مهمان").
- **uTask:** `Guest` role exists in seed/roles; **no dedicated guest-invite flow or scoped
  external access**.
- **Design sketch:** invitation flow (email/link) creating a `User` with `role: GUEST` +
  a `ProjectMember`/scoped grant; limit Guest to assigned tasks/projects only via RBAC.
  Audit on invite. i18n `guest.*`.

### M17 — Unified workspace shell (module tiles)  `PMIS-fit`
- **Mizito:** home "desktop" with module tiles (chat / tasks / projects / mail / CRM / notes /
  monitoring) the user switches between.
- **uTask:** project-centric nav; dashboard is task-focused.
- **Design sketch:** a **workspace/home** landing with app tiles linking to existing sections
  (projects, my-tasks, calendar, monitoring/insights, settings) and, once built, chat/CRM/
  notes/correspondence tiles. Pure UI/nav work; no schema change. i18n `workspace.*`.

### M18 — On-prem dedicated-server install  `has`
- uTask is on-prem by design (Docker/Helm in `ops/`, `DEPLOYMENT.md`). No gap. Listed for completeness.

---

## 5. GUI / UX advantages (detailed)

1. **Calendar drag-and-drop** — Mizito lets you drag a task between days to reschedule.
   uTask calendar is read-only; Gantt has drag but calendar does not.
2. **Gantt visual signals** — overdue → red; invalid dependency → red arrow + warning.
   uTask shows status colors + critical ring but not these two signals.
3. **Gantt per-day columns + today line + phase list** — Mizito renders every day as a column
   and lists phases; uTask shows month/week ticks + WBS codes (summary tasks ≈ phases).
4. **Unified workspace shell** — module tiles home; uTask is project-centric.
5. **Task detail density** — assignee **+ approver**, tags, reports-with-mention, attachments
   inline, emoji. uTask has assignee/tags/attachments/comments but no approver/emoji.
6. **View switching** — list / Kanban / calendar / Gantt per project. uTask has list/board/Gantt
   (no calendar route). 
7. **Native mobile** — Mizito has installed apps; uTask is PWA-only.
8. **In-context official-mail + CRM + notes + chat** all one shell — strong "single pane" UX
   that uTask (PMIS-focused) intentionally does not replicate.

---

## 6. What uTask already matches or exceeds

- **Planning depth:** n-level WBS + outline codes, real **CPM critical-path engine**, typed
  **custom fields** (filterable) — Mizito's Gantt is "advanced-version" gated and less deep.
- **Governance/enterprise:** RBAC matrix + `isProjectOwner`, **audit log** on every mutation,
  **LDAP/SAML SSO**, **public REST API + scoped tokens + OpenAPI/Swagger**, **signed webhooks**
  with retry + dead-letter, admin insights. Mizito is SaaS/team-focused, not enterprise-governed.
- **i18n/RTL/theming:** full fa-IR/en-US, RTL, Jalali, tokens — comparable or stronger.
- **On-prem:** both support it; uTask is built on-prem first.

---

## 7. Recommended build sequence (PMIS-fit first)

Order by leverage and low risk; keep each additive and audited.

1. **M11 Gantt delay + dependency-validity coloring** — pure front-end, no schema. Quick win.
2. **M10 Calendar drag + `/calendar` route** — reuses Gantt drag pattern; promotes existing component.
3. **M17 Workspace shell (module tiles)** — pure nav/UI; sets up future module entries.
4. **M7 Recurring tasks** — schema + scheduler job.
5. **M8 Task approver** — schema (approverId + state) + notification; planned in G15.
6. **M9 Task weight + member-output KPI** — schema + report endpoint.
7. **M5 Personal notes** — new models, self-scoped.
8. **M4 Meeting minutes** — under G12 records framework.
9. **M6 Member monitoring** — extends reports/org.
10. **M16 Guest flow** — invitation + RBAC scoping.
11. **(Later / separate products)** M1 chat, M2 correspondence, M3 CRM, M13 AI, M14 video,
    M15 polls/voice — distinct domains; scope as independent workstreams.
12. **M12 Native apps** — decide PWA-sufficient vs Capacitor after v1.

> Each item above should, when actually built, get its own **G/M entry** with full data model,
> endpoint sketch, RBAC subject, audit targets, i18n keys, and dependencies — following the
> format in [`docs/roadmap-pmis.md`](./roadmap-pmis.md). This document is the *intake*; the
> roadmap doc is the *build spec*.

---

## 8. Open questions / things to verify before building

- **Mizito "weight" unit semantics** — confirm whether it doubles as effort estimate or is
  purely a KPI density number (Medium confidence it's KPI-only; uTask `estimatedHours` is the
  effort analog).
- **Gantt "phase" vs uTask WBS summary** — confirm 1:1 mapping is acceptable or Mizito phases
  are a separate concept.
- **Chat video/polls/voice** — confirm whether Mizito uses a 3rd-party (e.g., Jitsi) for video
  (would lower M14 cost).
- **Correspondence letter numbers** — confirm secretariat/indicator format expectations for
  Iranian orgs before modeling M2.
- **Native app priority** — confirm PWA (G16b) meets v1 mobile needs before investing in M12.

---

## 9. Sources

- `https://www.mizito.ir` — landing page (modules, team verticals, customer logos, mobile apps, on-prem).
- `https://mizito.ir/features` — per-module deep dive (chat, tasks, CRM, monitoring, correspondence, notes, meeting minutes, calendar, Gantt, recurring, weight, emoji).
- `https://help.mizito.ir` — help center category tree.
  - Gantt: `https://help.mizito.ir/article/62f4a772855112217225d5da/بخش-های-پروژه---گانت-چارت`
  - Task weight: `https://help.mizito.ir/article/5f8040b883b80e779b3a56c6/مفهوم-وزن-وظیفه`
- uTask verification: `prisma/schema.prisma`, `src/components/task/gantt-chart.tsx`,
  `src/components/task/calendar-view.tsx`, `src/app/[locale]/(app)/**/page.tsx` route tree,
  `TASKS.md`, `docs/roadmap-pmis.md`.
