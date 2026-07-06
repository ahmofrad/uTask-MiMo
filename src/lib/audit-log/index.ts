import { prisma } from "@/lib/db";
import {
  parsePaginationParams,
  buildPaginatedMeta,
  type PaginatedResult,
} from "@/lib/db/pagination";

export async function listAuditLogs(params: {
  cursor?: string;
  limit?: number;
  entityType?: string;
  action?: string;
}): Promise<PaginatedResult<Record<string, unknown>>> {
  const { take, skip, cursor, limit } = parsePaginationParams(params);

  const where: Record<string, unknown> = {};
  if (params.entityType) where.entityType = params.entityType;
  if (params.action) where.action = params.action;

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
