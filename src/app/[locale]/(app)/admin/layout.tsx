import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { can } from "@/lib/rbac/can";
import { getManagedDepartmentIds } from "@/lib/departments";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Full admins (user:manage) see every admin page. Department managers with
  // at least one managed department get a scoped view — currently only the
  // Groups page, which supports per-group management in their subtree.
  const isAdmin = await can(session.user.id, "user:manage");
  const managedDepartmentIds = isAdmin ? null : await getManagedDepartmentIds(session.user.id);
  const canManageGroups = isAdmin || (managedDepartmentIds !== null && managedDepartmentIds.length > 0);
  if (!isAdmin && !canManageGroups) redirect("/");

  const t = await getTranslations("admin");

  const navLinks = [
    { href: "/admin/users", label: t("users"), visible: isAdmin },
    { href: "/admin/departments", label: t("departments"), visible: isAdmin },
    { href: "/admin/groups", label: t("groups"), visible: true },
    { href: "/admin/active-directory", label: t("activeDirectory"), visible: isAdmin },
    { href: "/admin/webhooks", label: t("webhooks"), visible: isAdmin },
    { href: "/admin/webhook-deliveries", label: t("auditLog"), visible: isAdmin },
    { href: "/admin/sso", label: t("sso"), visible: isAdmin },
    { href: "/admin/backups", label: t("backups"), visible: isAdmin },
  ].filter((link) => link.visible);

  return (
    <div className="px-6 py-6 flex gap-6">
      <nav className="w-48 shrink-0 space-y-0.5">
        <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wide mb-3">{t("title")}</h2>
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="block px-3 py-2 text-sm rounded-lg text-fg-secondary hover:bg-bg-surface hover:text-fg-primary transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
