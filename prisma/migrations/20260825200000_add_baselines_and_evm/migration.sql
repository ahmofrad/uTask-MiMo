-- CreateEnum
CREATE TYPE "BaselineSource" AS ENUM ('MANUAL', 'CHANGE_REQUEST');

-- CreateEnum
CREATE TYPE "EacMethod" AS ENUM ('CPI_BASED', 'SPI_BASED', 'TCPI_BASED');

-- CreateTable
CREATE TABLE "ProjectBaseline" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" "BaselineSource" NOT NULL DEFAULT 'MANUAL',
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "snapshot" JSONB NOT NULL,
    "capturedBy" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectBaseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaselineEntry" (
    "id" TEXT NOT NULL,
    "baselineId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "percentComplete" INTEGER,
    "budgetLineMinor" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BaselineEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvmSnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "bac" DOUBLE PRECISION NOT NULL,
    "pv" DOUBLE PRECISION NOT NULL,
    "ev" DOUBLE PRECISION NOT NULL,
    "ac" DOUBLE PRECISION NOT NULL,
    "cv" DOUBLE PRECISION NOT NULL,
    "sv" DOUBLE PRECISION NOT NULL,
    "cpi" DOUBLE PRECISION NOT NULL,
    "spi" DOUBLE PRECISION NOT NULL,
    "eac" DOUBLE PRECISION NOT NULL,
    "vac" DOUBLE PRECISION NOT NULL,
    "tcpi" DOUBLE PRECISION NOT NULL,
    "eacMethod" "EacMethod" NOT NULL DEFAULT 'CPI_BASED',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvmSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectBaseline_projectId_isCurrent_key" ON "ProjectBaseline"("projectId", "isCurrent");

-- CreateIndex
CREATE INDEX "ProjectBaseline_projectId_idx" ON "ProjectBaseline"("projectId");

-- CreateIndex
CREATE INDEX "BaselineEntry_baselineId_idx" ON "BaselineEntry"("baselineId");

-- CreateIndex
CREATE INDEX "BaselineEntry_taskId_idx" ON "BaselineEntry"("taskId");

-- CreateIndex
CREATE INDEX "EvmSnapshot_projectId_snapshotDate_idx" ON "EvmSnapshot"("projectId", "snapshotDate");

-- AddForeignKey
ALTER TABLE "ProjectBaseline" ADD CONSTRAINT "ProjectBaseline_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaselineEntry" ADD CONSTRAINT "BaselineEntry_baselineId_fkey" FOREIGN KEY ("baselineId") REFERENCES "ProjectBaseline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvmSnapshot" ADD CONSTRAINT "EvmSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
