-- Preserve removed LDAP selections and disable, rather than delete, project memberships.
ALTER TABLE "ProjectMember"
  ADD COLUMN "disabledAt" TIMESTAMPTZ;

ALTER TABLE "LdapSyncGroup"
  ADD COLUMN "deletedAt" TIMESTAMPTZ;

CREATE INDEX "LdapSyncGroup_deletedAt_idx"
  ON "LdapSyncGroup"("deletedAt");
