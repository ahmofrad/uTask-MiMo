ALTER TABLE "TimeEntry"
  ADD COLUMN IF NOT EXISTS "billRateMinorSnapshot" INTEGER;
