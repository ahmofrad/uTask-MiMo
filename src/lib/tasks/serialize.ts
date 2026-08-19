export type AssigneeUser = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

type AssigneeRow = { user: { id: string; displayName: string; avatarUrl: string | null } };

export function mapAssignees(rows: AssigneeRow[] | undefined | null): AssigneeUser[] {
  if (!rows) return [];
  return rows.map((r) => ({
    id: r.user.id,
    displayName: r.user.displayName,
    avatarUrl: r.user.avatarUrl ?? null,
  }));
}

/** Shape the board and task-list views render; a superset of the API row. */
export type TaskCardListRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  startDate: string | null;
  assignees: AssigneeUser[];
  tags: { id: string; name: string }[];
  subtaskCount: number;
  subtaskDone: number;
};

/**
 * Map a `/api/v1/tasks` list row onto the TaskCard shape shared by the board
 * and task-list views. Kept here so both views (and their realtime refetches)
 * agree on the same mapping.
 */
export function mapTaskListRow(raw: Record<string, unknown>): TaskCardListRow {
  const assignees =
    (raw.assignees as { id: string; displayName: string; avatarUrl?: string | null }[] | undefined) ?? [];
  const tags =
    (raw.tags as { tag: { id: string; name: string; color?: string | null } }[] | undefined) ?? [];
  const count = (raw._count as { subtasks?: number } | undefined) ?? {};
  return {
    id: String(raw.id),
    title: String(raw.title),
    description: (raw.description as string | null) ?? null,
    status: String(raw.status),
    priority: String(raw.priority),
    dueDate: (raw.dueDate as string | null) ?? null,
    startDate: (raw.startDate as string | null) ?? null,
    assignees: assignees.map((a) => ({ id: a.id, displayName: a.displayName, avatarUrl: a.avatarUrl ?? null })),
    tags: tags.map((tt) => ({ id: tt.tag.id, name: tt.tag.name })),
    subtaskCount: count.subtasks ?? 0,
    subtaskDone: 0,
  };
}
