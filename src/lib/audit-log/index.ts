import { prisma } from "@/lib/db";
import {
  parsePaginationParams,
  buildPaginatedMeta,
  type PaginatedResult,
} from "@/lib/db/pagination";

const GROUP_ACCESS_ACTIONS = [
  "group_grant_created",
  "group_grant_revoked",
  "group_member_added",
  "group_member_removed",
] as const;

export function isGroupAccessAction(action: string): boolean {
  return (GROUP_ACCESS_ACTIONS as readonly string[]).includes(action);
}

export async function listAuditLogs(params: {
  cursor?: string;
  limit?: number;
  entityType?: string;
  action?: string;
  groupAccess?: boolean;
  organizationId?: string;
}): Promise<PaginatedResult<Record<string, unknown>>> {
  const { take, skip, cursor, limit } = parsePaginationParams(params);

  const where: Record<string, unknown> = {
    ...(params.organizationId ? { organizationId: params.organizationId } : {}),
  };
  if (params.entityType) where.entityType = params.entityType;
  if (params.action) where.action = params.action;
  if (params.groupAccess) where.action = { in: [...GROUP_ACCESS_ACTIONS] };

  const logs = await prisma.auditLog.findMany({
    where,
    take,
    skip,
    ...(cursor ? { cursor } : {}),
    orderBy: { occurredAt: "desc" },
    include: {
      actor: { select: { id: true, displayName: true, email: true } },
    },
  });

  return {
    data: logs as unknown as Record<string, unknown>[],
    meta: buildPaginatedMeta(logs as unknown as { id: string }[], limit),
  };
}
