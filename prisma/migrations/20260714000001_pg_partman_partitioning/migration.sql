-- pg_partman: automated partition management
CREATE SCHEMA IF NOT EXISTS partman;
CREATE EXTENSION IF NOT EXISTS pg_partman SCHEMA partman;

-- ── AuditLog partitioning (monthly on occurredAt) ──────────────────────

-- Rename existing table
ALTER TABLE "AuditLog" RENAME TO "AuditLog_old";

-- Create partitioned parent table
CREATE TABLE "AuditLog" (
    id          UUID        NOT NULL,
    "actorUserId" UUID,
    "actorIp"   VARCHAR(45),
    action      "AuditAction" NOT NULL,
    "entityType" VARCHAR(100) NOT NULL,
    "entityId"  UUID NOT NULL,
    "beforeJson" JSONB,
    "afterJson"  JSONB,
    "occurredAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "requestId"  VARCHAR(100)
) PARTITION BY RANGE ("occurredAt");

-- Create initial monthly partitions manually (2024-01 through 2026-12)
DO $$
DECLARE
    start_date date := '2024-01-01';
    end_date   date := '2027-01-01';
    part_date  date;
    part_name  text;
    part_start text;
    part_end   text;
BEGIN
    part_date := start_date;
    WHILE part_date < end_date LOOP
        part_name := 'AuditLog_' || to_char(part_date, 'YYYYMM');
        part_start := part_date::text;
        part_end := (part_date + interval '1 month')::text;
        EXECUTE format(
            'CREATE TABLE %I PARTITION OF "AuditLog" FOR VALUES FROM (%L) TO (%L)',
            part_name, part_start, part_end
        );
        part_date := part_date + interval '1 month';
    END LOOP;
END $$;

-- Migrate existing data
INSERT INTO "AuditLog" SELECT * FROM "AuditLog_old";

-- Drop old table
DROP TABLE "AuditLog_old";

-- Recreate indexes on partitioned parent
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_occurredAt_idx" ON "AuditLog" ("entityType", "entityId", "occurredAt");
CREATE INDEX IF NOT EXISTS "AuditLog_actorUserId_occurredAt_idx" ON "AuditLog" ("actorUserId", "occurredAt");
CREATE INDEX IF NOT EXISTS "AuditLog_occurredAt_idx" ON "AuditLog" ("occurredAt");

-- Register with pg_partman for ongoing maintenance
INSERT INTO partman.part_config (
    parent_table, control, partition_type, partition_interval,
    premake, automatic_maintenance
) VALUES (
    'public."AuditLog"', 'occurredAt', 'range', '1 month', 3, 'on'
);

-- ── WebhookDelivery partitioning (monthly on scheduledAt) ────────────────

ALTER TABLE "WebhookDelivery" RENAME TO "WebhookDelivery_old";

CREATE TABLE "WebhookDelivery" (
    id              UUID NOT NULL,
    "webhookId"     UUID NOT NULL,
    "eventType"     VARCHAR(100) NOT NULL,
    "eventId"       UUID NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "requestPayload" JSONB,
    "responseStatus" INTEGER,
    "responseBody"  TEXT,
    "responseHeaders" JSONB,
    "durationMs"    INTEGER,
    "error"         TEXT,
    "scheduledAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
    "deliveredAt"   TIMESTAMPTZ,
    "nextRetryAt"   TIMESTAMPTZ
) PARTITION BY RANGE ("scheduledAt");

-- Create initial monthly partitions manually
DO $$
DECLARE
    start_date date := '2024-01-01';
    end_date   date := '2027-01-01';
    part_date  date;
    part_name  text;
    part_start text;
    part_end   text;
BEGIN
    part_date := start_date;
    WHILE part_date < end_date LOOP
        part_name := 'WebhookDelivery_' || to_char(part_date, 'YYYYMM');
        part_start := part_date::text;
        part_end := (part_date + interval '1 month')::text;
        EXECUTE format(
            'CREATE TABLE %I PARTITION OF "WebhookDelivery" FOR VALUES FROM (%L) TO (%L)',
            part_name, part_start, part_end
        );
        part_date := part_date + interval '1 month';
    END LOOP;
END $$;

-- Migrate existing data
INSERT INTO "WebhookDelivery" SELECT * FROM "WebhookDelivery_old";

-- Drop old table
DROP TABLE "WebhookDelivery_old";

-- Recreate indexes on partitioned parent
CREATE INDEX IF NOT EXISTS "WebhookDelivery_webhookId_scheduledAt_idx" ON "WebhookDelivery" ("webhookId", "scheduledAt");
CREATE INDEX IF NOT EXISTS "WebhookDelivery_eventId_idx" ON "WebhookDelivery" ("eventId");

-- Recreate foreign key
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "Webhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Register with pg_partman for ongoing maintenance
INSERT INTO partman.part_config (
    parent_table, control, partition_type, partition_interval,
    premake, automatic_maintenance
) VALUES (
    'public."WebhookDelivery"', 'scheduledAt', 'range', '1 month', 3, 'on'
);