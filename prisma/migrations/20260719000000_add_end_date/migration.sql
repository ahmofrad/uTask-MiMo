-- Add endDate column to Task model
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMPTZ;
