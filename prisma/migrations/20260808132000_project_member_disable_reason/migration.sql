CREATE TYPE "ProjectMemberDisableReason" AS ENUM ('ldap');

ALTER TABLE "ProjectMember"
  ADD COLUMN "disabledReason" "ProjectMemberDisableReason";
