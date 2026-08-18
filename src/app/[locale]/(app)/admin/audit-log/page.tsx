import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { can } from "@/lib/rbac/can";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { AuditLogViewer } from "@/components/admin/audit-log-viewer";

export default async function AuditLogPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const allowed = await can(session.user.id, "audit:view");
  if (!allowed) redirect("/");

  const t = await getTranslations("audit");

  const logs = await prisma.auditLog.findMany({
    take: 100,
    orderBy: { occurredAt: "desc" },
    include: {
      actor: { select: { id: true, displayName: true, email: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-fg-primary">{t("title")}</h1>
      </div>

      <AuditLogViewer
        initialLogs={logs as unknown as { id: string; actorUserId: string | null; action: string; entityType: string; entityId: string; beforeJson: unknown; afterJson: unknown; occurredAt: string; actor: { id: string; displayName: string; email: string } | null }[]}
        initialHasMore={logs.length === 100}
        initialNextCursor={logs.length > 0 ? (logs[logs.length - 1] as { id: string }).id : null}
      />

      <div className="text-sm text-fg-tertiary">
        <Link href="/api/v1/audit-log" className="text-accent hover:underline">
          {t("apiEndpoint")}
        </Link>
      </div>
    </div>
  );
}
