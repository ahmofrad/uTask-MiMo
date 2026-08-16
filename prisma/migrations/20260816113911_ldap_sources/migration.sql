-- Multiple Active Directory sources.
--
-- A new `LdapSource` row represents one configured directory (connection,
-- bind credentials, UPN suffix, search base, per-source sync schedule).
-- AD-synced groups point at the source they came from via
-- `LdapSyncGroup.sourceId` (null for manual groups).
--
-- NOTE: this migration intentionally does NOT include the AuditLog /
-- WebhookDelivery / TaskAssignee drift that `prisma migrate dev` would generate
-- (partitioned tables are managed by pg_partman outside the Prisma schema).
-- Apply with `prisma migrate deploy`.

-- AlterTable
ALTER TABLE "LdapSyncGroup" ADD COLUMN     "sourceId" UUID;

-- CreateTable
CREATE TABLE "LdapSource" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "url" VARCHAR(512) NOT NULL,
    "bindUpn" VARCHAR(255) NOT NULL,
    "bindPassword" VARCHAR(512) NOT NULL,
    "upnSuffix" VARCHAR(255),
    "searchBase" VARCHAR(512),
    "emailAttribute" VARCHAR(64) NOT NULL DEFAULT 'mail',
    "nameAttribute" VARCHAR(64) NOT NULL DEFAULT 'cn',
    "defaultRole" VARCHAR(64) NOT NULL DEFAULT 'member',
    "syncIntervalHours" INTEGER NOT NULL DEFAULT 12,
    "tlsCaCert" TEXT,
    "lastSyncedAt" TIMESTAMPTZ,
    "lastSyncError" TEXT,
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "LdapSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LdapSource_deletedAt_idx" ON "LdapSource"("deletedAt");

-- CreateIndex
CREATE INDEX "LdapSyncGroup_sourceId_idx" ON "LdapSyncGroup"("sourceId");

-- AddForeignKey
ALTER TABLE "LdapSyncGroup" ADD CONSTRAINT "LdapSyncGroup_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "LdapSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Auto-migrate the legacy single LDAP config (settings JSON blob under key
-- `ldap`, scope `install`) into the first `LdapSource` row, then backfill
-- `sourceId` on existing AD-synced groups so nothing breaks on upgrade.
-- Manual groups (source = 'manual') keep a NULL sourceId. The settings row is
-- left in place — the config-plumbing ticket flips readers to the new table.
DO $$
DECLARE
  v_source_id UUID;
  v_name TEXT;
  v_json JSONB;
BEGIN
  SELECT "valueJson" INTO v_json
  FROM "Settings"
  WHERE scope = 'install' AND key = 'ldap';

  IF v_json IS NOT NULL AND jsonb_typeof(v_json) = 'object' THEN
    -- Derive a display name from the UPN suffix / bind UPN / host, falling
    -- back to a generic label (the old config had no name field).
    v_name := NULLIF(v_json->>'upnSuffix', '');
    IF v_name IS NULL THEN
      v_name := SPLIT_PART(COALESCE(v_json->>'bindUpn', ''), '@', 2);
    END IF;
    IF v_name IS NULL OR v_name = '' THEN
      v_name := SPLIT_PART(COALESCE(v_json->>'url', ''), '://', 2);
      v_name := SPLIT_PART(COALESCE(v_name, ''), ':', 1);
    END IF;
    IF v_name IS NULL OR v_name = '' THEN
      v_name := 'Active Directory';
    END IF;

    INSERT INTO "LdapSource" (
      "id", "name", "enabled", "url", "bindUpn", "bindPassword",
      "upnSuffix", "searchBase", "emailAttribute", "nameAttribute",
      "defaultRole", "syncIntervalHours", "tlsCaCert", "createdAt", "updatedAt"
    )
    VALUES (
      gen_random_uuid(),
      LEFT(v_name, 255),
      COALESCE((v_json->>'enabled')::boolean, false),
      COALESCE(v_json->>'url', ''),
      COALESCE(v_json->>'bindUpn', ''),
      COALESCE(v_json->>'bindPassword', ''),
      NULLIF(v_json->>'upnSuffix', ''),
      NULLIF(v_json->>'searchBase', ''),
      COALESCE(v_json->>'emailAttribute', 'mail'),
      COALESCE(v_json->>'nameAttribute', 'cn'),
      COALESCE(v_json->>'defaultRole', 'member'),
      COALESCE((v_json->>'syncIntervalHours')::int, 12),
      NULLIF(v_json->>'tlsCaCert', ''),
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    RETURNING "id" INTO v_source_id;

    UPDATE "LdapSyncGroup"
    SET "sourceId" = v_source_id
    WHERE source = 'ldap' AND "sourceId" IS NULL;
  END IF;
END $$;
