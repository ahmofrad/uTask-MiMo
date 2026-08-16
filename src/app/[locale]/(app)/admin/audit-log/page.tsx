import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { can } from "@/lib/rbac/can";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { isGroupAccessAction } from "@/lib/audit-log";

const GROUP_ACCESS_ACTIONS = [
  "group_grant_created",
  "group_grant_revoked",
  "group_member_added",
  "group_member_removed",
] as const;

const INVITE_ACTIONS = ["invite_sent", "invite_accepted"] as const;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ groupAccess?: string; invites?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const allowed = await can(session.user.id, "audit:view");
  if (!allowed) redirect("/");

  const t = await getTranslations("audit");
  const { groupAccess, invites } = await searchParams;
  const showGroupAccess = groupAccess === "true";
  const showInvites = invites === "true";

  const logs = await prisma.auditLog.findMany({
    take: 100,
    orderBy: { occurredAt: "desc" },
    ...(showGroupAccess
      ? { where: { action: { in: [...GROUP_ACCESS_ACTIONS] } } }
      : showInvites
        ? { where: { action: { in: [...INVITE_ACTIONS] } } }
        : {}),
    include: {
      actor: { select: { id: true, displayName: true, email: true } },
    },
  });

  // Resolve names for the group-access entries: projects (grants), groups, members.
  const projectIds = new Set<string>();
  const groupIds = new Set<string>();
  const userIds = new Set<string>();
  for (const log of logs) {
    if (log.entityType === "project" && isGroupAccessAction(log.action)) projectIds.add(log.entityId);
    if (log.entityType === "group" && isGroupAccessAction(log.action)) groupIds.add(log.entityId);
    const json = (log.beforeJson ?? log.afterJson) as { groupId?: string; userId?: string } | null;
    if (json?.groupId) groupIds.add(json.groupId);
    if (json?.userId) userIds.add(json.userId);
    if (showInvites && log.entityType === "user") userIds.add(log.entityId);
  }

  const [projects, groups, users] = await Promise.all([
    projectIds.size
      ? prisma.project.findMany({
          where: { id: { in: [...projectIds] } },
          select: { id: true, name: true },
        })
      : [],
    groupIds.size
      ? prisma.ldapSyncGroup.findMany({
          where: { id: { in: [...groupIds] } },
          select: { id: true, name: true },
        })
      : [],
    userIds.size
      ? prisma.user.findMany({
          where: { id: { in: [...userIds] } },
          select: { id: true, displayName: true, email: true },
        })
      : [],
  ]);

  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const userName = new Map(users.map((u) => [u.id, u.displayName || u.email]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-fg-primary">{t("title")}</h1>
        <p className="text-sm text-fg-tertiary">{t("last100")}</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="inline-flex rounded-lg border border-border-primary bg-bg-surface p-0.5">
          <Link
            href="/admin/audit-log"
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              !showGroupAccess
                ? "bg-accent text-accent-fg font-medium"
                : "text-fg-secondary hover:text-fg-primary"
            }`}
          >
            {t("allEvents")}
          </Link>
          <Link
            href="/admin/audit-log?groupAccess=true"
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              showGroupAccess
                ? "bg-accent text-accent-fg font-medium"
                : "text-fg-secondary hover:text-fg-primary"
            }`}
          >
            {t("groupAccess")}
          </Link>
          <Link
            href="/admin/audit-log?invites=true"
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              showInvites
                ? "bg-accent text-accent-fg font-medium"
                : "text-fg-secondary hover:text-fg-primary"
            }`}
          >
            {t("invites")}
          </Link>
        </div>
        {showGroupAccess && (
          <p className="text-sm text-fg-tertiary">{t("groupAccessHint")}</p>
        )}
        {showInvites && (
          <p className="text-sm text-fg-tertiary">{t("invitesHint")}</p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-primary">
              <th className="text-start p-2 text-fg-secondary">{t("time")}</th>
              <th className="text-start p-2 text-fg-secondary">{t("actor")}</th>
              <th className="text-start p-2 text-fg-secondary">{t("action")}</th>
              <th className="text-start p-2 text-fg-secondary">{t("detail")}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              const json = (log.beforeJson ?? log.afterJson) as
                | { groupId?: string; userId?: string; role?: string; email?: string }
                | null;
              const isGroupAccess = isGroupAccessAction(log.action);
              const group = json?.groupId ? groupName.get(json.groupId) : undefined;
              const member = json?.userId ? userName.get(json.userId) : undefined;
              const actionLabel = t.has(`actions.${log.action}`)
                ? t(`actions.${log.action}` as never)
                : log.action.replace(/_/g, " ");
              const entityName =
                log.entityType === "project"
                  ? projectName.get(log.entityId)
                  : log.entityType === "group"
                    ? groupName.get(log.entityId)
                    : undefined;

              return (
                <tr key={log.id} className="border-b border-border-primary hover:bg-bg-secondary">
                  <td className="p-2 text-fg-primary whitespace-nowrap font-mono text-xs">
                    {new Date(log.occurredAt).toISOString().slice(0, 19).replace("T", " ")}
                  </td>
                  <td className="p-2 text-fg-primary whitespace-nowrap">
                    {log.actor?.displayName ?? log.actor?.email ?? log.actorUserId ?? "system"}
                  </td>
                  <td className="p-2">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent">
                      {actionLabel}
                    </span>
                  </td>
                  <td className="p-2 text-fg-secondary">
                    {showInvites ? (
                      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        {log.entityType === "user" && (
                          <span className="font-medium text-fg-primary">
                            {userName.get(log.entityId) ?? json?.email ?? log.entityId.slice(0, 8)}
                          </span>
                        )}
                        {json?.email && log.entityType === "user" && (
                          <span className="inline-flex items-center gap-1">
                            <span aria-hidden>·</span>
                            {t("inviteeLabel")}: {json.email}
                          </span>
                        )}
                        {!json?.email && (
                          <span className="font-mono text-xs">{log.entityId.slice(0, 8)}...</span>
                        )}
                      </span>
                    ) : isGroupAccess ? (
                      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        {entityName && (
                          <span className="font-medium text-fg-primary">{entityName}</span>
                        )}
                        {group && (
                          <span className="inline-flex items-center gap-1">
                            <span aria-hidden>·</span>
                            {t("groupLabel")}: {group}
                          </span>
                        )}
                        {member && (
                          <span className="inline-flex items-center gap-1">
                            <span aria-hidden>·</span>
                            {t("memberLabel")}: {member}
                          </span>
                        )}
                        {json?.role && (
                          <span className="inline-flex items-center gap-1">
                            <span aria-hidden>·</span>
                            {t("roleLabel")}: {json.role}
                          </span>
                        )}
                        {!entityName && !group && !member && (
                          <span className="font-mono text-xs">{log.entityId.slice(0, 8)}...</span>
                        )}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span className="text-fg-secondary">{log.entityType}</span>
                        <span className="font-mono text-xs text-fg-tertiary">
                          {log.entityId.slice(0, 8)}...
                        </span>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-center text-fg-tertiary">
                  {showGroupAccess ? t("emptyGroupAccess") : showInvites ? t("emptyInvites") : t("empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="text-sm text-fg-tertiary">
        <Link href="/api/v1/audit-log" className="text-accent hover:underline">
          {t("apiEndpoint")}
        </Link>
      </div>
    </div>
  );
}
