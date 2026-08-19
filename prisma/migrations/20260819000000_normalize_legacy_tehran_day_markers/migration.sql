-- Normalize legacy Asia/Tehran local-midnight day markers to canonical UTC
-- day markers.
--
-- Historical data (seeded projects and pre-marker-aware drags) stored
-- date-only task values as Asia/Tehran local midnights: starts/ends at
-- 20:30:00.000Z and dues at 20:29:59.xZ — i.e. local 00:00 and 23:59:59 in
-- UTC+03:30 — which is the same calendar day as the canonical marker one UTC
-- day later. Shifting each by +03:30 lands exactly on the canonical shape
-- (00:00:00.000Z starts / 23:59:59.999Z dues), so calendar-day math is
-- identical in every timezone.
--
-- EXTRACT(SECOND ...) returns fractional seconds (59.999), so the legacy end
-- marker match floors it — the end marker is any 20:29:59.xZ value.
--
-- Genuine instants (e.g. 07:13:18.490Z values created by e2e runs) match
-- neither legacy shape and are left untouched.

-- Task start dates: both legacy shapes (start marker 20:30:00.000Z and the
-- rarer end-shaped 20:29:59.xZ) shift to the canonical start marker.
UPDATE "Task"
SET "startDate" = "startDate" + INTERVAL '3 hours 30 minutes'
WHERE "startDate" IS NOT NULL
  AND (
    (EXTRACT(HOUR FROM "startDate" AT TIME ZONE 'UTC') = 20
     AND EXTRACT(MINUTE FROM "startDate" AT TIME ZONE 'UTC') = 30
     AND EXTRACT(SECOND FROM "startDate" AT TIME ZONE 'UTC') = 0
     AND EXTRACT(MILLISECONDS FROM "startDate" AT TIME ZONE 'UTC') = 0)
    OR
    (EXTRACT(HOUR FROM "startDate" AT TIME ZONE 'UTC') = 20
     AND EXTRACT(MINUTE FROM "startDate" AT TIME ZONE 'UTC') = 29
     AND FLOOR(EXTRACT(SECOND FROM "startDate" AT TIME ZONE 'UTC')) = 59)
  );

-- Task end dates: same convention as start dates (the calendar picker writes
-- them start-shaped), so apply the identical rule.
UPDATE "Task"
SET "endDate" = "endDate" + INTERVAL '3 hours 30 minutes'
WHERE "endDate" IS NOT NULL
  AND (
    (EXTRACT(HOUR FROM "endDate" AT TIME ZONE 'UTC') = 20
     AND EXTRACT(MINUTE FROM "endDate" AT TIME ZONE 'UTC') = 30
     AND EXTRACT(SECOND FROM "endDate" AT TIME ZONE 'UTC') = 0
     AND EXTRACT(MILLISECONDS FROM "endDate" AT TIME ZONE 'UTC') = 0)
    OR
    (EXTRACT(HOUR FROM "endDate" AT TIME ZONE 'UTC') = 20
     AND EXTRACT(MINUTE FROM "endDate" AT TIME ZONE 'UTC') = 29
     AND FLOOR(EXTRACT(SECOND FROM "endDate" AT TIME ZONE 'UTC')) = 59)
  );

-- Task due dates: legacy end marker 20:29:59.xZ shifts to 23:59:59.999Z; the
-- start-shaped 20:30:00.000Z variant (from the old calendar drag) shifts to
-- the canonical 00:00:00.000Z of the intended day.
UPDATE "Task"
SET "dueDate" = "dueDate" + INTERVAL '3 hours 30 minutes'
WHERE "dueDate" IS NOT NULL
  AND (
    (EXTRACT(HOUR FROM "dueDate" AT TIME ZONE 'UTC') = 20
     AND EXTRACT(MINUTE FROM "dueDate" AT TIME ZONE 'UTC') = 30
     AND EXTRACT(SECOND FROM "dueDate" AT TIME ZONE 'UTC') = 0
     AND EXTRACT(MILLISECONDS FROM "dueDate" AT TIME ZONE 'UTC') = 0)
    OR
    (EXTRACT(HOUR FROM "dueDate" AT TIME ZONE 'UTC') = 20
     AND EXTRACT(MINUTE FROM "dueDate" AT TIME ZONE 'UTC') = 29
     AND FLOOR(EXTRACT(SECOND FROM "dueDate" AT TIME ZONE 'UTC')) = 59)
  );
