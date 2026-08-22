import { z } from "zod";

const uuid = z.string().uuid();

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

export const departmentCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  parentId: uuid.nullable().optional(),
  managerUserId: uuid.nullable().optional(),
}).strict();

export const departmentUpdateSchema = departmentCreateSchema.partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

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

export const projectGroupGrantSchema = z.object({
  groupId: uuid,
  role: z.enum(["lead", "contributor", "viewer"]).optional(),
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