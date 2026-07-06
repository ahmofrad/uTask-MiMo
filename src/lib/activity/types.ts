export interface AuditEvent {
  type: "audit";
  id: string;
  action: string;
  actorId: string | null;
  actorName: string;
  createdAt: string;
  details?: { before?: unknown; after?: unknown } | null;
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
