# Wayfinder map: Date hygiene and task activity

## Destination

Finish the date-convention cleanup across the app (calendar drag, seed data, e2e data hygiene) and add a task activity timeline to the task detail page — all four followups shipped, verified, and pushed.

## Notes

- **Domain:** uTask task management platform — Next.js 15 + Prisma + Vitest + Playwright.
- **Skills:** consult `better-ui` / `better-writing` when building the activity timeline UI; `playwright-best-practices` for the e2e self-cleaning ticket.
- **This effort carries execution:** the user asked to *do* all four tickets, not just decide them. Each ticket is a concrete change to implement, test, and ship (per AGENTS.md conventions).
- Canonical date convention: UTC day markers — starts `00:00:00.000Z`, dues `23:59:59.999Z` (`lib/date/day-marker.ts`).
- Every DB mutation must write an audit log entry; RBAC via `lib/rbac/can()`; all strings via `useTranslations()`; all dates via `lib/date/`.

## Decisions so far

<!-- the index — one line per closed ticket: enough to judge relevance, then zoom the link for the detail the ticket holds -->

- [01 — Audit the calendar view's drag and date math against the day-marker convention](issues/01-calendar-drag-dates.md) — placement and drags now go through a new marker-aware `lib/date/calendar-move.ts`; canonical markers stay on their UTC day and drags persist `T00:00:00.000Z` / `T23:59:59.999Z` in every zone.
- [02 — Make the e2e Gantt suite self-cleaning](issues/02-e2e-gantt-self-cleaning.md) — the gantt spec snapshots Product Launch task dates in beforeAll and restores them in afterAll; a full run leaves the DB byte-identical.
- [03 — Seed writes canonical UTC day markers](issues/03-seed-canonical-markers.md) — `seed-sample.ts` gained a `dueDay` helper that writes `T23:59:59.999Z` due markers; all 15 task due dates use it, `completedAt` stays a real instant.
- [04 — Task activity timeline on the task detail page](issues/04-task-activity-timeline.md) — already shipped; verification found 3 missing action keys (added to both locales), added a testid, and new e2e coverage (activity-timeline.spec.ts) proving events + diff render.

## Not yet specified

## Out of scope
