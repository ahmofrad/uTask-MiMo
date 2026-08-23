-- Create the default organization before adding foreign keys to existing rows.
CREATE TYPE "OrganizationMembershipRole" AS ENUM ('owner', 'admin', 'member');

CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

CREATE TABLE "OrganizationMembership" (
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "OrganizationMembershipRole" NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("organizationId", "userId")
);

CREATE INDEX "OrganizationMembership_userId_organizationId_idx"
  ON "OrganizationMembership"("userId", "organizationId");

INSERT INTO "Organization" ("id", "name", "slug", "updatedAt")
VALUES ('00000000-0000-4000-8000-0000000000a1', 'Default Organization', 'default', CURRENT_TIMESTAMP);

ALTER TABLE "Role" ADD COLUMN "organizationId" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-0000000000a1';
ALTER TABLE "Department" ADD COLUMN "organizationId" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-0000000000a1';
ALTER TABLE "Project" ADD COLUMN "organizationId" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-0000000000a1';
ALTER TABLE "AuditLog" ADD COLUMN "organizationId" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-0000000000a1';
ALTER TABLE "ApiToken" ADD COLUMN "organizationId" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-0000000000a1';
ALTER TABLE "Webhook" ADD COLUMN "organizationId" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-0000000000a1';
ALTER TABLE "ProjectTemplate" ADD COLUMN "organizationId" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-0000000000a1';
ALTER TABLE "LdapSource" ADD COLUMN "organizationId" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-0000000000a1';
ALTER TABLE "LdapSyncGroup" ADD COLUMN "organizationId" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-0000000000a1';
ALTER TABLE "RateCard" ADD COLUMN "organizationId" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-0000000000a1';

INSERT INTO "OrganizationMembership" ("organizationId", "userId", "role")
SELECT '00000000-0000-4000-8000-0000000000a1', "id",
  CASE
    WHEN EXISTS (SELECT 1 FROM "Role" r WHERE r."userId" = "User"."id" AND r."type" = 'owner' AND r."scopeType" = 'global') THEN 'owner'
    WHEN EXISTS (SELECT 1 FROM "Role" r WHERE r."userId" = "User"."id" AND r."type" = 'admin' AND r."scopeType" = 'global') THEN 'admin'
    ELSE 'member'
  END::"OrganizationMembershipRole"
FROM "User";

ALTER TABLE "OrganizationMembership"
  ADD CONSTRAINT "OrganizationMembership_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationMembership"
  ADD CONSTRAINT "OrganizationMembership_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Role"
  ADD CONSTRAINT "Role_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Department"
  ADD CONSTRAINT "Department_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project"
  ADD CONSTRAINT "Project_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiToken"
  ADD CONSTRAINT "ApiToken_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Webhook"
  ADD CONSTRAINT "Webhook_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectTemplate"
  ADD CONSTRAINT "ProjectTemplate_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LdapSource"
  ADD CONSTRAINT "LdapSource_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LdapSyncGroup"
  ADD CONSTRAINT "LdapSyncGroup_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RateCard"
  ADD CONSTRAINT "RateCard_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Role" DROP CONSTRAINT IF EXISTS "Role_userId_type_scopeType_scopeId_key";
CREATE UNIQUE INDEX "Role_userId_type_scopeType_scopeId_organizationId_key"
  ON "Role"("userId", "type", "scopeType", "scopeId", "organizationId");
CREATE INDEX "Role_organizationId_type_idx" ON "Role"("organizationId", "type");
CREATE INDEX "Department_organizationId_idx" ON "Department"("organizationId");
CREATE INDEX "Project_organizationId_idx" ON "Project"("organizationId");
CREATE INDEX "AuditLog_organizationId_occurredAt_idx" ON "AuditLog"("organizationId", "occurredAt");
CREATE INDEX "ApiToken_organizationId_userId_idx" ON "ApiToken"("organizationId", "userId");
CREATE INDEX "Webhook_organizationId_deletedAt_idx" ON "Webhook"("organizationId", "deletedAt");
CREATE INDEX "ProjectTemplate_organizationId_idx" ON "ProjectTemplate"("organizationId");
CREATE INDEX "LdapSource_organizationId_deletedAt_idx" ON "LdapSource"("organizationId", "deletedAt");
CREATE INDEX "LdapSyncGroup_organizationId_deletedAt_idx" ON "LdapSyncGroup"("organizationId", "deletedAt");
CREATE INDEX "RateCard_organizationId_scope_userId_idx" ON "RateCard"("organizationId", "scope", "userId");
