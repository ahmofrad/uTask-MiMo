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
 * projects" (owners and admins). Managers are restricted to projects in their
 * managed departments plus explicit project memberships.
 */
export async function getUserReadableProjectIds(userId: string): Promise<string[] | null> {
  const { globalRole } = await getUserRole(userId);
  if (globalRole === "owner" || globalRole === "admin") return null;
  const memberships = await prisma.projectMember.findMany({
    where: { userId, project: { archivedAt: null } },
    select: { projectId: true },
  });
  if (globalRole !== "manager") return memberships.map((m) => m.projectId);

  const managedProjects = await prisma.project.findMany({
    where: {
      archivedAt: null,
      department: { managerUserId: userId, deletedAt: null },
    },
    select: { id: true },
  });

  return [...new Set([...memberships.map((m) => m.projectId), ...managedProjects.map((p) => p.id)])];
}

export async function listProjects(
  params: ListProjectsParams,
): Promise<PaginatedResult<ProjectListItem>> {
  const { take, skip, cursor, limit } = parsePaginationParams(params);

  const where: Record<string, unknown> = { archivedAt: null };
  if (params.departmentId) where.departmentId = params.departmentId;
  if (params.status) where.status = params.status;
  if (params.projectIds) where.id = { in: params.projectIds };

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
