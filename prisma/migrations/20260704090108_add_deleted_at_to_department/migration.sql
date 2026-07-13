/*
  Warnings:

  - You are about to drop the column `fts` on the `Comment` table. All the data in the column will be lost.
  - You are about to drop the column `fts` on the `CustomFieldValue` table. All the data in the column will be lost.
  - You are about to drop the column `fts` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `fts` on the `Task` table. All the data in the column will be lost.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'login_success';
ALTER TYPE "AuditAction" ADD VALUE 'login_failed';
ALTER TYPE "AuditAction" ADD VALUE 'logout';
ALTER TYPE "AuditAction" ADD VALUE 'force_logout';
ALTER TYPE "AuditAction" ADD VALUE 'identity_linked';
ALTER TYPE "AuditAction" ADD VALUE 'user_jit_created';
ALTER TYPE "AuditAction" ADD VALUE 'password_changed';
ALTER TYPE "AuditAction" ADD VALUE 'password_reset_requested';
ALTER TYPE "AuditAction" ADD VALUE 'saml_config_changed';
ALTER TYPE "AuditAction" ADD VALUE 'ldap_config_changed';
ALTER TYPE "AuditAction" ADD VALUE 'task_created';
ALTER TYPE "AuditAction" ADD VALUE 'task_updated';
ALTER TYPE "AuditAction" ADD VALUE 'task_deleted';
ALTER TYPE "AuditAction" ADD VALUE 'task_reordered';
ALTER TYPE "AuditAction" ADD VALUE 'comment_created';
ALTER TYPE "AuditAction" ADD VALUE 'comment_updated';
ALTER TYPE "AuditAction" ADD VALUE 'comment_deleted';
ALTER TYPE "AuditAction" ADD VALUE 'project_created';
ALTER TYPE "AuditAction" ADD VALUE 'project_updated';
ALTER TYPE "AuditAction" ADD VALUE 'project_archived';
ALTER TYPE "AuditAction" ADD VALUE 'custom_field_created';
ALTER TYPE "AuditAction" ADD VALUE 'custom_field_updated';
ALTER TYPE "AuditAction" ADD VALUE 'custom_field_archived';
ALTER TYPE "AuditAction" ADD VALUE 'project_member_added';
ALTER TYPE "AuditAction" ADD VALUE 'watcher_added';
ALTER TYPE "AuditAction" ADD VALUE 'watcher_removed';
ALTER TYPE "AuditAction" ADD VALUE 'settings_updated';
ALTER TYPE "AuditAction" ADD VALUE 'user_updated';
ALTER TYPE "AuditAction" ADD VALUE 'user_suspended';
ALTER TYPE "AuditAction" ADD VALUE 'user_unsuspended';
ALTER TYPE "AuditAction" ADD VALUE 'department_created';
ALTER TYPE "AuditAction" ADD VALUE 'department_updated';
ALTER TYPE "AuditAction" ADD VALUE 'department_deleted';
ALTER TYPE "AuditAction" ADD VALUE 'session_revoked';

-- DropForeignKey
ALTER TABLE "Account" DROP CONSTRAINT "Account_userId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- DropIndex
DROP INDEX "Comment_fts_idx";

-- DropIndex
DROP INDEX "CustomFieldValue_fts_idx";

-- DropIndex
DROP INDEX "Project_fts_idx";

-- DropIndex
DROP INDEX "Task_fts_idx";

-- AlterTable
ALTER TABLE "Account" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Comment" DROP COLUMN "fts";

-- AlterTable
ALTER TABLE "CustomFieldValue" DROP COLUMN "fts";

-- AlterTable
ALTER TABLE "Department" ADD COLUMN     "deletedAt" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "fts";

-- AlterTable
ALTER TABLE "Session" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "fts",
ADD COLUMN     "deletedAt" TIMESTAMPTZ;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
