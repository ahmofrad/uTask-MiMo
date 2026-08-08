import { prisma } from "@/lib/db";
import {
  parsePaginationParams,
  buildPaginatedMeta,
  type CursorPaginationParams,
} from "@/lib/db/pagination";
import { getCustomFieldValuesForTask } from "@/lib/custom-fields/values";
import { buildTaskFilters, type TaskFilterParams } from "./filters";
import { getUserReadableProjectIds } from "@/lib/projects/queries";

const ASSIGNEES_INCLUDE = {
  assignees: {
    include: {
      user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
    },
  },
} as const;

const TASK_LIST_INCLUDE = {
  ...ASSIGNEES_INCLUDE,
  reporter: { select: { id: true, displayName: true } },
  tags: { include: { tag: true } },
  _count: { select: { comments: true, attachments: true, subtasks: true } },
} as const;

const TASK_DETAIL_INCLUDE = {
  project: { select: { id: true, name: true } },
  ...ASSIGNEES_INCLUDE,
  reporter: { select: { id: true, displayName: true, email: true } },
  createdBy: { select: { id: true, displayName: true } },
  parentTask: { select: { id: true, title: true } },
  subtasks: {
    where: { deletedAt: null },
    orderBy: { orderIndex: "asc" as const },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      assignees: {
        include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
      },
    },
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
  ...ASSIGNEES_INCLUDE,
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
  const readableProjectIds = await getUserReadableProjectIds(userId);
  const projectScope = readableProjectIds === null ? {} : { projectId: { in: readableProjectIds } };

  const [unassigned, watching] = await Promise.all([
    prisma.task.findMany({
      where: { ...projectScope, assignees: { none: {} }, deletedAt: null, parentTaskId: null, ...notDoneFilter },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: INBOX_TASK_INCLUDE,
    }),
    prisma.task.findMany({
      where: {
        ...projectScope,
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

export type TaskStats = {
  active: number;
  done: number;
  overdue: number;
  dueSoon: number;
};

export async function getTaskStats(userId: string): Promise<TaskStats> {
  const notDone = {
    deletedAt: null,
    assignees: { some: { userId } },
    parentTaskId: null,
    status: { not: "done" as const },
  };
  const now = new Date();
  const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [active, done, overdue, dueSoon] = await Promise.all([
    prisma.task.count({
      where: { ...notDone, status: { in: ["open", "in_progress"] } },
    }),
    prisma.task.count({
      where: { deletedAt: null, assignees: { some: { userId } }, status: "done" },
    }),
    prisma.task.count({
      where: { ...notDone, dueDate: { lt: now } },
    }),
    prisma.task.count({
      where: { ...notDone, dueDate: { gte: now, lte: inSevenDays } },
    }),
  ]);

  return { active, done, overdue, dueSoon };
}

export type UpcomingTask = Awaited<ReturnType<typeof getUpcomingTasks>>[number];

export async function getUpcomingTasks(userId: string, limit = 6) {
  return prisma.task.findMany({
    where: {
      deletedAt: null,
      assignees: { some: { userId } },
      parentTaskId: null,
      status: { not: "done" },
      dueDate: { not: null },
    },
    orderBy: { dueDate: "asc" },
    take: limit,
    include: {
      ...TASK_LIST_INCLUDE,
      project: { select: { id: true, name: true } },
    },
  });
}
