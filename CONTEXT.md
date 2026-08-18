# uTask — Domain Glossary

Terms the codebase uses for its domain concepts. These names mark the good
seams — when a module is named after one of these, it owns the concept; when
you see the concept re-derived outside it, that is a leak.

## Task

- **Task** — a unit of work in a **project** (or an inbox task with no project).
  May be a **subtask** (parented), a **summary** (has children), or a **leaf**
  (no children). Deleted tasks are soft-deleted via `deletedAt`.
- **WBS** — the work-breakdown structure: a DFS pre-order tree of tasks with
  dotted **wbs codes** (1, 1.1, 1.1.1), depth, rollup progress, and summary
  flags. Owned by `lib/tasks/wbs.ts`; views derive only presentation.
- **Day marker** — the storage convention for date-only values (task start/due,
  date custom fields): starts at `00:00:00.000Z`, dues at `23:59:59.xZ`. Day
  markers are calendar days, not instants. Owned by `lib/date/day-marker.ts`.
- **Dependency** — a directed edge between tasks (FS/SS/FF/RELATES) with an
  optional lag. A **cycle** is rejected at write time; the **critical path**
  / **float** is computed by `lib/scheduling/cpm.ts` and surfaced through
  `lib/gantt/` modules.

## Gantt

- **Timeline** — the date-range geometry shared by the interactive chart and
  the SVG export: day offsets, bar widths, RTL mirroring, drag deltas. Owned
  by `lib/gantt/timeline.ts` and `lib/gantt/drag.ts`.
- **Drag state machine** — the pure reducer (create/apply/round/patch) that
  owns pointer-to-date interaction. `lib/gantt/drag.ts`; the chart component
  only binds pointer events to it.
- **Export** — splitting at the pure/impure seam: `lib/gantt/export-svg.ts`
  builds the SVG (no DOM), `lib/gantt/export-raster.ts` resolves the live
  palette and rasterizes to PNG/PDF in the browser.

## Groups & departments

- **Group** — a reusable set of users (local or LDAP-synced) that tasks and
  projects can be assigned to; membership fans out to assignments. Owned by
  `lib/groups/`.
- **Department** — an AD-derived hierarchy with managers, separate from
  groups. Owned by `lib/departments/`.
- **LDAP source** — one Active Directory connection (multiple are supported).
  Sync, schema, and scheduler live under `lib/auth/ldap-*`.

## Audit

- **Audit log** — the append-only record of mutations (task, project, group,
  user, token, webhook, login) with before/after JSON. Written through
  `lib/audit/log.ts`, read through `lib/audit-log/index.ts`.

## Other

- **Custom field** — per-project field schema with typed value columns
  (`valueText`/`valueNumber`/`valueDate`/`valueBool`/`valueJson`). Schema and
  validation in `lib/custom-fields/`; filtering in `lib/custom-fields/filter.ts`.
- **Webhook** — signed outbound delivery of domain events, enqueued through
  `lib/webhook/emit.ts`.
