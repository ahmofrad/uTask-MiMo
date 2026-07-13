-- Backfill progress for already-completed tasks so rollups are correct on upgrade.
UPDATE "Task" SET "progress" = 100 WHERE "status" = 'done' AND "deletedAt" IS NULL;
