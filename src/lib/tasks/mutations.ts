/**
 * Task mutation entry point.
 *
 * The implementations live in focused modules so each concern stays small:
 * - task-create.ts   — createTask
 * - task-update.ts   — updateTask
 * - task-delete.ts   — deleteTask
 * - task-move.ts     — reorderTasks / moveTask
 * - approval-mutations.ts — approveTask / rejectTask / spawnNextRecurrence
 *
 * This barrel re-exports everything for backward compatibility.
 */

export { createTask, type CreateTaskData } from "@/lib/tasks/task-create";
export { updateTask, type UpdateTaskData } from "@/lib/tasks/task-update";
export { deleteTask } from "@/lib/tasks/task-delete";
export { reorderTasks, moveTask, type MoveTaskData } from "@/lib/tasks/task-move";
export { approveTask, rejectTask } from "@/lib/tasks/approval-mutations";