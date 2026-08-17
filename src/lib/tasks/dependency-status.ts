export type PredecessorInfo = {
  id: string;
  title: string;
  status: string;
  startDate: string | null;
  dueDate: string | null;
};

export type TaskDependencyStatus = {
  blockedBy: PredecessorInfo[];
};

/**
 * A dependency link is invalid when the task starts before one of its
 * incomplete predecessors finishes (the predecessor's end overlaps the
 * dependent's start).
 */
export function hasInvalidLink(
  taskStartDate: string | null,
  blockedBy: PredecessorInfo[],
): boolean {
  if (!taskStartDate) return false;
  const start = new Date(taskStartDate).getTime();
  return blockedBy.some((predecessor) => {
    if (!predecessor.dueDate) return false;
    return new Date(predecessor.dueDate).getTime() > start;
  });
}
