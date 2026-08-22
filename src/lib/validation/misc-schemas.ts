import { z } from "zod";

const uuid = z.string().uuid();
const isoDate = z.string().datetime({ offset: true });

export const publicCommentCreateSchema = z.object({
  bodyMarkdown: z.string().trim().min(1).max(100_000),
}).strict();

export const commentCreateSchema = publicCommentCreateSchema.extend({
  parentCommentId: uuid.nullable().optional(),
}).strict();

export const commentUpdateSchema = z.object({
  bodyMarkdown: z.string().trim().min(1).max(100_000),
}).strict();

export const tagCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  color: z.string().trim().min(1).max(64).optional(),
  projectId: uuid.optional(),
}).strict();

export const tagUpdateSchema = tagCreateSchema.pick({ name: true, color: true })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const publicWebhookCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  url: z.string().url().max(2048),
  events: z.array(z.string().trim().min(1).max(100)).min(1).max(50),
}).strict();

export const publicWebhookUpdateSchema = publicWebhookCreateSchema.partial().extend({
  active: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const rateCardCreateSchema = z.object({
  scope: z.enum(["user", "role"]),
  userId: uuid.nullable().optional(),
  roleType: z.enum(["owner", "admin", "manager", "member", "guest"]).nullable().optional(),
  costRateMinor: z.number().int().min(0).max(1_000_000_000),
  billRateMinor: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  currency: z.string().trim().length(3).default("USD"),
  effectiveFrom: isoDate,
  effectiveTo: isoDate.nullable().optional(),
}).strict().superRefine((value, context) => {
  if (value.scope === "user" && !value.userId) {
    context.addIssue({ code: "custom", message: "userId is required for user scope", path: ["userId"] });
  }
  if (value.scope === "role" && !value.roleType) {
    context.addIssue({ code: "custom", message: "roleType is required for role scope", path: ["roleType"] });
  }
});

export const timesheetPeriodCreateSchema = z.object({
  periodStart: isoDate,
  periodEnd: isoDate,
}).strict().refine((value) => new Date(value.periodStart) < new Date(value.periodEnd), {
  message: "periodEnd must be after periodStart",
  path: ["periodEnd"],
});

export const timeEntryCreateSchema = z.object({
  projectId: uuid,
  taskId: uuid.nullable().optional(),
  minutes: z.number().int().min(1).max(43_200),
  billable: z.boolean().default(true),
}).strict();

export const emailTemplatesSchema = z.object({
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