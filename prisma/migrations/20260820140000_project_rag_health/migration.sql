-- CreateEnum
CREATE TYPE "RagStatus" AS ENUM ('GREEN', 'AMBER', 'RED');

-- AlterTable
ALTER TABLE "Project"
  ADD COLUMN "ragStatus" "RagStatus" NOT NULL DEFAULT 'GREEN',
  ADD COLUMN "ragReason" VARCHAR(500),
  ADD COLUMN "healthUpdatedAt" TIMESTAMP(3) WITH TIME ZONE;

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'project_health_updated';
