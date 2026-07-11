import { prisma } from "@/lib/db";
import { getUserRole } from "@/lib/rbac";
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
  /** Restrict results to these project IDs (used for per-user scoping). */
  projectIds?: string[];
};

/**
 * Returns the project IDs a user is allowed to read, or `null` to mean "all
 * projects" (global owner/admin). Project membership is the basis for read
 * access; the token holder's role is always the RBAC subject.
 */
export async function getUserReadableProjectIds(userId: string): Promise<string[] | null> {
  const { globalRole } = await getUserRole(userId);
  if (globalRole === "owner" || globalRole === "admin") return null;
  const memberships = await prisma.projectMember.findMany({
    where: { userId, project: { archivedAt: null } },
    select: { projectId: true },
  });
  return memberships.map((m) => m.projectId);
}

export async function listProjects(
  params: ListProjectsParams,
): Promise<PaginatedResult<ProjectListItem>> {
  const { take, skip, cursor, limit } = parsePaginationParams(params);

  const where: Record<string, unknown> = { archivedAt: null };
  if (params.departmentId) where.departmentId = params.departmentId;
  if (params.status) where.status = params.status;
  if (params.projectIds && params.projectIds.length > 0) where.id = { in: params.projectIds };

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
