import type { z } from "zod";

export {
  moveTaskSchema,
  reorderTasksSchema,
  dependencyCreateSchema,
  publicTaskCreateSchema,
  publicTaskUpdateSchema,
  taskCreateSchema,
  taskUpdateSchema,
  approvalDecisionSchema,
  subtaskCreateSchema,
  subtaskUpdateSchema,
  bulkCustomFieldUpdateSchema,
  customFieldFilterClauseSchema,
  customFieldFilterListSchema,
  ganttBatchQuerySchema,
} from "./task-schemas";

export {
  publicProjectCreateSchema,
  projectCreateSchema,
  projectUpdateSchema,
  departmentCreateSchema,
  departmentUpdateSchema,
  projectMemberCreateSchema,
  projectMemberUpdateSchema,
  projectDepartmentLinkRequestSchema,
  projectDepartmentLinkDecisionSchema,
  projectGroupGrantSchema,
  groupCreateSchema,
  groupUpdateSchema,
  groupMemberAddSchema,
} from "./project-schemas";

export {
  userCreateSchema,
  userRoleUpdateSchema,
  userUpdateSchema,
  inviteAcceptSchema,
  passwordResetSchema,
  passwordResetRequestSchema,
  publicTokenCreateSchema,
  ldapSourceCreateSchema,
  ldapSourceUpdateSchema,
  ldapLoginSchema,
  ldapGroupSchema,
  ldapSettingsUpdateSchema,
  samlSettingsUpdateSchema,
  ssoSettingsUpdateSchema,
} from "./auth-schemas";

export {
  publicCommentCreateSchema,
  commentCreateSchema,
  commentUpdateSchema,
  tagCreateSchema,
  tagUpdateSchema,
  publicWebhookCreateSchema,
  publicWebhookUpdateSchema,
  rateCardCreateSchema,
  timesheetPeriodCreateSchema,
  timeEntryCreateSchema,
  emailTemplatesSchema,
  sendTestEmailSchema,
  smtpSettingsSchema,
  smtpSettingsTestSchema,
  storageSettingsSchema,
  attachmentUpdateSchema,
} from "./misc-schemas";

export function validationError(error: z.ZodError) {
  return {
    error: {
      code: "VALIDATION_ERROR",
      message: "Request validation failed",
      field: error.issues[0]?.path.join(".") || undefined,
    },
  };
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}