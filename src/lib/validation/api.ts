import { z } from "zod";

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
  status: z.enum(["open", "in_progress", "done", "cancelled"]).optional(),
  priority: z.enum(["low", "med", "high", "urgent"]).optional(),
  startDate: isoDate.nullable().optional(),
  dueDate: isoDate.nullable().optional(),
  assigneeId: uuid.optional(),
  assigneeIds: z.array(uuid).max(100).optional(),
}).strict();

export const publicTaskUpdateSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().max(100_000).nullable().optional(),
  status: z.enum(["open", "in_progress", "done", "cancelled"]).optional(),
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
  tagIds: z.array(uuid).max(100).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
}).strict();

export const taskUpdateSchema = publicTaskUpdateSchema.extend({
  parentTaskId: uuid.nullable().optional(),
  assigneeGroupId: uuid.nullable().optional(),
  endDate: isoDate.nullable().optional(),
  estimatedHours: z.number().finite().min(0).max(100_000).nullable().optional(),
  spentHours: z.number().finite().min(0).max(100_000).nullable().optional(),
  progress: z.number().finite().min(0).max(100).optional(),
  deletedAt: isoDate.nullable().optional(),
  tagIds: z.array(uuid).max(100).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
}).strict();

export const publicCommentCreateSchema = z.object({
  bodyMarkdown: z.string().trim().min(1).max(100_000),
}).strict();

export const commentCreateSchema = publicCommentCreateSchema.extend({
  parentCommentId: uuid.nullable().optional(),
}).strict();

export const commentUpdateSchema = z.object({
  bodyMarkdown: z.string().trim().min(1).max(100_000),
}).strict();

export const publicProjectCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().max(100_000).nullable().optional(),
  color: z.string().trim().min(1).max(64).optional(),
  visibility: z.enum(["private", "department", "org"]).optional(),
}).strict();

export const projectCreateSchema = publicProjectCreateSchema.extend({
  departmentId: uuid.nullable().optional(),
  departmentIds: z.array(uuid).min(1).max(100).optional(),
}).strict();

export const projectUpdateSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().max(100_000).nullable().optional(),
  color: z.string().trim().min(1).max(64).optional(),
  status: z.enum(["active", "archived"]).optional(),
  visibility: z.enum(["private", "department", "org"]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");

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

export const departmentCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  parentId: uuid.nullable().optional(),
  managerUserId: uuid.nullable().optional(),
}).strict();

export const departmentUpdateSchema = departmentCreateSchema.partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const subtaskCreateSchema = z.object({
  title: z.string().trim().min(1).max(500),
}).strict();

export const subtaskUpdateSchema = z.object({
  status: z.enum(["open", "in_progress", "done", "cancelled"]).optional(),
  title: z.string().trim().min(1).max(500).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const tagCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  color: z.string().trim().min(1).max(64).optional(),
  projectId: uuid.optional(),
}).strict();

export const tagUpdateSchema = tagCreateSchema.pick({ name: true, color: true })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const userCreateSchema = z.object({
  email: z.string().trim().email().max(320),
  displayName: z.string().trim().min(1).max(255),
  password: z.string().min(8).max(128).optional(),
  role: z.enum(["owner", "admin", "manager", "member", "guest"]).optional(),
}).strict();

export const userRoleUpdateSchema = z.object({
  role: z.enum(["owner", "admin", "manager", "member", "guest"]),
}).strict();

export const userUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(255).optional(),
  locale: z.enum(["fa_IR", "en_US"]).optional(),
  accentColor: z.string().trim().min(1).max(64).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  density: z.enum(["compact", "comfortable", "spacious"]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const projectMemberCreateSchema = z.object({
  userId: uuid,
  projectRole: z.enum(["lead", "contributor", "viewer"]).optional(),
}).strict();

export const projectMemberUpdateSchema = z.object({
  projectRole: z.enum(["lead", "contributor", "viewer"]),
}).strict();

export const projectDepartmentLinkRequestSchema = z.object({
  departmentId: uuid,
}).strict();

export const projectDepartmentLinkDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected", "cancelled"]),
}).strict();

const patchUrlSchema = z.union([z.literal(""), z.string().url()]);

export const ldapSourceCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  enabled: z.boolean().default(false),
  url: z.string().url(),
  bindUpn: z.string().trim().min(1).max(255),
  bindPassword: z.string().min(1).max(512),
  upnSuffix: z.string().trim().max(255).optional(),
  searchBase: z.string().trim().max(512).optional(),
  emailAttribute: z.string().trim().max(64).default("mail"),
  nameAttribute: z.string().trim().max(64).default("cn"),
  defaultRole: z.string().trim().max(64).default("member"),
  syncIntervalHours: z.number().int().min(1).max(744).default(12),
  tlsCaCert: z.string().max(16_384).optional(),
}).strict();

