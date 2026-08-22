import { z } from "zod";
import { recurrenceRuleSchema } from "@/lib/tasks/recurrence";

const uuid = z.string().uuid();
const isoDate = z.string().datetime({ offset: true });

export const moveTaskSchema = z.object({
  newParentId: uuid.nullable().optional(),
  position: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const reorderTasksSchema = z.object({
  projectId: uuid,
  taskIds: z.array(uuid).min(2).max(1_000).superRefine((ids, context) => {
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: "custom", message: "taskIds must not contain duplicates" });
    }
  }),
}).strict();

export const dependencyCreateSchema = z.object({
  dependsOnId: uuid,
  type: z.enum(["FINISH_TO_START", "START_TO_START", "FINISH_TO_FINISH", "RELATES_TO"]).optional(),
  lag: z.number().int().min(-100_000).max(100_000).optional(),
  lagUnit: z.enum(["DAY", "HOUR"]).optional(),
}).strict();

export const publicTaskCreateSchema = z.object({
  projectId: uuid,
  title: z.string().trim().min(1).max(500),
  description: z.string().max(100_000).nullable().optional(),
  status: z.enum(["open", "in_progress", "pending_approval", "done", "cancelled"]).optional(),
  priority: z.enum(["low", "med", "high", "urgent"]).optional(),
  startDate: isoDate.nullable().optional(),
  dueDate: isoDate.nullable().optional(),
  assigneeId: uuid.optional(),
  assigneeIds: z.array(uuid).max(100).optional(),
}).strict();

export const publicTaskUpdateSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().max(100_000).nullable().optional(),
  status: z.enum(["open", "in_progress", "pending_approval", "done", "cancelled"]).optional(),
  priority: z.enum(["low", "med", "high", "urgent"]).optional(),
  startDate: isoDate.nullable().optional(),
  dueDate: isoDate.nullable().optional(),
  assigneeId: uuid.nullable().optional(),
  assigneeIds: z.array(uuid).max(100).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const taskCreateSchema = publicTaskCreateSchema.extend({
  parentTaskId: uuid.nullable().optional(),
  assigneeGroupId: uuid.nullable().optional(),
  estimatedHours: z.number().finite().min(0).max(100_000).nullable().optional(),
  progress: z.number().finite().min(0).max(100).optional(),
  requiresApproval: z.boolean().optional(),
  approverId: uuid.nullable().optional(),
  tagIds: z.array(uuid).max(100).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
  recurrence: recurrenceRuleSchema.nullable().optional(),
}).strict();

export const taskUpdateSchema = publicTaskUpdateSchema.extend({
  parentTaskId: uuid.nullable().optional(),
  assigneeGroupId: uuid.nullable().optional(),
  endDate: isoDate.nullable().optional(),
  estimatedHours: z.number().finite().min(0).max(100_000).nullable().optional(),
  spentHours: z.number().finite().min(0).max(100_000).nullable().optional(),
  progress: z.number().finite().min(0).max(100).optional(),
  requiresApproval: z.boolean().optional(),
  approverId: uuid.nullable().optional(),
  deletedAt: isoDate.nullable().optional(),
  tagIds: z.array(uuid).max(100).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
  recurrence: recurrenceRuleSchema.nullable().optional(),
}).strict();

export const approvalDecisionSchema = z
  .object({
    reason: z.string().trim().max(10_000).optional(),
  })
  .strict();

export const subtaskCreateSchema = z.object({
  title: z.string().trim().min(1).max(500),
}).strict();

export const subtaskUpdateSchema = z.object({
  status: z.enum(["open", "in_progress", "pending_approval", "done", "cancelled"]).optional(),
  title: z.string().trim().min(1).max(500).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const bulkCustomFieldUpdateSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1).max(200),
  projectId: z.string().uuid(),
  customFields: z.record(z.string(), z.unknown()),
}).strict();

export const customFieldFilterClauseSchema = z.object({
  key: z.string().min(1).max(255),
  operator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "in", "contains", "array_contains"]),
  value: z.union([z.string(), z.number(), z.boolean()]),
}).strict();

export const customFieldFilterListSchema = z.array(customFieldFilterClauseSchema).max(10);

const projectIdList = z.array(uuid).min(1).max(200).superRefine((ids, context) => {
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", message: "projectIds must not contain duplicates" });
  }
});

export const ganttBatchQuerySchema = z.object({
  projectIds: z.string().trim().min(1)
    .transform((value) => value.split(",").map((id) => id.trim()))
    .pipe(projectIdList),
  include: z.string().optional(),
}).strict();