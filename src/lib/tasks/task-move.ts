import { prisma } from "@/lib/db";
import {
  computeSiblingOrderIndex,
  loadProjectParentMaps,
  ancestorDepth,
  subtreeMaxRelativeDepth,
  hasCycle,
  MAX_WBS_DEPTH,
  WbsGuardError,
} from "@/lib/tasks/wbs";

export async function reorderTasks(projectId: string, taskIds: string[]) {
  if (new Set(taskIds).size !== taskIds.length) {
    throw new WbsGuardError("TASK_SCOPE", "A task may only appear once in a reorder request");
  }
  const scopedTasks = await prisma.task.findMany({
    where: { id: { in: taskIds }, projectId, deletedAt: null },
    select: { id: true },
  });
  if (scopedTasks.length !== taskIds.length) {
    throw new WbsGuardError("TASK_SCOPE", "All reordered tasks must belong to the active project");
  }

  // Use the caller's intended order from the input array, not DB order
  const updates = taskIds.map((id, i) =>
    prisma.task.update({
      where: { id, projectId },
      data: { orderIndex: (i + 1) * 1000 },
    }),
  );

  await prisma.$transaction(updates);
}

export type MoveTaskData = {
  newParentId?: string | null;
  position?: number;
};

export async function moveTask(id: string, data: MoveTaskData) {
  const task = await prisma.task.findUnique({
    where: { id },
    select: { id: true, projectId: true, parentTaskId: true, deletedAt: true },
  });
  if (!task || task.deletedAt) {
    throw new Error("Task not found");
  }

  const newParentId = data.newParentId === undefined ? task.parentTaskId : data.newParentId;
  const position = data.position ?? Number.MAX_SAFE_INTEGER;

  if (newParentId === id) {
    throw new WbsGuardError("SELF_PARENT", "A task cannot be its own parent");
  }

  if (newParentId != null) {
    const newParent = await prisma.task.findUnique({
      where: { id: newParentId },
      select: { id: true, projectId: true, deletedAt: true },
    });
    if (!newParent || newParent.deletedAt) {
      throw new WbsGuardError("PARENT_DELETED", "Target parent task is deleted or does not exist");
    }
    if (newParent.projectId !== task.projectId) {
      throw new WbsGuardError("CROSS_PROJECT", "Target parent belongs to another project");
    }
  }

  const maps = await loadProjectParentMaps(task.projectId);

  if (hasCycle(maps, id, newParentId)) {
    throw new WbsGuardError("CYCLE", "Moving here would create a cycle");
  }

  if (newParentId != null) {
    const newDepth = ancestorDepth(maps, newParentId) + 1;
    const subtreeDepth = subtreeMaxRelativeDepth(maps.childrenMap, id);
    if (newDepth + subtreeDepth > MAX_WBS_DEPTH) {
      throw new WbsGuardError("MAX_DEPTH", `WBS depth exceeds the maximum of ${MAX_WBS_DEPTH} levels`);
    }
  }

  const orderIndex = await computeSiblingOrderIndex(task.projectId, newParentId, position);

  const before = await prisma.task.findUnique({ where: { id } });

  const updated = await prisma.task.update({
    where: { id },
    data: { parentTaskId: newParentId, orderIndex },
  });

  return { before, task: updated };
}