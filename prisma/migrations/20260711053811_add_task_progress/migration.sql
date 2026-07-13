-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "progress" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Task_parentTaskId_idx" ON "Task"("parentTaskId");
