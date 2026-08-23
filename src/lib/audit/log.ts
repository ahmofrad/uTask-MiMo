import { prisma } from "@/lib/db";
import { logger } from "@/lib/logging";
import type { AuditAction } from "@prisma/client";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/organizations/context";

type LogAuditParams = {
  actorUserId: string | null;
  actorIp?: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  requestId?: string;
  organizationId?: string;
};

export async function logAudit(params: LogAuditParams) {
  try {
    const data: Record<string, unknown> = {
      organizationId: params.organizationId ?? DEFAULT_ORGANIZATION_ID,
      actorUserId: params.actorUserId,
      actorIp: params.actorIp ?? "",
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      requestId: params.requestId ?? "",
    };
    if (params.before != null) data.beforeJson = params.before;
    if (params.after != null) data.afterJson = params.after;
    await prisma.auditLog.create({ data: data as never });
  } catch (err) {
    logger.error(err, "Failed to write audit log");
    throw err instanceof Error ? err : new Error("Failed to write audit log");
  }
}
