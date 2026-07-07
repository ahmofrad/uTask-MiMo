import type { AuditAction } from "@prisma/client";

export interface AuditEvent {
  type: "audit";
  id: string;
  action: AuditAction;
  actorId: string | null;
  actorName: string;
  createdAt: string;
  details?: { before?: unknown; after?: unknown } | null | undefined;
}

export interface CommentEvent {
  type: "comment";
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  parentCommentId: string | null;
}

export type ActivityEvent = AuditEvent | CommentEvent;
