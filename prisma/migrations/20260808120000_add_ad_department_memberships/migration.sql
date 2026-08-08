-- Add the AD-backed department source and normalized group membership model.
CREATE TYPE "DepartmentSource" AS ENUM ('manual', 'ldap');

ALTER TABLE "Department"
  ADD COLUMN "ldapSyncGroupId" UUID,
  ADD COLUMN "source" "DepartmentSource" NOT NULL DEFAULT 'manual';

ALTER TABLE "LdapSyncGroup"
  ADD COLUMN "objectGuid" VARCHAR(128);

CREATE TABLE "LdapGroupMembership" (
  "userId" UUID NOT NULL,
  "ldapSyncGroupId" UUID NOT NULL,
  "sourceMemberDn" VARCHAR(512),
  "lastSeenAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LdapGroupMembership_pkey" PRIMARY KEY ("userId", "ldapSyncGroupId")
);

CREATE INDEX "LdapGroupMembership_ldapSyncGroupId_lastSeenAt_idx"
  ON "LdapGroupMembership"("ldapSyncGroupId", "lastSeenAt");

CREATE UNIQUE INDEX "Department_ldapSyncGroupId_key"
  ON "Department"("ldapSyncGroupId");

CREATE UNIQUE INDEX "LdapSyncGroup_objectGuid_key"
  ON "LdapSyncGroup"("objectGuid");

ALTER TABLE "Department"
  ADD CONSTRAINT "Department_managerUserId_fkey"
  FOREIGN KEY ("managerUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Department"
  ADD CONSTRAINT "Department_ldapSyncGroupId_fkey"
  FOREIGN KEY ("ldapSyncGroupId") REFERENCES "LdapSyncGroup"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LdapGroupMembership"
  ADD CONSTRAINT "LdapGroupMembership_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LdapGroupMembership"
  ADD CONSTRAINT "LdapGroupMembership_ldapSyncGroupId_fkey"
  FOREIGN KEY ("ldapSyncGroupId") REFERENCES "LdapSyncGroup"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
