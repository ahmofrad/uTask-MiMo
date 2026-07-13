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
