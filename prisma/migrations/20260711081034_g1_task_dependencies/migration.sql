-- CreateEnum
CREATE TYPE "DependencyType" AS ENUM ('FINISH_TO_START', 'START_TO_START', 'FINISH_TO_FINISH', 'RELATES_TO');

-- CreateEnum
CREATE TYPE "LagUnit" AS ENUM ('DAY', 'HOUR');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'unblocked';

-- CreateTable
CREATE TABLE "TaskDependency" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "dependsOnId" UUID NOT NULL,
    "type" "DependencyType" NOT NULL DEFAULT 'FINISH_TO_START',
    "lag" INTEGER NOT NULL DEFAULT 0,
    "lagUnit" "LagUnit" NOT NULL DEFAULT 'DAY',
    "teamId" TEXT,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "TaskDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstanceSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "updatedBy" UUID,

    CONSTRAINT "InstanceSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "TaskDependency_dependsOnId_idx" ON "TaskDependency"("dependsOnId");

-- CreateIndex
CREATE INDEX "TaskDependency_teamId_idx" ON "TaskDependency"("teamId");

-- CreateIndex
CREATE INDEX "TaskDependency_deletedAt_idx" ON "TaskDependency"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaskDependency_taskId_dependsOnId_type_key" ON "TaskDependency"("taskId", "dependsOnId", "type");

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
