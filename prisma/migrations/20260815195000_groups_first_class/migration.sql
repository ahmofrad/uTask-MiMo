-- Make groups first-class.
-- Manual groups live in the same table as AD-synced groups; `source` tells the
-- two apart, and `dn` becomes nullable because manual groups have no directory
-- DN. AD-specific behaviors (auto-department, orphan-user disabling) are gated
-- on `source = 'ldap'` in application code.
--
-- NOTE: this migration intentionally does NOT include the AuditLog /
-- WebhookDelivery / TaskAssignee drift that `prisma migrate dev` would generate
-- (partitioned tables are managed by pg_partman outside the Prisma schema).
-- Apply with `prisma migrate deploy`.

-- CreateEnum
CREATE TYPE "GroupSource" AS ENUM ('ldap', 'manual');

-- AlterTable
ALTER TABLE "LdapSyncGroup" ADD COLUMN     "ownerDepartmentId" UUID,
ADD COLUMN     "source" "GroupSource" NOT NULL DEFAULT 'ldap',
ALTER COLUMN "dn" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "assigneeGroupId" UUID;

-- CreateTable
CREATE TABLE "ProjectGroupGrant" (
    "projectId" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "role" "ProjectMemberRole" NOT NULL DEFAULT 'contributor',
    "grantedBy" UUID NOT NULL,
    "grantedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectGroupGrant_pkey" PRIMARY KEY ("projectId","groupId")
);

-- CreateIndex
CREATE INDEX "ProjectGroupGrant_groupId_projectId_idx" ON "ProjectGroupGrant"("groupId", "projectId");

-- CreateIndex
CREATE INDEX "LdapSyncGroup_ownerDepartmentId_idx" ON "LdapSyncGroup"("ownerDepartmentId");

-- CreateIndex
CREATE INDEX "Task_assigneeGroupId_idx" ON "Task"("assigneeGroupId");

-- AddForeignKey
ALTER TABLE "ProjectGroupGrant" ADD CONSTRAINT "ProjectGroupGrant_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectGroupGrant" ADD CONSTRAINT "ProjectGroupGrant_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "LdapSyncGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectGroupGrant" ADD CONSTRAINT "ProjectGroupGrant_grantedBy_fkey" FOREIGN KEY ("grantedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeGroupId_fkey" FOREIGN KEY ("assigneeGroupId") REFERENCES "LdapSyncGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LdapSyncGroup" ADD CONSTRAINT "LdapSyncGroup_ownerDepartmentId_fkey" FOREIGN KEY ("ownerDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
