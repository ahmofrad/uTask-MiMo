"use client";

import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/avatar";
import { apiFetch } from "@/lib/api-fetch";

type Member = {
  userId: string;
  projectRole: string;
  addedAt: string;
  user: { id: string; displayName: string; email: string; avatarUrl: string | null };
};

type MemberListProps = {
  members: Member[];
  loading: boolean;
  roles: { value: string; label: string }[];
  projectId: string;
  onRoleChanged: (_userId: string, _newRole: string) => void;
  onMemberRemoved: (_userId: string) => void;
};

export function MemberList({
  members,
  loading,
  roles,
  projectId,
  onRoleChanged,
  onMemberRemoved,
}: MemberListProps) {
  const t = useTranslations("project.members");

  async function changeRole(userId: string, newRole: string) {
    const res = await apiFetch(`/api/v1/admin/projects/${projectId}/members/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ projectRole: newRole }),
    });
    if (res.ok) {
      onRoleChanged(userId, newRole);
    }
  }

  async function removeMember(userId: string) {
    const res = await apiFetch(`/api/v1/projects/${projectId}/members/${userId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      onMemberRemoved(userId);
    }
  }

  if (loading) {
    return <p className="text-sm text-fg-muted text-center py-4">{t("loading")}</p>;
  }

  if (members.length === 0) {
    return <p className="text-sm text-fg-muted text-center py-8">{t("noMembers")}</p>;
  }

  return (
    <>
      {members.map((member) => (
        <div
          key={member.userId}
          className="flex items-center gap-3 p-3 rounded-lg border border-border-secondary hover:bg-bg-secondary/50 transition-colors"
        >
          <Avatar
            initials={member.user.displayName?.slice(0, 2).toUpperCase() ?? "?"}
            imageUrl={member.user.avatarUrl}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-fg-primary truncate">{member.user.displayName}</p>
            <p className="text-xs text-fg-muted truncate">{member.user.email}</p>
          </div>
          <select
            value={member.projectRole}
            onChange={(e) => changeRole(member.userId, e.target.value)}
            className="text-xs px-2 py-1 border border-border-primary rounded-lg bg-bg-primary text-fg-primary focus:outline-none focus:ring-1 focus:ring-accent shrink-0"
          >
            {roles.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <button
            onClick={() => removeMember(member.userId)}
            className="text-xs text-fg-muted hover:text-destructive transition-colors shrink-0"
          >
            {t("remove")}
          </button>
        </div>
      ))}
    </>
  );
}
