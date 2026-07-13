import { z } from "zod";

export const ErrorResponse = z.object({
  error: z.object({
    code: z.string().describe("Machine-readable error code"),
    message: z.string().describe("Human-readable error message"),
    field: z.string().optional().describe("Field that caused the error, if applicable"),
  }),
});

export const CursorPagination = z.object({
  data: z.array(z.unknown()),
  nextCursor: z.string().nullable().describe("Cursor for the next page, null if no more"),
});

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  status: z.enum(["active", "suspended"]),
  locale: z.string(),
  createdAt: z.string().datetime(),
});

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  visibility: z.enum(["private", "department", "org"]),
  status: z.enum(["active", "archived"]),
  ownerId: z.string().uuid(),
  createdAt: z.string().datetime(),
});

export const TaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.enum(["open", "in_progress", "done", "cancelled"]),
  priority: z.enum(["low", "med", "high", "urgent"]),
  projectId: z.string().uuid(),
  assigneeIds: z.array(z.string().uuid()),
  dueDate: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const CommentSchema = z.object({
  id: z.string().uuid(),
  bodyMarkdown: z.string(),
  authorId: z.string().uuid(),
  taskId: z.string().uuid(),
  parentCommentId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
});

export const TokenSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  prefix: z.string(),
  scopes: z.array(z.string()),
  createdAt: z.string().datetime(),
  lastUsedAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
});

export const WebhookSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  url: z.string().url(),
  events: z.array(z.string()),
  active: z.boolean(),
  createdAt: z.string().datetime(),
});
