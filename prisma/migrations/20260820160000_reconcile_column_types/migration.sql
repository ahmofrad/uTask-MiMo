-- Reconcile two column-type drifts between the migration history and schema.prisma:
--   * TaskAssignee.createdAt  timestamp without time zone -> timestamptz  (@db.Timestamptz)
--   * ProjectTemplate.templateJson  jsonb -> json  (@db.Json)
-- These were created by hand-maintained DDL that drifted from the Prisma data model.

-- AlterTable
ALTER TABLE "ProjectTemplate" ALTER COLUMN "templateJson" SET DATA TYPE JSON;

-- AlterTable
ALTER TABLE "TaskAssignee" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ;
