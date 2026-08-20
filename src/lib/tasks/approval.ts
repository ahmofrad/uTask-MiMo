import { canProject } from "@/lib/rbac";

/**
 * Task approval gate (roadmap G15b): a DONE transition on a task that requires
 * approval reroutes to PENDING_APPROVAL unless the actor is a "finalizer" —
 * the designated approver, or anyone with project task:edit_any (project lead,
 * department manager, global admin/owner). Approve/reject are also gated to
 * finalizers.
 */

export type ApprovalSubject = {
  projectId: string;
  approverId: string | null;
};

/** Whether the user may finalize (approve/reject, or bypass the gate). */
export async function isTaskFinalizer(userId: string, task: ApprovalSubject): Promise<boolean> {
  if (task.approverId && task.approverId === userId) return true;
  return canProject(userId, "task:edit_any", task.projectId);
}

/**
 * Pure decision for the DONE-transition reroute. Extracted so the gate logic
 * is unit-testable without a database.
 */
export function shouldRouteToApproval(opts: {
  requiresApproval: boolean;
  requestedStatus: string;
  actorIsFinalizer: boolean;
}): boolean {
  return opts.requiresApproval && opts.requestedStatus === "done" && !opts.actorIsFinalizer;
}

/** Thrown when approve/reject is attempted on a task not awaiting approval. */
export class TaskNotPendingApprovalError extends Error {
  constructor() {
    super("Task is not awaiting approval");
    this.name = "TaskNotPendingApprovalError";
  }
}
