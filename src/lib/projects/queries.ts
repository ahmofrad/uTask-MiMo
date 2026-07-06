import { prisma } from "@/lib/db";
import {
  parsePaginationParams,
  buildPaginatedMeta,
} from "@/lib/db/pagination";
import type { CursorPaginationParams, PaginatedResult } from "@/lib/db/pagination";

type ProjectListItem = Awaited<
  ReturnType<typeof prisma.project.findMany>
>[number];

export async function getProjectById(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: {
      _count: { select: { tasks: true, members: true } },
      owner: { select: { id: true, displayName: true, email: true } },
      department: { select: { id: true, name: true } },
    },
  });
}

export type ListProjectsParams = CursorPaginationParams & {
  departmentId?: string;
  status?: string;
};

export async function listProjects(
  params: ListProjectsParams,
): Promise<PaginatedResult<ProjectListItem>> {
  const { take, skip, cursor, limit } = parsePaginationParams(params);

  const where: Record<string, unknown> = { archivedAt: null };
  if (params.departmentId) where.departmentId = params.departmentId;
  if (params.status) where.status = params.status;

  const projects = await prisma.project.findMany({
    where,
    take,
    skip,
    ...(cursor ? { cursor } : {}),
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { tasks: true, members: true } },
    },
  });

  const meta = buildPaginatedMeta(projects, limit);

  return { data: projects, meta };
}
