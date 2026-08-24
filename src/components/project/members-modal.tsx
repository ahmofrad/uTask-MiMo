"use client";

import { memo, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-fetch";
import { MemberInviteForm } from "./member-invite-form";
import { MemberList } from "./member-list";
import { GroupGrantsPanel, type GroupOption } from "./group-grants-panel";

type Member = {
  userId: string;
  projectRole: string;
  addedAt: string;
  user: { id: string; displayName: string; email: string; avatarUrl: string | null };
};

type UserSearchResult = {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
};

type GroupGrant = {
  groupId: string;
  role: string;
  grantedAt: string;
  memberCount: number;
  group: { id: string; name: string; source: "ldap" | "manual" };
};

export const MembersModal = memo(function MembersModal({
  open,
  onClose,
  projectId,
  canAssignRoles,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  canAssignRoles: boolean;
}) {
  const t = useTranslations("project.members");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const [grants, setGrants] = useState<GroupGrant[]>([]);
  const [groupOptions, setGroupOptions] = useState<GroupOption[]>([]);
  const [grantsLoading, setGrantsLoading] = useState(false);
  const [grantGroupId, setGrantGroupId] = useState("");
  const [grantRole, setGrantRole] = useState("contributor");
  const [granting, setGranting] = useState(false);

  const ROLES = [
    { value: "lead", label: t("lead") },
    { value: "contributor", label: t("contributor") },
    { value: "viewer", label: t("viewer") },
  ];

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    apiFetch(`/api/v1/projects/${projectId}/members`)
      .then((r) => r.json())
      .then((j) => { setMembers(j.data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [open, projectId]);

  useEffect(() => {
    if (!open) return;
    setGrantsLoading(true);
    apiFetch(`/api/v1/projects/${projectId}/group-grants`)
      .then(async (r) => {
        if (!r.ok) return;
        const j = await r.json();
        setGrants(j.data ?? []);
        setGroupOptions((j.groups ?? []).filter(
          (g: GroupOption) => !(j.data ?? []).some((grant: GroupGrant) => grant.groupId === g.id),
        ));
      })
      .catch(() => {})
      .finally(() => setGrantsLoading(false));
  }, [open, projectId]);

  function handleMemberAdded(user: UserSearchResult, role: string) {
    setMembers((prev) => [
      ...prev,
      { userId: user.id, projectRole: role, addedAt: new Date().toISOString(), user },
    ]);
  }

  function handleRoleChanged(userId: string, newRole: string) {
    setMembers((prev) => prev.map((m) => m.userId === userId ? { ...m, projectRole: newRole } : m));
  }

  function handleMemberRemoved(userId: string) {
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
  }

  async function grantAccess() {
    if (!grantGroupId || granting) return;
    setGranting(true);
    try {
      const res = await apiFetch(`/api/v1/projects/${projectId}/group-grants`, {
        method: "POST",
        body: JSON.stringify({ groupId: grantGroupId, role: grantRole }),
      });
      if (res.ok) {
        const selected = groupOptions.find((g) => g.id === grantGroupId);
        if (selected) {
          setGrants((prev) => [...prev, {
            groupId: selected.id,
            role: grantRole,
            grantedAt: new Date().toISOString(),
            memberCount: selected.memberCount,
            group: { id: selected.id, name: selected.name, source: selected.source },
          }]);
        }
        setGroupOptions((prev) => prev.filter((g) => g.id !== grantGroupId));
        setGrantGroupId("");
        setGrantRole("contributor");
      }
    } finally {
      setGranting(false);
    }
  }

  async function changeGrantRole(groupId: string, newRole: string) {
    const res = await apiFetch(`/api/v1/projects/${projectId}/group-grants`, {
      method: "POST",
      body: JSON.stringify({ groupId, role: newRole }),
    });
    if (res.ok) {
      setGrants((prev) => prev.map((g) => g.groupId === groupId ? { ...g, role: newRole } : g));
    }
  }

  async function revokeGrant(groupId: string) {
    const res = await apiFetch(`/api/v1/projects/${projectId}/group-grants/${groupId}`, { method: "DELETE" });
    if (res.ok) {
      setGrants((prev) => prev.filter((g) => g.groupId !== groupId));
      const revoked = grants.find((g) => g.groupId === groupId);
      if (revoked) {
        setGroupOptions((prev) => [...prev, {
          id: revoked.groupId,
          name: revoked.group.name,
          source: revoked.group.source,
          memberCount: revoked.memberCount,
        }]);
      }
    }
  }

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} title={t("title")} className="max-w-lg flex flex-col max-h-[80vh] p-0">
      <MemberInviteForm
        projectId={projectId}
        roles={ROLES}
        defaultRole="contributor"
        onMemberAdded={handleMemberAdded}
      />

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
        <MemberList
          members={members}
          loading={loading}
          roles={ROLES}
          projectId={projectId}
          onRoleChanged={handleRoleChanged}
          onMemberRemoved={handleMemberRemoved}
        />

        <GroupGrantsPanel
          grants={grants}
          groupOptions={groupOptions}
          roles={ROLES}
          canAssignRoles={canAssignRoles}
          loading={grantsLoading}
          groupId={grantGroupId}
          role={grantRole}
          granting={granting}
          onGroupChange={setGrantGroupId}
          onRoleChange={setGrantRole}
          onGrant={() => void grantAccess()}
          onChangeGrantRole={(groupId, role) => void changeGrantRole(groupId, role)}
          onRevoke={(groupId) => void revokeGrant(groupId)}
        />
      </div>
    </Dialog>
  );
});
