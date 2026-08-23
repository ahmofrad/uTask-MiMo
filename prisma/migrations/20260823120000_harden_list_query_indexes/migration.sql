-- Support the per-user project visibility query without scanning all project memberships.
CREATE INDEX "ProjectMember_userId_disabledAt_projectId_idx"
  ON "ProjectMember" ("userId", "disabledAt", "projectId");

-- Support active, non-deleted webhook subscription lookup during event emission.
CREATE INDEX "Webhook_active_deletedAt_idx"
  ON "Webhook" ("active", "deletedAt");

-- Support delivery history pagination ordered by scheduled time and id.
CREATE INDEX "WebhookDelivery_scheduledAt_id_idx"
  ON "WebhookDelivery" ("scheduledAt", "id");
