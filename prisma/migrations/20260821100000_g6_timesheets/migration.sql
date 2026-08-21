-- CreateEnum
CREATE TYPE "RateCardScope" AS ENUM ('user', 'role');

-- CreateEnum
CREATE TYPE "TimesheetStatus" AS ENUM ('open', 'submitted', 'approved', 'rejected', 'reopened');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'timesheet_period_created';
ALTER TYPE "AuditAction" ADD VALUE 'timesheet_period_submitted';
ALTER TYPE "AuditAction" ADD VALUE 'timesheet_period_approved';
ALTER TYPE "AuditAction" ADD VALUE 'timesheet_period_rejected';
ALTER TYPE "AuditAction" ADD VALUE 'timesheet_period_reopened';
ALTER TYPE "AuditAction" ADD VALUE 'timesheet_entry_created';
ALTER TYPE "AuditAction" ADD VALUE 'rate_card_created';
ALTER TYPE "AuditAction" ADD VALUE 'rate_card_updated';
ALTER TYPE "AuditAction" ADD VALUE 'rate_card_deleted';

-- CreateTable
CREATE TABLE "RateCard" (
    "id" UUID NOT NULL,
    "scope" "RateCardScope" NOT NULL,
    "userId" UUID,
    "roleType" "RoleType",
    "costRateMinor" INTEGER NOT NULL,
    "billRateMinor" INTEGER,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "effectiveFrom" TIMESTAMPTZ NOT NULL,
    "effectiveTo" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "RateCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetPeriod" (
    "id" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "periodStart" TIMESTAMPTZ NOT NULL,
    "periodEnd" TIMESTAMPTZ NOT NULL,
    "status" "TimesheetStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "TimesheetPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" UUID NOT NULL,
    "periodId" UUID,
    "projectId" UUID NOT NULL,
    "taskId" UUID,
    "userId" UUID NOT NULL,
    "minutes" INTEGER NOT NULL,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "costRateMinorSnapshot" INTEGER NOT NULL,
    "currencySnapshot" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateCard_scope_userId_idx" ON "RateCard"("scope", "userId");

-- CreateIndex
CREATE INDEX "RateCard_scope_roleType_idx" ON "RateCard"("scope", "roleType");

-- CreateIndex
CREATE INDEX "RateCard_effectiveFrom_idx" ON "RateCard"("effectiveFrom");

-- CreateIndex
CREATE INDEX "TimesheetPeriod_departmentId_periodStart_idx" ON "TimesheetPeriod"("departmentId", "periodStart");

-- CreateIndex
CREATE INDEX "TimesheetPeriod_ownerId_idx" ON "TimesheetPeriod"("ownerId");

-- CreateIndex
CREATE INDEX "TimesheetPeriod_status_idx" ON "TimesheetPeriod"("status");

-- CreateIndex
CREATE INDEX "TimeEntry_periodId_idx" ON "TimeEntry"("periodId");

-- CreateIndex
CREATE INDEX "TimeEntry_projectId_userId_idx" ON "TimeEntry"("projectId", "userId");

-- CreateIndex
CREATE INDEX "TimeEntry_userId_createdAt_idx" ON "TimeEntry"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "RateCard" ADD CONSTRAINT "RateCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetPeriod" ADD CONSTRAINT "TimesheetPeriod_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetPeriod" ADD CONSTRAINT "TimesheetPeriod_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "TimesheetPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
