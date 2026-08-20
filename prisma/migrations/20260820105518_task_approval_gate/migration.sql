-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE 'pending_approval';

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'task_approved';
ALTER TYPE "AuditAction" ADD VALUE 'task_rejected';

-- AlterTable
ALTER TABLE "Task"
  ADD COLUMN "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "approverId" UUID,
  ADD COLUMN "approvalNote" TEXT;
