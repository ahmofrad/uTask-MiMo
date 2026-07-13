-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'project_member_removed';

-- AlterTable
ALTER TABLE "Webhook" ADD COLUMN     "deletedAt" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "Task_dueDate_idx" ON "Task"("dueDate");

-- CreateIndex
CREATE INDEX "Task_deletedAt_idx" ON "Task"("deletedAt");

-- CreateIndex
CREATE INDEX "Watcher_userId_idx" ON "Watcher"("userId");

-- CreateIndex
CREATE INDEX "Webhook_deletedAt_idx" ON "Webhook"("deletedAt");

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_addedBy_fkey" FOREIGN KEY ("addedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
