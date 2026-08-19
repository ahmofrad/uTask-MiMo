# 03 — Seed writes canonical UTC day markers

Type: task
Status: claimed
Blocked by:

## Question

The seed's `day(d)` helper creates relative real instants (`now + d * 86400000`) for date-only fields, which render differently per runtime zone and drift from the app's canonical UTC day-marker convention. Make date-only fields (`startDate`, `dueDate`) in `prisma/seed-sample.ts` write canonical UTC markers (starts `T00:00:00.000Z`, dues `T23:59:59.999Z`) so fresh installs and CI never create the mixed-convention dates the app had to be hardened against.
