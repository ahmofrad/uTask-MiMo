import { prisma } from "@/lib/db";
import { logger } from "@/lib/logging";
import { recordWebhookRetentionDeleted } from "@/lib/metrics";

const DEFAULT_RETENTION_DAYS = 30;
const BATCH_SIZE = 5_000;

export async function pruneWebhookDeliveries(organizationId?: string): Promise<number> {
  const retentionDays = Number(process.env.WEBHOOK_DELIVERY_RETENTION_DAYS) || DEFAULT_RETENTION_DAYS;
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  let totalDeleted = 0;

  for (;;) {
    const deleted = organizationId
      ? await prisma.$executeRaw`
          DELETE FROM "WebhookDelivery"
          WHERE "webhookId" IN (
            SELECT "id" FROM "Webhook" WHERE "organizationId" = ${organizationId}
          )
          AND "id" IN (
            SELECT "id"
            FROM "WebhookDelivery"
            WHERE ("deliveredAt" IS NOT NULL AND "deliveredAt" < ${cutoff})
               OR ("deliveredAt" IS NULL AND "nextRetryAt" IS NULL AND "scheduledAt" < ${cutoff})
            LIMIT ${BATCH_SIZE}
          )
        `
      : await prisma.$executeRaw`
          DELETE FROM "WebhookDelivery"
          WHERE "id" IN (
            SELECT "id"
            FROM "WebhookDelivery"
            WHERE ("deliveredAt" IS NOT NULL AND "deliveredAt" < ${cutoff})
               OR ("deliveredAt" IS NULL AND "nextRetryAt" IS NULL AND "scheduledAt" < ${cutoff})
            LIMIT ${BATCH_SIZE}
          )
        `;
    totalDeleted += deleted;
    if (deleted < BATCH_SIZE) break;
  }

  if (totalDeleted > 0) {
    recordWebhookRetentionDeleted(totalDeleted);
    logger.info({ totalDeleted, retentionDays, cutoff: cutoff.toISOString(), organizationId }, "Webhook delivery retention completed");
  }
  return totalDeleted;
}
