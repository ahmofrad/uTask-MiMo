-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "scheduleVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "isMilestone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "milestoneKind" TEXT;
