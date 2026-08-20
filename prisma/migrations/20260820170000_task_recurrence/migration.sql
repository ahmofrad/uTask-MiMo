-- Recurring tasks: track the root of a recurrence series and audit spawned occurrences.

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "recurrenceParentId" UUID;

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'task_recurrence_spawned';
