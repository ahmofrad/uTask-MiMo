# 03 — Seed writes canonical UTC day markers

Type: task
Status: resolved
Blocked by:

## Question

The seed's `day(d)` helper creates relative real instants (`now + d * 86400000`) for date-only fields, which render differently per runtime zone and drift from the app's canonical UTC day-marker convention. Make date-only fields (`startDate`, `dueDate`) in `prisma/seed-sample.ts` write canonical UTC markers (starts `T00:00:00.000Z`, dues `T23:59:59.999Z`) so fresh installs and CI never create the mixed-convention dates the app had to be hardened against.

## Answer

Added a `dueDay(d)` helper to `prisma/seed-sample.ts` that writes canonical `T23:59:59.999Z` due markers (UTC-constructed, zone independent); all 15 task `dueDate` fields now use it. `completedAt` intentionally keeps the real-instant `day()` helper — it is a timestamp, not a date-only value. Typecheck clean; seed not re-run locally (it would wipe the dev DB). Shipped in `05cf2cc`.
