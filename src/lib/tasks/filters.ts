import { Prisma } from "@prisma/client";

export type TaskFilterParams = {
  projectId?: string | null;
  assigneeId?: string | null;
  status?: string | null;
  priority?: string | null;
  dueDateGte?: string | null;
  dueDateLte?: string | null;
  search?: string | null;
};

export function buildTaskFilters(params: TaskFilterParams): Prisma.TaskWhereInput {
  const where: Prisma.TaskWhereInput = { deletedAt: null, parentTaskId: null };

  if (params.projectId) {
    where.projectId = params.projectId;
  }

  if (params.assigneeId) {
    where.assigneeId = params.assigneeId;
  }

  if (params.status) {
    where.status = params.status as never;
  }

  if (params.priority) {
    where.priority = params.priority as never;
  }

  if (params.dueDateGte || params.dueDateLte) {
    const dueDateFilter: Prisma.DateTimeFilter = {};
    if (params.dueDateGte) dueDateFilter.gte = new Date(params.dueDateGte);
    if (params.dueDateLte) dueDateFilter.lte = new Date(params.dueDateLte);
    where.dueDate = dueDateFilter;
  }

  if (params.search) {
    where.OR = [
      { title: { contains: params.search, mode: "insensitive" } },
      { description: { contains: params.search, mode: "insensitive" } },
    ];
  }

  return where;
}