export const ldapSourceUpdateSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  enabled: z.boolean().optional(),
  url: patchUrlSchema.optional(),
  bindUpn: z.string().trim().min(1).max(255).optional(),
  // "" keeps the existing password; anything else replaces it.
  bindPassword: z.string().max(512).optional(),
  upnSuffix: z.union([z.literal(""), z.string().trim().max(255)]).optional(),
  searchBase: z.union([z.literal(""), z.string().trim().max(512)]).optional(),
  emailAttribute: z.string().trim().max(64).optional(),
  nameAttribute: z.string().trim().max(64).optional(),
  defaultRole: z.string().trim().max(64).optional(),
  syncIntervalHours: z.number().int().min(1).max(744).optional(),
  tlsCaCert: z.union([z.literal(""), z.string().max(16_384)]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const ldapSettingsUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  url: patchUrlSchema.optional(),
  bindUpn: z.string().optional(),
  bindPassword: z.string().optional(),
  upnSuffix: z.string().optional(),
  emailAttribute: z.string().optional(),
  nameAttribute: z.string().optional(),
  defaultRole: z.string().optional(),
  syncIntervalHours: z.number().int().min(1).max(744).optional(),
  tlsCaCert: z.string().optional(),
}).strict();
export const samlSettingsUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  entityId: patchUrlSchema.optional(),
  acsUrl: patchUrlSchema.optional(),
  sloUrl: patchUrlSchema.optional(),
  idpMetadataUrl: patchUrlSchema.optional(),
  idpEntityId: z.string().optional(),
  idpSsoUrl: patchUrlSchema.optional(),
  idpCertificate: z.string().optional(),
  nameIdFormat: z.string().optional(),
  attributeMap: z.object({
    email: z.string().optional(),
    displayName: z.string().optional(),
    role: z.string().optional(),
  }).strict().optional(),
  defaultRole: z.string().optional(),
  adminRoleValue: z.string().optional(),
  wantAssertionsSigned: z.boolean().optional(),
  wantResponseSigned: z.boolean().optional(),
  signatureAlgorithm: z.string().optional(),
  digestAlgorithm: z.string().optional(),
}).strict();
export const ssoSettingsUpdateSchema = z.object({
  ldap: ldapSettingsUpdateSchema.optional(),
  saml: samlSettingsUpdateSchema.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const ldapGroupSchema = z.object({
  dn: z.string().trim().min(1).max(2_048),
  name: z.string().trim().min(1).max(255),
}).strict();

export const groupCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  ownerDepartmentId: uuid.nullable().optional(),
}).strict();

export const groupUpdateSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  ownerDepartmentId: uuid.nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const groupMemberAddSchema = z.object({
  userId: uuid,
}).strict();

export const projectGroupGrantSchema = z.object({
  groupId: uuid,
  role: z.enum(["lead", "contributor", "viewer"]).optional(),
}).strict();

export const ldapLoginSchema = z.object({
  username: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(512),
  // Optional directory to authenticate against; omitted for legacy single-source clients.
  sourceId: uuid.optional(),
}).strict();

export const passwordResetRequestSchema = z.object({
  email: z.string().trim().email().max(320),
}).strict();

export const emailTemplatesSchema = z.object({
  // Blank subject/text intentionally allowed: a blank override keeps the default.
  invite_subject: z.string().trim().max(200),
  invite_text: z.string().trim().max(4000),
  invite_html: z.string().trim().max(8000).optional(),
  reset_subject: z.string().trim().max(200),
  reset_text: z.string().trim().max(4000),
  reset_html: z.string().trim().max(8000).optional(),
}).strict();

export const sendTestEmailSchema = z.object({
  key: z.enum(["invite", "reset"]),
  to: z.string().trim().email().max(320),
}).strict();

export const customFieldFilterClauseSchema = z.object({
  key: z.string().min(1).max(255),
  operator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "in", "contains", "array_contains"]),
  value: z.union([z.string(), z.number(), z.boolean()]),
}).strict();

export const customFieldFilterListSchema = z.array(customFieldFilterClauseSchema).max(10);

export const bulkCustomFieldUpdateSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1).max(200),
  projectId: z.string().uuid(),
  customFields: z.record(z.string(), z.unknown()),
}).strict();

export const inviteAcceptSchema = z.object({
  displayName: z.string().trim().min(1).max(100),
  password: z.string().min(12).max(128),
}).strict();

export const passwordResetSchema = z.object({
  token: z.string().trim().min(32).max(256),
  password: z.string().min(12).max(128),
  confirmPassword: z.string().min(12).max(128),
}).strict().refine((value) => value.password === value.confirmPassword, {
  message: "passwordMismatch",
  path: ["confirmPassword"],
});

const smtpPortSchema = z.union([
  z.number().int().min(1).max(65_535),
  z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(65_535)),
]);

export const smtpSettingsSchema = z.object({
  smtp_host: z.string().trim().min(1).max(255).optional(),
  smtp_port: smtpPortSchema.optional(),
  smtp_user: z.string().max(320).optional(),
  smtp_pass: z.string().max(512).optional(),
  smtp_from: z.string().email().max(320).optional(),
  smtp_secure: z.union([z.boolean(), z.enum(["true", "false"])]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const smtpSettingsTestSchema = z.union([smtpSettingsSchema, z.object({}).strict()]);

export const storageSettingsSchema = z.object({
  endpoint: z.string().url().max(2048).optional(),
  accessKey: z.string().max(255).optional(),
  secretKey: z.string().max(512).optional(),
  bucket: z.string().trim().min(1).max(255).optional(),
  region: z.string().trim().min(1).max(100).optional(),
  useSSL: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const attachmentUpdateSchema = z.object({
  name: z.string().trim().min(1).max(255),
}).strict();

export const publicWebhookCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  url: z.string().url().max(2048),
  events: z.array(z.string().trim().min(1).max(100)).min(1).max(50),
}).strict();

export const publicWebhookUpdateSchema = publicWebhookCreateSchema.partial().extend({
  active: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const publicTokenCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  scopes: z.array(z.string().trim().min(1)).min(1).max(20),
  expiresAt: isoDate.nullable().optional(),
}).strict();

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
