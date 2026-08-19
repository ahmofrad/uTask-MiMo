# 04 — Task activity timeline on the task detail page

Type: task
Status: resolved
Blocked by:

## Question

Add a task activity timeline to the task detail page showing who changed what and when, sourced from the audit log (entityType `task`, entityId = task id): action labels, actor name, before/after values where available, and timestamps via `useFormattedDate`. Follow the existing audit-log viewer patterns, i18n every string, and match the design system.

## Answer

The feature was already shipped (a previous session): `activity-timeline.tsx` + `lib/activity/` merge task audit logs and comments with RBAC, cursor pagination, actor names, a before/after diff expander, and load-more — rendered on the task detail page. Verification found and fixed real gaps: three emitted task actions (`task_dependency_created`, `task_dependency_deleted`, `task_moved`) had no translation keys in either locale — added to both en-US and fa-IR. Added a `data-testid` to the timeline and wrote the first e2e coverage (`tests/e2e/activity-timeline.spec.ts`): creates a scratch task via the API, renames it, comments on it, then asserts the timeline shows "created task", "updated task", "commented", the comment body, and the diff expander revealing the title before/after. Passing in Tehran.
