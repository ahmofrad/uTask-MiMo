import type { ActivityEvent } from "@/lib/activity/types";

export type TaskData = {
  id: string;
  title: string;
  description?: string | null;
  status: "open" | "in_progress" | "pending_approval" | "done" | "cancelled";
  priority: "low" | "med" | "high" | "urgent";
  startDate: string | null;
  endDate: string | null;
  dueDate: string | null;
  estimatedHours?: number | null;
  spentHours?: number | null;
  requiresApproval?: boolean;
  approverId?: string | null;
  approvalNote?: string | null;
  recurrenceRule?: string | null;
  recurrenceParentId?: string | null;
  projectId: string;
  projectName: string;
  assignees: { id: string; displayName: string; avatarUrl?: string | null }[];
  assigneeGroup: { id: string; name: string } | null;
  reporter: { id: string; displayName: string } | null;
  tags: { id: string; name: string }[];
  subtasks: { id: string; title: string; status: string; priority: string; assignees: { id: string; displayName: string; avatarUrl?: string | null }[] }[];
  createdAt: string;
  updatedAt: string;
};

export type CustomFieldDef = {
  id: string;
  key: string;
  name: string;
  type: "text" | "number" | "date" | "select" | "multi_select" | "user" | "checkbox" | "url";
  required: boolean;
  config: Record<string, unknown>;
};

export type CommentData = {
  id: string;
  body: string;
  createdAt: string;
  authorId?: string | undefined;
  author: { displayName: string; avatarUrl?: string | null };
  replies?: { id: string; body: string; createdAt: string; author: { displayName: string; avatarUrl?: string | null } }[];
};

export type WatcherData = {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  addedAt: string;
};

export type AttachmentData = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type ProjectMember = {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
};

export type AutoScheduledChange = {
  id: string;
  title: string;
  startDate: string | null;
  dueDate: string | null;
};

export type ToastLike = {
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
};

export type TranslateFn = (_key: string, _values?: Record<string, string | number | Date>) => string;

export type UseTaskMutationsOptions = {
  initialTask: TaskData;
  initialComments: CommentData[];
  initialWatchers: WatcherData[];
  initialAttachments: AttachmentData[];
  initialSubtasks: TaskData["subtasks"];
  initialCFValues: Record<string, unknown>;
  initialTagIds: string[];
  projectMembers: ProjectMember[];
  currentUserId: string;
  /** Refresh the task activity timeline after a mutation. */
  onAuditRefresh: () => Promise<void>;
  addToast: (_toast: ToastLike) => void;
  t: TranslateFn;
};

export type ActivityEventForTask = ActivityEvent;