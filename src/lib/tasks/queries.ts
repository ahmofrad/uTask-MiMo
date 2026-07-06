import { prisma } from "@/lib/db";
import {
  parsePaginationParams,
  buildPaginatedMeta,
  type CursorPaginationParams,
} from "@/lib/db/pagination";
import { getCustomFieldValuesForTask } from "@/lib/custom-fields/values";
import { buildTaskFilters, type TaskFilterParams } from "./filters";

const TASK_LIST_INCLUDE = {
  assignee: { select: { id: true, displayName: true, email: true } },
  reporter: { select: { id: true, displayName: true } },
  tags: { include: { tag: true } },
  _count: { select: { comments: true, attachments: true, subtasks: true } },
} as const;

const TASK_DETAIL_INCLUDE = {
  project: { select: { id: true, name: true } },
  assignee: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
  reporter: { select: { id: true, displayName: true, email: true } },
  createdBy: { select: { id: true, displayName: true } },
  parentTask: { select: { id: true, title: true } },
  subtasks: {
    where: { deletedAt: null },
    orderBy: { orderIndex: "asc" as const },
    select: { id: true, title: true, status: true, priority: true, assigneeId: true },
  },
  tags: { include: { tag: true } },
  _count: { select: { comments: true, attachments: true, watchers: true } },
} as const;

const INBOX_TASK_INCLUDE = {
  project: { select: { id: true, name: true } },
  reporter: { select: { id: true, displayName: true } },
  tags: { include: { tag: true } },
} as const;

const INBOX_WATCHING_INCLUDE = {
  project: { select: { id: true, name: true } },
  assignee: { select: { id: true, displayName: true } },
  reporter: { select: { id: true, displayName: true } },
  tags: { include: { tag: true } },
} as const;

export type GetTaskByIdResult = Awaited<ReturnType<typeof getTaskById>>;

export async function getTaskById(id: string) {
  const task = await prisma.task.findUnique({
    where: { id },
    include: TASK_DETAIL_INCLUDE,
  });

  if (!task) return null;

  const customFields = await getCustomFieldValuesForTask(id);

  return { ...task, customFields };
}

export type ListTasksParams = CursorPaginationParams & TaskFilterParams;

export type ListTasksResult = {
  data: Awaited<ReturnType<typeof prisma.task.findMany>>;
  meta: ReturnType<typeof buildPaginatedMeta>;
};

export async function listTasks(params: ListTasksParams) {
  const { take, skip, cursor, limit } = parsePaginationParams(params);
  const where = buildTaskFilters(params);

  const tasks = await prisma.task.findMany({
    where,
    take,
    skip,
    ...(cursor ? { cursor } : {}),
    orderBy: { orderIndex: "asc" },
    include: TASK_LIST_INCLUDE,
  });

  const meta = buildPaginatedMeta(tasks, limit);

  return { data: tasks, meta };
}

export type GetInboxTasksResult = {
  unassigned: Awaited<ReturnType<typeof prisma.task.findMany>>;
  watching: Awaited<ReturnType<typeof prisma.task.findMany>>;
};

export async function getInboxTasks(userId: string) {
  const notDoneFilter = { status: { not: "done" as const } };

  const [unassigned, watching] = await Promise.all([
    prisma.task.findMany({
      where: { assigneeId: null, deletedAt: null, parentTaskId: null, ...notDoneFilter },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: INBOX_TASK_INCLUDE,
    }),
    prisma.task.findMany({
      where: {
        watchers: { some: { userId } },
        deletedAt: null,
        parentTaskId: null,
        ...notDoneFilter,
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: INBOX_WATCHING_INCLUDE,
    }),
  ]);

  return { unassigned, watching };
}
