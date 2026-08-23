-- pg_trgm is installed by the initial schema migration. These indexes make
-- Prisma's case-insensitive contains filters usable at large row counts.
CREATE INDEX IF NOT EXISTS "Task_title_trgm_idx"
  ON "Task" USING gin ("title" gin_trgm_ops)
  WHERE "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "Task_description_trgm_idx"
  ON "Task" USING gin ("description" gin_trgm_ops)
  WHERE "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "Project_name_trgm_idx"
  ON "Project" USING gin ("name" gin_trgm_ops)
  WHERE "archivedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "Comment_bodyMarkdown_trgm_idx"
  ON "Comment" USING gin ("bodyMarkdown" gin_trgm_ops)
  WHERE "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "CustomFieldValue_valueText_trgm_idx"
  ON "CustomFieldValue" USING gin ("valueText" gin_trgm_ops)
  WHERE "valueText" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "WebhookDelivery_retention_idx"
  ON "WebhookDelivery" ("deliveredAt", "scheduledAt")
  WHERE "deliveredAt" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Project_createdAt_id_idx"
  ON "Project" ("createdAt", "id");

CREATE INDEX IF NOT EXISTS "Task_createdAt_id_idx"
  ON "Task" ("createdAt", "id");

CREATE INDEX IF NOT EXISTS "Webhook_createdAt_id_idx"
  ON "Webhook" ("createdAt", "id");

CREATE INDEX IF NOT EXISTS "Comment_taskId_createdAt_id_idx"
  ON "Comment" ("taskId", "createdAt", "id");

CREATE INDEX IF NOT EXISTS "User_displayName_id_idx"
  ON "User" ("displayName", "id");

CREATE INDEX IF NOT EXISTS "CustomField_projectId_orderIndex_id_idx"
  ON "CustomField" ("projectId", "orderIndex", "id")
  WHERE "archivedAt" IS NULL;
